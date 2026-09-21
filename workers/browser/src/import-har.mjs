import { readFileSync, statSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { capturesFromHar } from "./har.mjs";
import { loadSources, validateJob, WorkerError } from "./config.mjs";
import { Store } from "./store.mjs";

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    source: { type: "string" },
    url: { type: "string" },
  },
});
process.umask(0o077);
if (!values.file || statSync(values.file).size > 100_000_000)
  throw new WorkerError("provide_har_under_100_MB");
const sources = loadSources(
  resolve(process.env.SOURCES_FILE ?? "sources.local.json"),
);
const request = validateJob(
  { source_id: values.source, search_urls: [values.url] },
  sources,
);
const source = sources.find((s) => s.id === request.source_id);
const captures = capturesFromHar(
  JSON.parse(readFileSync(values.file, "utf8")),
  source,
);
const path = resolve(process.env.WORKER_DB ?? "data/worker.sqlite");
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const store = new Store(path);
let job;
try {
  // Run while the worker service is stopped, so the local import owns the next queue job.
  if (store.jobs().some((j) => ["running", "queued"].includes(j.status)))
    throw new WorkerError("stop_worker_and_finish_queue_before_import");
  const id = store.enqueue({ ...request, provenance: "har_import" });
  job = store.claim("har-import");
  if (!job || job.id !== id) throw new WorkerError("import_queue_busy");
  for (const capture of captures) store.addCapture(job, capture);
  store.captured(job);
  store.finish(job, "captured", "adapter_not_configured");
  console.log(
    JSON.stringify({
      job_id: id,
      captures: captures.length,
      status: "captured",
      provenance: "har_import",
    }),
  );
} catch (error) {
  if (job)
    store.finish(
      job,
      "failed",
      error instanceof WorkerError ? error.code : "import_failed",
    );
  throw error;
} finally {
  store.close();
}
