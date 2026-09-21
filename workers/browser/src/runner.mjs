import { captureSearch } from './capture.mjs';
import { previewCaptures } from './adapter.mjs';
import { WorkerError } from './config.mjs';

export async function deliver(records, job, { url, secret, fetcher = fetch }, signal) {
  if (!url || !secret) throw new WorkerError('ingestion_not_configured');
  let delivered = 0;
  const batches = [];
  let batch = [], bytes = 0;
  for (const record of records) {
    const size = Buffer.byteLength(JSON.stringify(record));
    if (batch.length && (batch.length >= 50 || bytes + size > 500000)) { batches.push(batch); batch=[]; bytes=0; }
    batch.push(record); bytes += size;
  }
  if (batch.length) batches.push(batch);
  for (const propiedades of batches) {
    const response = await fetcher(url, { method:'POST', redirect:'error',
      signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { 'content-type':'application/json','x-scraper-secret':secret },
      body: JSON.stringify({ propiedades, metadata: { portal: job.request.portal, ubicacion: job.request.ubicacion, total_encontradas: propiedades.length } }) });
    if (!response.ok) throw new WorkerError('ingestion_failed');
    const result = await response.json();
    if (result.success !== true || result.propiedades_guardadas_raw !== propiedades.length) throw new WorkerError('ingestion_not_confirmed');
    delivered += propiedades.length;
  }
  return delivered;
}
export async function runJob({ store, job, source, endpoint, ingestion, signal, captureOptions = {} }) {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  signal?.addEventListener('abort',interrupt,{once:true});
  if (signal?.aborted) controller.abort();
  const heartbeat = setInterval(() => { try { store.heartbeat(job); } catch { controller.abort(); } },10000);
  let phase = 'capture';
  try {
    if (!source) throw new WorkerError('source_removed');
    if (job.kind !== 'replay') await captureSearch({ ...captureOptions, endpoint, source, urls:job.request.search_urls,
      signal:controller.signal, onCapture: capture => store.addCapture(job,capture) });
    if (!source.adapter) { store.finish(job,'captured','adapter_not_configured'); return; }
    phase = 'decode';
    const records = previewCaptures(store.captures(job.id,true),source);
    phase = 'delivery';
    const delivered = records.length ? await deliver(records,job,ingestion,controller.signal) : 0;
    store.finish(job,'completed',null,delivered);
  } catch (error) {
    const state = controller.signal.aborted ? 'interrupted' : phase === 'decode' ? 'needs_review' : phase === 'delivery' ? 'delivery_failed' : 'failed';
    store.finish(job,state,error instanceof WorkerError ? error.code : 'worker_error');
  } finally { clearInterval(heartbeat); signal?.removeEventListener('abort',interrupt); }
}
