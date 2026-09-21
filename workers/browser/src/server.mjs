import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { WorkerError, loadSources, validateJob } from './config.mjs';
import { previewCaptures, responseText } from './adapter.mjs';
import { runJob } from './runner.mjs';

function authenticated(header, key) {
  if (!key) return false;
  const expected = Buffer.from(`Bearer ${key}`), actual = Buffer.from(header ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function readJson(request) {
  const chunks=[]; let size=0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new WorkerError('request_too_large',413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new WorkerError('invalid_json',400); }
}
export function createApi({ store, sources, apiKey }) {
  const server = createServer(async (request, response) => {
    const send = (status,value) => { response.writeHead(status, { 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff' }); response.end(JSON.stringify(value)); };
    try {
      const path = new URL(request.url,'http://worker.local').pathname;
      if (path === '/health' && request.method === 'GET') return send(200,{ status:'ok',configured:!!apiKey, storage:'sqlite' });
      if (!apiKey) throw new WorkerError('worker_not_configured',503);
      if (!authenticated(request.headers.authorization,apiKey)) throw new WorkerError('unauthorized',401);
      if (path === '/sources' && request.method === 'GET') return send(200,{ sources:sources.map(({id,label,portal,adapter}) => ({id,label,portal,adapter_version:adapter?.version ?? null})) });
      if (path === '/jobs' && request.method === 'GET') return send(200,{ jobs:store.jobs() });
      if (['/jobs','/scrape'].includes(path) && request.method === 'POST') {
        const input = await readJson(request);
        const job = validateJob({...input,source_id:input.source_id ?? input.portal},sources);
        const job_id = store.enqueue(job);
        return send(202,{success:true,job_id,status:store.job(job_id).status});
      }
      const match = path.match(/^\/jobs\/([a-f0-9-]{36})(?:\/(replay|captures)(?:\/([a-f0-9]{64}))?)?$/);
      if (!match) throw new WorkerError('not_found',404);
      const [,id,action,captureId] = match, job = store.job(id);
      if (!job) throw new WorkerError('job_not_found',404);
      if (request.method === 'POST' && action === 'replay' && !captureId) { store.replay(id); return send(202,{success:true,job_id:id}); }
      if (request.method === 'GET' && action === 'captures' && captureId) {
        const capture = store.capture(id,captureId);
        if (!capture) throw new WorkerError('capture_not_found',404);
        let text=null;
        try { const value=responseText(capture); if (!/[\x00-\x08\x0e-\x1f]/.test(value)) text=value; } catch { /* Binary remains downloadable as base64. */ }
        return send(200,{capture:{...capture,text}});
      }
      if (request.method === 'GET' && !action) {
        const source = sources.find(s => s.id === job.request.source_id);
        let preview=[], preview_error=null;
        try { preview=previewCaptures(store.captures(id,true),source).slice(0,20).map(({raw_data,...row})=>({...row,...raw_data.normalized})); }
        catch (error) { preview_error = error instanceof WorkerError ? error.code : 'source_removed'; }
        return send(200,{job,captures:store.captures(id),preview,preview_error});
      }
      throw new WorkerError('method_not_allowed',405);
    } catch (error) { send(error instanceof WorkerError ? error.status : 500,{error:error instanceof WorkerError ? error.code : 'worker_error'}); }
  });
  server.requestTimeout=15000;
  server.headersTimeout=10000;
  return server;
}
export function startPool({ store,sources,endpoints,ingestion }) {
  const active = new Map(), controller = new AbortController();
  const tick = () => {
    if (controller.signal.aborted) return;
    try {
      store.recover();
      for (const endpoint of endpoints) {
        if (active.has(endpoint)) continue;
        const job = store.claim(endpoint);
        if (!job) continue;
        const task = runJob({store,job,endpoint,source:sources.find(s=>s.id===job.request.source_id),ingestion,signal:controller.signal})
          .catch(()=>{ store.finish(job,'failed','worker_error'); }).finally(()=>active.delete(endpoint));
        active.set(endpoint,task);
      }
    } catch { console.error('worker_tick_failed'); }
  };
  const timer=setInterval(tick,1000), cleanup=setInterval(()=>store.prune(),3600000);
  tick();
  return async () => { clearInterval(timer); clearInterval(cleanup); controller.abort(); await Promise.allSettled(active.values()); };
}
async function main() {
  process.umask(0o077);
  const apiKey=process.env.SCRAPER_API_KEY;
  if (!apiKey || apiKey.length < 24) throw new WorkerError('SCRAPER_API_KEY_must_have_at_least_24_characters',503);
  const endpoints=[...new Set((process.env.CDP_ENDPOINTS ?? 'http://127.0.0.1:9222').split(',').map(s=>s.trim()))];
  if (!endpoints.length || endpoints.length > 4) throw new WorkerError('invalid_browser_pool',503);
  for (const endpoint of endpoints) {
    const u = new URL(endpoint);
    if (!['http:','https:','ws:','wss:'].includes(u.protocol) || u.username || u.password) throw new WorkerError('invalid_cdp_endpoint',503);
    if (['http:','ws:'].includes(u.protocol) && !['127.0.0.1','localhost','[::1]'].includes(u.hostname)) throw new WorkerError('unencrypted_cdp_requires_loopback',503);
  }
  const sources=loadSources(resolve(process.env.SOURCES_FILE ?? 'sources.local.json'));
  const db=resolve(process.env.WORKER_DB ?? 'data/worker.sqlite');
  mkdirSync(dirname(db),{recursive:true,mode:0o700});
  const store=new Store(db); chmodSync(db,0o600);
  let ingestion={};
  if (process.env.SUPABASE_URL) {
    const base=new URL(process.env.SUPABASE_URL);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new WorkerError('invalid_ingestion_origin',503);
    ingestion={url:new URL('/functions/v1/scraping-service',base).href,secret:process.env.SCRAPER_SECRET};
  }
  const server=createApi({store,sources,apiKey});
  const stop=startPool({store,sources,endpoints,ingestion});
  server.listen(Number(process.env.PORT ?? 8000),process.env.HOST ?? '127.0.0.1',()=>console.log('browser_worker_ready'));
  const close=async()=>{ server.close(); await stop(); store.close(); };
  process.once('SIGTERM',close); process.once('SIGINT',close);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error instanceof WorkerError ? error.code : 'worker_start_failed');process.exitCode=1;});
