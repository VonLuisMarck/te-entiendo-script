import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { WorkerError } from "./config.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const active = "('queued','running','paused')";
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, request TEXT NOT NULL, request_hash TEXT NOT NULL,
        status TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'capture', created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL, owner TEXT, lease_until INTEGER, error TEXT, delivered INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS slots (id TEXT PRIMARY KEY, owner TEXT NOT NULL, lease_until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        page_index INTEGER NOT NULL, response_url TEXT NOT NULL, captured_at INTEGER NOT NULL,
        body_sha256 TEXT NOT NULL, body TEXT NOT NULL, bytes INTEGER NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/json', body_encoding TEXT NOT NULL DEFAULT 'utf8', http_status INTEGER NOT NULL DEFAULT 200
      );`);
    this.migrate("captures", {
      mime_type: "TEXT NOT NULL DEFAULT 'application/json'",
      body_encoding: "TEXT NOT NULL DEFAULT 'utf8'",
      http_status: "INTEGER NOT NULL DEFAULT 200",
    });
    this.migrate("jobs", {
      phase: "TEXT NOT NULL DEFAULT 'capture'",
      capture_complete: "INTEGER NOT NULL DEFAULT 0",
      rejected: "INTEGER NOT NULL DEFAULT 0",
      priority: "INTEGER NOT NULL DEFAULT 0",
      available_at: "INTEGER NOT NULL DEFAULT 0",
      control: "TEXT",
      delivery_attempt_limit: "INTEGER NOT NULL DEFAULT 3",
      scope: "TEXT NOT NULL DEFAULT 'operator'",
      source_id: "TEXT NOT NULL DEFAULT ''",
      adapter_version: "TEXT",
    });
    this.db.exec(`DROP INDEX IF EXISTS active_request;
      CREATE UNIQUE INDEX IF NOT EXISTS active_request_v2 ON jobs(request_hash) WHERE status IN ('queued','running','paused');
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,payload TEXT NOT NULL,record_count INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
        confirmed_at INTEGER,error TEXT,UNIQUE(job_id,ordinal)
      );
      CREATE TABLE IF NOT EXISTS rejections (
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,capture_id TEXT NOT NULL,
        record_index INTEGER NOT NULL,code TEXT NOT NULL,PRIMARY KEY(job_id,capture_id,record_index)
      );
      CREATE TABLE IF NOT EXISTS source_health (
        id TEXT PRIMARY KEY,paused INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0,
        last_started INTEGER NOT NULL DEFAULT 0,last_success INTEGER,error TEXT
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,request TEXT NOT NULL,interval_ms INTEGER NOT NULL,timezone TEXT NOT NULL,
        next_run INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,last_job TEXT,last_run INTEGER
      );
      CREATE INDEX IF NOT EXISTS runnable_jobs ON jobs(status,available_at,source_id,scope);
      UPDATE jobs SET source_id=json_extract(request,'$.source_id') WHERE source_id='';
      UPDATE jobs SET capture_complete=1,phase='decode' WHERE phase='capture' AND status IN ('captured','needs_review','delivery_failed','completed');`);
  }
  migrate(table, definitions) {
    const columns = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((c) => c.name);
    for (const [name, definition] of Object.entries(definitions))
      if (!columns.includes(name))
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  enqueue(request) {
    return this.transaction(() => this.insertJob(request));
  }
  insertJob(request, now = Date.now()) {
    const value = JSON.stringify(request),
      digest = hash(value),
      scope = request.scope ?? "operator";
    const existing = this.db
      .prepare(
        `SELECT id FROM jobs WHERE request_hash=? AND status IN ${active}`,
      )
      .get(digest);
    if (existing) return existing.id;
    if (
      this.db
        .prepare(`SELECT COUNT(*) n FROM jobs WHERE status IN ${active}`)
        .get().n >= 100
    )
      throw new WorkerError("queue_full", 429);
    if (
      this.db
        .prepare(
          `SELECT COUNT(*) n FROM jobs WHERE scope=? AND status IN ${active}`,
        )
        .get(scope).n >= 20
    )
      throw new WorkerError("scope_queue_full", 429);
    if (
      this.db
        .prepare("SELECT COUNT(*) n FROM jobs WHERE scope=? AND created_at>?")
        .get(scope, now - 86400000).n >= 100
    )
      throw new WorkerError("scope_daily_quota", 429);
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO jobs(id,request,request_hash,status,created_at,updated_at,scope,source_id) VALUES(?,?,?,'queued',?,?,?,?)",
      )
      .run(id, value, digest, now, now, scope, request.source_id);
    this.db
      .prepare("INSERT OR IGNORE INTO source_health(id) VALUES(?)")
      .run(request.source_id);
    return id;
  }
  recover(now = Date.now()) {
    this.db
      .prepare(
        "UPDATE deliveries SET status='uncertain',error='lease_expired' WHERE status='sending' AND job_id IN (SELECT id FROM jobs WHERE status='running' AND lease_until<?)",
      )
      .run(now);
    this.db
      .prepare(
        `UPDATE jobs SET status=CASE WHEN control='cancel' THEN 'cancelled' WHEN control='pause' THEN 'paused' WHEN capture_complete=1 THEN 'queued' ELSE 'interrupted' END,
      kind=CASE WHEN capture_complete=1 THEN 'replay' ELSE kind END,error='lease_expired',owner=NULL,lease_until=NULL,control=NULL,updated_at=? WHERE status='running' AND lease_until<?`,
      )
      .run(now, now);
    this.db.prepare("DELETE FROM slots WHERE lease_until<?").run(now);
  }
  claim(slot, now = Date.now()) {
    return this.transaction(() => {
      this.recover(now);
      const key = hash(slot),
        lease = this.db.prepare("SELECT * FROM slots WHERE id=?").get(key);
      if (lease && lease.lease_until >= now) return null;
      // One capture per source; old sources/scopes get a turn before another run.
      const job = this.db
        .prepare(
          `SELECT j.* FROM jobs j LEFT JOIN source_health h ON h.id=j.source_id
        WHERE j.status='queued' AND j.available_at<=? AND (j.capture_complete=1 OR coalesce(h.paused,0)=0)
        AND NOT EXISTS(SELECT 1 FROM jobs r WHERE r.status='running' AND r.source_id=j.source_id AND j.capture_complete=0)
        ORDER BY j.priority DESC,coalesce((SELECT max(r.updated_at) FROM jobs r WHERE r.scope=j.scope AND r.phase<>'capture'),0),coalesce(h.last_started,0),j.created_at,j.id LIMIT 1`,
        )
        .get(now);
      if (!job) return null;
      const owner = randomUUID(),
        until = now + 90000;
      this.db
        .prepare(
          "INSERT INTO slots VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until",
        )
        .run(key, owner, until);
      this.db
        .prepare(
          "UPDATE jobs SET status='running',owner=?,lease_until=?,updated_at=?,error=NULL WHERE id=?",
        )
        .run(owner, until, now, job.id);
      this.db
        .prepare("UPDATE source_health SET last_started=? WHERE id=?")
        .run(now, job.source_id);
      return { ...job, request: JSON.parse(job.request), owner, slot: key };
    });
  }
  owns(job) {
    const now = Date.now();
    return !!this.db
      .prepare(
        "SELECT 1 FROM jobs j JOIN slots s ON s.id=? AND s.owner=j.owner WHERE j.id=? AND j.owner=? AND j.status='running' AND j.lease_until>? AND s.lease_until>?",
      )
      .get(job.slot, job.id, job.owner, now, now);
  }
  assertOwned(job) {
    if (!this.owns(job)) throw new WorkerError("lease_lost");
  }
  heartbeat(job) {
    return this.transaction(() => {
      this.assertOwned(job);
      const control = this.db
        .prepare("SELECT control FROM jobs WHERE id=?")
        .get(job.id).control;
      if (control) throw new WorkerError(`job_${control}_requested`);
      const now = Date.now();
      this.db
        .prepare(
          "UPDATE jobs SET lease_until=?,updated_at=? WHERE id=? AND owner=?",
        )
        .run(now + 90000, now, job.id, job.owner);
      this.db
        .prepare("UPDATE slots SET lease_until=? WHERE id=? AND owner=?")
        .run(now + 90000, job.slot, job.owner);
    });
  }
  addCapture(
    job,
    {
      page_index,
      response_url,
      body,
      mime_type = "application/json",
      body_encoding = "utf8",
      http_status = 200,
      captured_at = Date.now(),
    },
  ) {
    return this.transaction(() => {
      this.assertOwned(job);
      if (
        !Number.isFinite(captured_at) ||
        captured_at < 0 ||
        captured_at > Date.now() + 300000
      )
        throw new WorkerError("invalid_capture_time");
      const raw = Buffer.from(
          body,
          body_encoding === "base64" ? "base64" : "utf8",
        ),
        bytes = raw.byteLength,
        digest = hash(raw);
      const id = hash(`${job.id}:${page_index}:${response_url}:${digest}`);
      if (this.db.prepare("SELECT 1 FROM captures WHERE id=?").get(id))
        return id;
      const size = this.db
        .prepare(
          "SELECT COUNT(*) n,COALESCE(SUM(bytes),0) bytes FROM captures WHERE job_id=?",
        )
        .get(job.id);
      if (bytes > 2_000_000 || size.n >= 50 || size.bytes + bytes > 20_000_000)
        throw new WorkerError("capture_limit_exceeded");
      this.db
        .prepare(
          "INSERT INTO captures(id,job_id,page_index,response_url,captured_at,body_sha256,body,bytes,mime_type,body_encoding,http_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          job.id,
          page_index,
          response_url,
          captured_at,
          digest,
          body,
          bytes,
          mime_type,
          body_encoding,
          http_status,
        );
      return id;
    });
  }
  captured(job) {
    this.assertOwned(job);
    this.db
      .prepare(
        "UPDATE jobs SET capture_complete=1,phase='decode',updated_at=? WHERE id=?",
      )
      .run(Date.now(), job.id);
  }
  prepareDelivery(job, records, rejections, version) {
    return this.transaction(() => {
      this.assertOwned(job);
      if (
        this.db.prepare("SELECT 1 FROM deliveries WHERE job_id=?").get(job.id)
      )
        return;
      this.db.prepare("DELETE FROM rejections WHERE job_id=?").run(job.id);
      for (const r of rejections)
        this.db
          .prepare("INSERT OR REPLACE INTO rejections VALUES(?,?,?,?)")
          .run(job.id, r.capture_id, r.record_index, r.code);
      const batches = [];
      let batch = [],
        bytes = 0;
      for (const row of records) {
        const size = Buffer.byteLength(JSON.stringify(row));
        if (batch.length && (batch.length >= 50 || bytes + size > 500000)) {
          batches.push(batch);
          batch = [];
          bytes = 0;
        }
        batch.push(row);
        bytes += size;
      }
      if (batch.length) batches.push(batch);
      batches.forEach((rows, i) => {
        const payload = JSON.stringify(rows),
          id = hash(`${job.id}:${version}:${i}:${payload}`);
        this.db
          .prepare(
            "INSERT INTO deliveries(id,job_id,ordinal,payload,record_count) VALUES(?,?,?,?,?)",
          )
          .run(id, job.id, i, payload, rows.length);
      });
      this.db
        .prepare(
          "UPDATE jobs SET phase='delivery',rejected=?,adapter_version=?,updated_at=? WHERE id=?",
        )
        .run(rejections.length, version, Date.now(), job.id);
    });
  }
  batches(id) {
    return this.db
      .prepare("SELECT * FROM deliveries WHERE job_id=? ORDER BY ordinal")
      .all(id);
  }
  sending(job, id) {
    this.assertOwned(job);
    this.db
      .prepare(
        "UPDATE deliveries SET status='sending',attempts=attempts+1,error=NULL WHERE job_id=? AND id=? AND status<>'confirmed'",
      )
      .run(job.id, id);
  }
  uncertain(job, id, code) {
    if (this.owns(job))
      this.db
        .prepare(
          "UPDATE deliveries SET status='uncertain',error=? WHERE job_id=? AND id=? AND status<>'confirmed'",
        )
        .run(code, job.id, id);
  }
  confirm(job, id) {
    return this.transaction(() => {
      this.assertOwned(job);
      this.db
        .prepare(
          "UPDATE deliveries SET status='confirmed',confirmed_at=?,error=NULL WHERE job_id=? AND id=?",
        )
        .run(Date.now(), job.id, id);
      this.db
        .prepare(
          "UPDATE jobs SET delivered=(SELECT coalesce(sum(record_count),0) FROM deliveries WHERE job_id=? AND status='confirmed'),updated_at=? WHERE id=?",
        )
        .run(job.id, Date.now(), job.id);
    });
  }
  finish(job, status, error = null, delivered = null) {
    return this.transaction(() => {
      if (!this.owns(job)) return false;
      const current = this.db
        .prepare("SELECT * FROM jobs WHERE id=?")
        .get(job.id);
      if (current.control)
        status = current.control === "cancel" ? "cancelled" : "paused";
      else if (status === "interrupted" && current.capture_complete)
        status = "queued";
      this.db
        .prepare(
          "UPDATE jobs SET status=?,error=?,delivered=coalesce(?,delivered),control=NULL,owner=NULL,lease_until=NULL,updated_at=? WHERE id=? AND owner=?",
        )
        .run(status, error, delivered, Date.now(), job.id, job.owner);
      this.db
        .prepare("DELETE FROM slots WHERE id=? AND owner=?")
        .run(job.slot, job.owner);
      if (["completed", "completed_partial"].includes(status))
        this.db
          .prepare(
            "UPDATE source_health SET failures=0,last_success=?,error=NULL WHERE id=?",
          )
          .run(Date.now(), job.source_id);
      if (
        error &&
        (error.startsWith("source_") ||
          ["schema_changed", "invalid_json", "all_records_rejected"].includes(
            error,
          ))
      ) {
        this.db
          .prepare(
            "UPDATE source_health SET failures=failures+1,error=?,paused=CASE WHEN failures>=2 OR ? IN ('source_http_401','source_http_403','source_http_429') THEN 1 ELSE paused END WHERE id=?",
          )
          .run(error, error, job.source_id);
      }
      return true;
    });
  }
  retryDelivery(job, code) {
    const canRetry = this.batches(job.id)
      .filter((b) => b.status !== "confirmed")
      .every(
        (b) =>
          b.attempts <
          this.db
            .prepare("SELECT delivery_attempt_limit FROM jobs WHERE id=?")
            .get(job.id).delivery_attempt_limit,
      );
    if (!canRetry) return this.finish(job, "delivery_failed", code);
    if (!this.finish(job, "delivery_failed", code)) return false;
    this.db
      .prepare(
        "UPDATE jobs SET status='queued',kind='replay',available_at=? WHERE id=? AND status='delivery_failed'",
      )
      .run(Date.now() + 30000, job.id);
  }
  replay(id) {
    return this.transaction(() => {
      const job = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (!job) throw new WorkerError("job_not_found", 404);
      if (["running", "queued"].includes(job.status))
        throw new WorkerError("job_busy", 409);
      if (!job.capture_complete)
        throw new WorkerError("capture_incomplete", 409);
      if (!this.db.prepare("SELECT 1 FROM captures WHERE job_id=?").get(id))
        throw new WorkerError("no_captures", 409);
      if (["completed", "completed_partial"].includes(job.status)) {
        const next = this.insertJob({
          ...JSON.parse(job.request),
          replay_of: id,
        });
        if (
          !this.db.prepare("SELECT 1 FROM captures WHERE job_id=?").get(next)
        ) {
          for (const c of this.captures(id, true))
            this.db
              .prepare(
                "INSERT INTO captures(id,job_id,page_index,response_url,captured_at,body_sha256,body,bytes,mime_type,body_encoding,http_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
              )
              .run(
                hash(`${next}:${c.id}`),
                next,
                c.page_index,
                c.response_url,
                c.captured_at,
                c.body_sha256,
                c.body,
                c.bytes,
                c.mime_type,
                c.body_encoding,
                c.http_status,
              );
          this.db
            .prepare(
              "UPDATE jobs SET capture_complete=1,kind='replay',phase='decode' WHERE id=?",
            )
            .run(next);
        }
        return next;
      }
      this.db
        .prepare(
          "UPDATE jobs SET status='queued',kind='replay',error=NULL,available_at=0,delivery_attempt_limit=max(delivery_attempt_limit,(SELECT coalesce(max(attempts),0)+3 FROM deliveries WHERE job_id=jobs.id)),updated_at=? WHERE id=?",
        )
        .run(Date.now(), id);
      return id;
    });
  }
  controlJob(id, action) {
    return this.transaction(() => {
      const job = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (!job) throw new WorkerError("job_not_found", 404);
      if (action === "priority")
        return this.db.prepare("UPDATE jobs SET priority=1 WHERE id=?").run(id);
      if (action === "resume") {
        if (job.status !== "paused")
          throw new WorkerError("job_not_paused", 409);
        if (!job.capture_complete)
          this.db.prepare("DELETE FROM captures WHERE job_id=?").run(id);
        return this.db
          .prepare(
            "UPDATE jobs SET status='queued',control=NULL,available_at=0,updated_at=? WHERE id=?",
          )
          .run(Date.now(), id);
      }
      if (
        !["pause", "cancel"].includes(action) ||
        !["queued", "running", "paused"].includes(job.status)
      )
        throw new WorkerError("invalid_job_action", 409);
      this.db
        .prepare("UPDATE jobs SET status=?,control=?,updated_at=? WHERE id=?")
        .run(
          job.status === "running"
            ? "running"
            : action === "pause"
              ? "paused"
              : "cancelled",
          job.status === "running" ? action : null,
          Date.now(),
          id,
        );
    });
  }
  setSourcePaused(id, paused) {
    this.db
      .prepare(
        "INSERT INTO source_health(id,paused) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET paused=excluded.paused,failures=0",
      )
      .run(id, Number(paused));
  }
  health() {
    return this.db.prepare("SELECT * FROM source_health ORDER BY id").all();
  }
  saveSchedule(
    request,
    { interval_minutes, timezone = "UTC", id = randomUUID(), enabled = true },
    now = Date.now(),
  ) {
    if (
      !Number.isInteger(interval_minutes) ||
      interval_minutes < 60 ||
      interval_minutes > 10080
    )
      throw new WorkerError("invalid_interval", 400);
    try {
      new Intl.DateTimeFormat("es", { timeZone: timezone });
    } catch {
      throw new WorkerError("invalid_timezone", 400);
    }
    this.db
      .prepare(
        `INSERT INTO schedules(id,request,interval_ms,timezone,next_run,enabled) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET request=excluded.request,interval_ms=excluded.interval_ms,timezone=excluded.timezone,enabled=excluded.enabled`,
      )
      .run(
        id,
        JSON.stringify(request),
        interval_minutes * 60000,
        timezone,
        now + interval_minutes * 60000,
        Number(enabled),
      );
    return id;
  }
  schedules() {
    return this.db
      .prepare("SELECT * FROM schedules ORDER BY next_run")
      .all()
      .map((r) => ({ ...r, request: JSON.parse(r.request) }));
  }
  tickSchedules(now = Date.now()) {
    return this.transaction(() => {
      const due = this.db
        .prepare(
          "SELECT * FROM schedules WHERE enabled=1 AND next_run<=? ORDER BY next_run LIMIT 20",
        )
        .all(now);
      for (const schedule of due) {
        const request = JSON.parse(schedule.request);
        if (this.health().some((h) => h.id === request.source_id && h.paused))
          continue;
        let id;
        try {
          id = this.insertJob(request, now);
        } catch (error) {
          if (error.status === 429) continue;
          throw error;
        }
        const next =
          schedule.next_run +
          (Math.floor((now - schedule.next_run) / schedule.interval_ms) + 1) *
            schedule.interval_ms;
        this.db
          .prepare(
            "UPDATE schedules SET last_job=?,last_run=?,next_run=? WHERE id=?",
          )
          .run(id, now, next, schedule.id);
      }
    });
  }
  jobs() {
    return this.db
      .prepare("SELECT id FROM jobs ORDER BY created_at DESC LIMIT 100")
      .all()
      .map((r) => this.job(r.id));
  }
  job(id) {
    const row = this.db
      .prepare(
        "SELECT id,request,status,kind,created_at,updated_at,error,delivered,phase,capture_complete,rejected,priority,available_at,control,adapter_version,(SELECT COUNT(*) FROM captures WHERE job_id=jobs.id) captures FROM jobs WHERE id=?",
      )
      .get(id);
    return row ? { ...row, request: JSON.parse(row.request) } : null;
  }
  rejections(id) {
    return this.db.prepare("SELECT * FROM rejections WHERE job_id=?").all(id);
  }
  metrics() {
    return {
      jobs: this.db
        .prepare("SELECT status,count(*) count FROM jobs GROUP BY status")
        .all(),
      oldest_queued_at: this.db
        .prepare("SELECT min(created_at) value FROM jobs WHERE status='queued'")
        .get().value,
      deliveries: this.db
        .prepare(
          "SELECT status,count(*) batches,coalesce(sum(record_count),0) records FROM deliveries GROUP BY status",
        )
        .all(),
      captures: this.db
        .prepare(
          "SELECT count(*) count,coalesce(sum(bytes),0) bytes FROM captures",
        )
        .get(),
      sources: this.health(),
      rss_bytes: process.memoryUsage().rss,
    };
  }
  captures(id, full = false) {
    return this.db
      .prepare(
        `SELECT id,page_index,response_url,captured_at,body_sha256,bytes,mime_type,body_encoding,http_status${full ? ",body" : ""} FROM captures WHERE job_id=? ORDER BY captured_at,id`,
      )
      .all(id);
  }
  capture(jobId, id) {
    return this.db
      .prepare("SELECT * FROM captures WHERE job_id=? AND id=?")
      .get(jobId, id);
  }
  prune(days = 7) {
    // Unconfirmed deliveries survive raw retention; an operator must reconcile them.
    this.db
      .prepare(
        `DELETE FROM jobs WHERE status NOT IN ('queued','running','paused','delivery_failed','interrupted') AND updated_at<?
      AND NOT EXISTS(SELECT 1 FROM deliveries WHERE job_id=jobs.id AND status<>'confirmed')`,
      )
      .run(Date.now() - days * 86400000);
  }
  close() {
    this.db.close();
  }
}
