import { captureSearch } from "./capture.mjs";
import { analyzeCaptures } from "./adapter.mjs";
import { WorkerError } from "./config.mjs";

export async function deliverBatch(
  batch,
  job,
  { url, secret, fetcher = fetch },
  signal,
) {
  if (!url || !secret) throw new WorkerError("ingestion_not_configured");
  const propiedades = JSON.parse(batch.payload);
  const response = await fetcher(url, {
    method: "POST",
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    headers: {
      "content-type": "application/json",
      "x-scraper-secret": secret,
      "idempotency-key": batch.id,
    },
    body: JSON.stringify({
      propiedades,
      metadata: {
        portal: job.request.portal,
        ubicacion: job.request.ubicacion,
        total_encontradas: propiedades.length,
        job_id: job.id,
        batch_id: batch.id,
      },
    }),
  });
  if (!response.ok) throw new WorkerError("ingestion_failed");
  const result = await response.json();
  if (
    result.success !== true ||
    result.propiedades_guardadas_raw !== propiedades.length
  )
    throw new WorkerError("ingestion_not_confirmed");
}
export async function runJob({
  store,
  job,
  source,
  endpoint,
  ingestion,
  signal,
  captureOptions = {},
  autoRetry = false,
}) {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  signal?.addEventListener("abort", interrupt, { once: true });
  if (signal?.aborted) controller.abort();
  const heartbeat = setInterval(() => {
    try {
      store.heartbeat(job);
    } catch {
      controller.abort();
    }
  }, 1000);
  console.info(
    JSON.stringify({
      event: "job.started",
      job_id: job.id,
      source_id: job.request.source_id,
      kind: job.kind,
    }),
  );
  let phase = job.capture_complete ? "decode" : "capture";
  try {
    if (!source) throw new WorkerError("source_removed");
    if (!job.capture_complete) {
      await captureSearch({
        ...captureOptions,
        endpoint,
        source,
        urls: job.request.search_urls,
        signal: controller.signal,
        onCapture: (capture) => store.addCapture(job, capture),
      });
      store.captured(job);
    }
    if (!source.adapter) {
      store.finish(job, "captured", "adapter_not_configured");
      return;
    }
    phase = "decode";
    if (!store.batches(job.id).length) {
      const { records, rejections } = analyzeCaptures(
        store.captures(job.id, true),
        source,
      );
      store.prepareDelivery(job, records, rejections, source.adapter.version);
      if (!records.length && rejections.length) {
        store.finish(job, "needs_review", "all_records_rejected");
        return;
      }
    }
    phase = "delivery";
    for (const batch of store.batches(job.id)) {
      if (batch.status === "confirmed") continue;
      if (autoRetry && batch.attempts >= job.delivery_attempt_limit)
        throw new WorkerError("delivery_retry_limit");
      controller.signal.throwIfAborted();
      store.sending(job, batch.id);
      try {
        await deliverBatch(batch, job, ingestion, controller.signal);
        store.confirm(job, batch.id);
      } catch (error) {
        store.uncertain(
          job,
          batch.id,
          error instanceof WorkerError ? error.code : "delivery_uncertain",
        );
        throw error;
      }
    }
    store.finish(
      job,
      store.job(job.id).rejected ? "completed_partial" : "completed",
    );
  } catch (error) {
    const code =
      error instanceof WorkerError
        ? error.code
        : phase === "delivery"
          ? "delivery_uncertain"
          : "worker_error";
    if (
      autoRetry &&
      phase === "delivery" &&
      !controller.signal.aborted &&
      code !== "ingestion_not_configured"
    )
      store.retryDelivery(job, code);
    else
      store.finish(
        job,
        controller.signal.aborted
          ? "interrupted"
          : phase === "decode"
            ? "needs_review"
            : phase === "delivery"
              ? "delivery_failed"
              : "failed",
        code,
      );
  } finally {
    console.info(
      JSON.stringify({
        event: "job.finished",
        job_id: job.id,
        ...Object.fromEntries(
          Object.entries(store.job(job.id) ?? {}).filter(([key]) =>
            [
              "status",
              "phase",
              "delivered",
              "rejected",
              "error",
              "capture_complete",
            ].includes(key),
          ),
        ),
      }),
    );
    clearInterval(heartbeat);
    signal?.removeEventListener("abort", interrupt);
  }
}
