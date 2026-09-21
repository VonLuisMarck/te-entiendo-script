import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.mjs";
import { runJob } from "../src/runner.mjs";
import { analyzeCaptures } from "../src/adapter.mjs";
const source = {
  id: "test",
  portal: "pisos",
  navigation_origins: ["https://www.pisos.com"],
  adapter: {
    version: "test-v1",
    currency: "EUR",
    format: "json",
    items_path: "$",
    id_path: "id",
    url_path: "url",
    fields: {
      precio: "price",
      ciudad: "city",
      tipo_propiedad: "type",
      operacion: "operation",
    },
  },
};
const request = {
  source_id: "test",
  portal: "pisos",
  scope: "operator",
  search_urls: ["https://www.pisos.com/venta/"],
};
const row = (i) => ({
  id: String(i),
  url: `https://www.pisos.com/${i}`,
  price: 150000,
  city: "Murcia",
  type: "piso",
  operation: "venta",
});
function captured(count = 60) {
  const store = new Store(":memory:"),
    id = store.enqueue(request),
    job = store.claim("browser");
  store.addCapture(job, {
    page_index: 0,
    response_url: "https://www.pisos.com/api",
    body: JSON.stringify(Array.from({ length: count }, (_, i) => row(i))),
  });
  store.captured(job);
  store.finish(job, "captured");
  store.replay(id);
  return { store, id };
}
test("partial delivery acknowledgements survive retry; lost response reuses identical key and payload", async () => {
  const { store, id } = captured();
  let calls = 0;
  const committed = new Map(),
    keys = [];
  const fetcher = async (_url, options) => {
    calls++;
    const payload = options.body,
      key = options.headers["idempotency-key"];
    keys.push(key);
    if (committed.has(key)) assert.equal(committed.get(key), payload);
    else committed.set(key, payload);
    if (calls === 2) throw new Error("connection lost AFTER backend commit");
    const n = JSON.parse(payload).propiedades.length;
    return Response.json({ success: true, propiedades_guardadas_raw: n });
  };
  const args = {
    store,
    source,
    endpoint: "http://127.0.0.1:1",
    ingestion: { url: "https://ingest.example", secret: "fixture", fetcher },
  };
  await runJob({ ...args, job: store.claim("offline") });
  assert.equal(store.job(id).delivered, 50);
  assert.equal(store.job(id).status, "delivery_failed");
  assert.deepEqual(
    store.batches(id).map((b) => b.status),
    ["confirmed", "uncertain"],
  );
  store.replay(id);
  await runJob({ ...args, job: store.claim("offline") });
  assert.equal(store.job(id).delivered, 60);
  assert.equal(store.job(id).status, "completed");
  assert.equal(calls, 3);
  assert.equal(committed.size, 2);
  assert.equal(keys[1], keys[2]);
  store.close();
});
test("lease expiry after capture resumes without recapturing; old owner cannot acknowledge", () => {
  const { store, id } = captured(1);
  const job = store.claim("offline");
  const records = analyzeCaptures(store.captures(id, true), source).records;
  store.prepareDelivery(job, records, [], source.adapter.version);
  const batch = store.batches(id)[0];
  store.sending(job, batch.id);
  store.recover(Date.now() + 100000);
  assert.equal(store.job(id).status, "queued");
  assert.equal(store.batches(id)[0].status, "uncertain");
  assert.throws(() => store.confirm(job, batch.id), /lease_lost/);
  assert.equal(store.claim("offline").capture_complete, 1);
  store.close();
});
test("invalid records are quarantined with an evidence pointer while valid records are delivered", async () => {
  const { store, id } = captured(2);
  const cap = store.captures(id, true)[0];
  store.db
    .prepare("UPDATE captures SET body=? WHERE id=?")
    .run(JSON.stringify([row(1), { ...row(2), price: "100.000" }]), cap.id);
  const result = analyzeCaptures(store.captures(id, true), source);
  assert.equal(result.records.length, 1);
  assert.equal(result.rejections.length, 1);
  assert.equal(result.rejections[0].capture_id, cap.id);
  await runJob({
    store,
    job: store.claim("offline"),
    source,
    ingestion: {
      url: "https://ingest.example",
      secret: "fixture",
      fetcher: async () =>
        Response.json({ success: true, propiedades_guardadas_raw: 1 }),
    },
  });
  assert.equal(store.job(id).status, "completed_partial");
  assert.equal(store.job(id).rejected, 1);
  assert.equal(store.job(id).delivered, 1);
  store.close();
});
test("completed replay creates a new audited job and preserves previous confirmations", async () => {
  const { store, id } = captured(1);
  await runJob({
    store,
    job: store.claim("offline"),
    source,
    ingestion: {
      url: "https://example.test",
      secret: "fixture",
      fetcher: async () =>
        Response.json({ success: true, propiedades_guardadas_raw: 1 }),
    },
  });
  const next = store.replay(id);
  assert.notEqual(next, id);
  assert.equal(store.job(id).status, "completed");
  assert.equal(store.batches(id)[0].status, "confirmed");
  assert.equal(store.job(next).capture_complete, 1);
  assert.equal(store.captures(next).length, 1);
  assert.equal(store.replay(id), next);
  store.close();
});
test("pause/cancel fences running work and resuming incomplete captures discards partial bytes", () => {
  const store = new Store(":memory:"),
    id = store.enqueue(request),
    job = store.claim("browser");
  store.addCapture(job, {
    page_index: 0,
    response_url: "https://www.pisos.com/api",
    body: "[]",
  });
  store.controlJob(id, "pause");
  assert.throws(() => store.heartbeat(job), /pause_requested/);
  store.finish(job, "interrupted");
  assert.equal(store.job(id).status, "paused");
  store.controlJob(id, "resume");
  assert.equal(store.captures(id).length, 0);
  store.controlJob(id, "cancel");
  assert.equal(store.claim("browser"), null);
  store.close();
});
test("elapsed schedules are UTC anchored across DST and skip catch-up storms; source pauses stop capture", () => {
  const store = new Store(":memory:"),
    now = Date.parse("2026-03-28T07:00:00Z");
  store.saveSchedule(
    request,
    { interval_minutes: 1440, timezone: "Europe/Madrid" },
    now,
  );
  store.tickSchedules(now + 4 * 86400000);
  assert.equal(store.jobs().length, 1);
  assert.equal(store.schedules()[0].next_run, now + 5 * 86400000);
  store.tickSchedules(now + 4 * 86400000);
  assert.equal(store.jobs().length, 1);
  store.setSourcePaused("test", true);
  assert.equal(store.claim("browser"), null);
  store.setSourcePaused("test", false);
  assert.ok(store.claim("browser"));
  store.close();
});
test("scope queue limits are enforced before adding jobs, and raw pruning retains unresolved deliveries", () => {
  const store = new Store(":memory:");
  for (let i = 0; i < 20; i++)
    store.enqueue({ ...request, ubicacion: String(i) });
  assert.throws(
    () => store.enqueue({ ...request, ubicacion: "overflow" }),
    /scope_queue_full/,
  );
  assert.ok(
    store.enqueue({ ...request, scope: "another", ubicacion: "separate" }),
  );
  store.close();
  const saved = captured(1),
    job = saved.store.claim("offline");
  saved.store.prepareDelivery(
    job,
    analyzeCaptures(saved.store.captures(saved.id, true), source).records,
    [],
    source.adapter.version,
  );
  saved.store.finish(job, "delivery_failed");
  saved.store.db.prepare("UPDATE jobs SET updated_at=0").run();
  saved.store.prune(1);
  assert.ok(saved.store.job(saved.id));
  saved.store.close();
});
