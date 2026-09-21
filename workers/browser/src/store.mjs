import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { WorkerError } from './config.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, request TEXT NOT NULL, request_hash TEXT NOT NULL,
        status TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'capture', created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL, owner TEXT, lease_until INTEGER, error TEXT, delivered INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS active_request ON jobs(request_hash) WHERE status IN ('queued','running');
      CREATE TABLE IF NOT EXISTS slots (id TEXT PRIMARY KEY, owner TEXT NOT NULL, lease_until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        page_index INTEGER NOT NULL, response_url TEXT NOT NULL, captured_at INTEGER NOT NULL,
        body_sha256 TEXT NOT NULL, body TEXT NOT NULL, bytes INTEGER NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/json', body_encoding TEXT NOT NULL DEFAULT 'utf8', http_status INTEGER NOT NULL DEFAULT 200
      );`);
    // Forward-compatible with the initial local JSON-only queue.
    const columns=this.db.prepare('PRAGMA table_info(captures)').all().map(c=>c.name);
    for (const [name,definition] of Object.entries({mime_type:"TEXT NOT NULL DEFAULT 'application/json'",body_encoding:"TEXT NOT NULL DEFAULT 'utf8'",http_status:'INTEGER NOT NULL DEFAULT 200'})) {
      if (!columns.includes(name)) this.db.exec(`ALTER TABLE captures ADD COLUMN ${name} ${definition}`);
    }
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  enqueue(request) {
    return this.transaction(() => {
      const value = JSON.stringify(request), digest = hash(value);
      const existing = this.db.prepare("SELECT id FROM jobs WHERE request_hash=? AND status IN ('queued','running')").get(digest);
      if (existing) return existing.id;
      if (this.db.prepare("SELECT COUNT(*) n FROM jobs WHERE status IN ('queued','running')").get().n >= 100) throw new WorkerError('queue_full', 429);
      const id = randomUUID(), now = Date.now();
      this.db.prepare("INSERT INTO jobs(id,request,request_hash,status,created_at,updated_at) VALUES(?,?,?,'queued',?,?)").run(id,value,digest,now,now);
      return id;
    });
  }
  recover(now = Date.now()) {
    this.db.prepare("UPDATE jobs SET status='interrupted', error='lease_expired', owner=NULL, lease_until=NULL, updated_at=? WHERE status='running' AND lease_until<?").run(now,now);
  }
  claim(slot, now = Date.now()) {
    return this.transaction(() => {
      this.recover(now);
      const key = hash(slot), lease = this.db.prepare('SELECT * FROM slots WHERE id=?').get(key);
      if (lease && lease.lease_until >= now) return null;
      const job = this.db.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1").get();
      if (!job) return null;
      const owner = randomUUID(), until = now + 90000;
      this.db.prepare('INSERT INTO slots VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until').run(key,owner,until);
      this.db.prepare("UPDATE jobs SET status='running',owner=?,lease_until=?,updated_at=?,error=NULL WHERE id=?").run(owner,until,now,job.id);
      return { ...job, request: JSON.parse(job.request), owner, slot: key };
    });
  }
  owns(job) {
    const now = Date.now();
    return !!this.db.prepare("SELECT 1 FROM jobs j JOIN slots s ON s.id=? AND s.owner=j.owner WHERE j.id=? AND j.owner=? AND j.status='running' AND j.lease_until>? AND s.lease_until>?").get(job.slot,job.id,job.owner,now,now);
  }
  heartbeat(job) {
    return this.transaction(() => {
      if (!this.owns(job)) throw new WorkerError('lease_lost');
      const now = Date.now();
      this.db.prepare('UPDATE jobs SET lease_until=?,updated_at=? WHERE id=? AND owner=?').run(now+90000,now,job.id,job.owner);
      this.db.prepare('UPDATE slots SET lease_until=? WHERE id=? AND owner=?').run(now+90000,job.slot,job.owner);
    });
  }
  addCapture(job, { page_index, response_url, body, mime_type='application/json', body_encoding='utf8', http_status=200 }) {
    return this.transaction(() => {
      if (!this.owns(job)) throw new WorkerError('lease_lost');
      const raw=Buffer.from(body,body_encoding==='base64'?'base64':'utf8');
      const bytes = raw.byteLength, digest = hash(raw);
      const id = hash(`${job.id}:${page_index}:${response_url}:${digest}`);
      if (this.db.prepare('SELECT 1 FROM captures WHERE id=?').get(id)) return id;
      const size = this.db.prepare('SELECT COUNT(*) n,COALESCE(SUM(bytes),0) bytes FROM captures WHERE job_id=?').get(job.id);
      if (bytes > 2_000_000 || size.n >= 50 || size.bytes + bytes > 20_000_000) throw new WorkerError('capture_limit_exceeded');
      this.db.prepare('INSERT INTO captures(id,job_id,page_index,response_url,captured_at,body_sha256,body,bytes,mime_type,body_encoding,http_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,job.id,page_index,response_url,Date.now(),digest,body,bytes,mime_type,body_encoding,http_status);
      return id;
    });
  }
  finish(job, status, error = null, delivered = 0) {
    return this.transaction(() => {
      if (!this.owns(job)) return false;
      this.db.prepare('UPDATE jobs SET status=?,error=?,delivered=?,owner=NULL,lease_until=NULL,updated_at=? WHERE id=? AND owner=?').run(status,error,delivered,Date.now(),job.id,job.owner);
      this.db.prepare('DELETE FROM slots WHERE id=? AND owner=?').run(job.slot,job.owner);
      return true;
    });
  }
  replay(id) {
    return this.transaction(() => {
      const job = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
      if (!job) throw new WorkerError('job_not_found',404);
      if (['running','queued'].includes(job.status)) throw new WorkerError('job_busy',409);
      // A failed/incomplete browser traversal must never be promoted by replaying partial data.
      if (!['captured','needs_review','delivery_failed','completed'].includes(job.status)) throw new WorkerError('capture_incomplete',409);
      if (!this.db.prepare('SELECT 1 FROM captures WHERE job_id=?').get(id)) throw new WorkerError('no_captures',409);
      this.db.prepare("UPDATE jobs SET status='queued',kind='replay',error=NULL,updated_at=? WHERE id=?").run(Date.now(),id);
    });
  }
  jobs() {
    return this.db.prepare('SELECT id,request,status,kind,created_at,updated_at,error,delivered,(SELECT COUNT(*) FROM captures WHERE job_id=jobs.id) captures FROM jobs ORDER BY created_at DESC LIMIT 50').all().map(row => ({ ...row, request: JSON.parse(row.request) }));
  }
  job(id) {
    const row = this.db.prepare('SELECT id,request,status,kind,created_at,updated_at,error,delivered FROM jobs WHERE id=?').get(id);
    return row ? { ...row, request: JSON.parse(row.request) } : null;
  }
  captures(id, full = false) {
    return this.db.prepare(`SELECT id,page_index,response_url,captured_at,body_sha256,bytes,mime_type,body_encoding,http_status${full ? ',body' : ''} FROM captures WHERE job_id=? ORDER BY captured_at,id`).all(id);
  }
  capture(jobId, id) { return this.db.prepare('SELECT * FROM captures WHERE job_id=? AND id=?').get(jobId,id); }
  prune(days = 7) {
    this.db.prepare("DELETE FROM jobs WHERE status NOT IN ('queued','running') AND updated_at<?").run(Date.now()-days*86400000);
  }
  close() { this.db.close(); }
}
