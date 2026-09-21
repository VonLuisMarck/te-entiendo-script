import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { Store } from '../src/store.mjs';
import { runJob } from '../src/runner.mjs';
import { createApi } from '../src/server.mjs';
import { validateJob } from '../src/config.mjs';
import { decodeCapture } from '../src/adapter.mjs';
import { capturesFromHar } from '../src/har.mjs';

let context,server,origin,endpoint,dir;
let callbackStatus=200, deliveries=[];
const item={id:'12345678',href:'/comprar/piso-fixture/',price:132456.78,oldPrice:155000,city:'Murcia',type:'apartment',surface:85,rooms:2,operation:'sale',description:'Vivienda de prueba.',apiOnly:{detail:'No aparece en el DOM'}};
const adapter={version:'fixture-v1',items_path:'data.ads',id_path:'id',url_path:'href',fields:{precio:'price',ciudad:'city',tipo_propiedad:'type',metros:'surface',dormitorios:'rooms',descripcion:'description',operacion:'operation'},value_maps:{operacion:{sale:'venta'}}};
const fixture=()=>({id:'fixture',label:'Synthetic API, not a portal contract',portal:'pisos',navigation_origins:[origin],responses:[{origin,path_prefix:'/api/search'}],adapter});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
before(async()=>{
  dir=mkdtempSync(join(tmpdir(),'inmofinder-cdp-'));
  server=createServer(async(req,res)=>{
    const u=new URL(req.url,'http://fixture');
    if(u.pathname==='/ingest') {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=JSON.parse(Buffer.concat(chunks));deliveries.push({body,secret:req.headers['x-scraper-secret']});
      res.writeHead(callbackStatus,{'content-type':'application/json'});res.end(JSON.stringify({success:callbackStatus===200,propiedades_guardadas_raw:body.propiedades.length}));return;
    }
    if(u.pathname==='/api/search') {
      const mode=u.searchParams.get('mode');
      res.writeHead(mode==='blocked'?429:200,{'content-type':mode==='binary'?'application/octet-stream':mode==='plain'?'text/plain':'application/json'});
      if(mode==='binary'){res.end(Buffer.from([0,255,128,2,3]));return;}
      res.end(mode==='schema'?JSON.stringify({changed:[item]}):mode==='malformed'?'{broken':JSON.stringify({data:{ads:mode==='empty'?[]:[item,item]}}));return;
    }
    if(u.pathname==='/api/analytics'){res.writeHead(200,{'content-type':'application/json'});res.end('{"ignore":"unrelated"}');return;}
    const mode=u.searchParams.get('mode') ?? 'normal';
    res.writeHead(200,{'content-type':'text/html'});
    res.end(`<html><body><h1>Precio resumido: 132.000 €</h1>${mode==='html'?'':`<script>fetch('/api/analytics');fetch('/api/search?mode=${mode}&token=never-persist-this').then(r=>r.text()).then(()=>document.body.dataset.loaded='true');</script>`}</body></html>`);
  });
  origin=await listen(server);
  // Obtain an available loopback debugging port without touching any existing browser.
  const portServer=createServer();await listen(portServer);const port=portServer.address().port;await new Promise(r=>portServer.close(r));
  endpoint=`http://127.0.0.1:${port}`;
  context=await chromium.launchPersistentContext(join(dir,'profile'),{headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args:[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--disable-dev-shm-usage',
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
});
after(async()=>{await context?.close();await new Promise(r=>server?.close(r));rmSync(dir,{recursive:true,force:true});});
async function execute(mode='normal', options={}) {
  const store=options.store ?? new Store(':memory:');
  const source=options.source ?? fixture();
  const request=validateJob({source_id:'fixture',search_urls:[`${origin}/?mode=${mode}`]},[source]);
  const id=store.enqueue(request), job=store.claim(endpoint);
  assert.equal(job.id,id);
  await runJob({store,job,source,endpoint,ingestion:{url:`${origin}/ingest`,secret:'fixture-ingest-secret'},captureOptions:{windowMs:350,quietMs:50}});
  return {store,id,job:store.job(id)};
}
test('real Chromium CDP captures API-only facts, persists exact JSON and sends normalized records',async()=>{
  callbackStatus=200;deliveries=[];
  const path=join(dir,'persistent.sqlite');
  const beforePages=context.pages().length;
  const result=await execute('normal',{store:new Store(path)});
  assert.equal(result.job.status,'completed');assert.equal(result.job.delivered,1);
  assert.equal(context.pages().length,beforePages,'worker closes only its own tab');
  assert.equal((await fetch(`${endpoint}/json/version`)).status,200,'disconnect does not terminate Chrome');
  const captures=result.store.captures(result.id,true);
  assert.equal(captures.length,1);assert.equal(captures[0].response_url,`${origin}/api/search`);
  assert.ok(!captures[0].response_url.includes('token'));
  assert.deepEqual(JSON.parse(Buffer.from(captures[0].body,'base64').toString('utf8')).data.ads,[item,item]);
  assert.equal(deliveries[0].body.propiedades[0].raw_data.normalized.precio,132456.78);
  assert.equal(deliveries[0].body.propiedades[0].raw_data.source_record.apiOnly.detail,'No aparece en el DOM');
  assert.equal(deliveries[0].secret,'fixture-ingest-secret');
  result.store.close();
  const reopened=new Store(path);assert.equal(reopened.captures(result.id,true)[0].body,captures[0].body);reopened.close();
});
test('delivery failure retains raw data; replay uses the saved body without a browser connection',async()=>{
  callbackStatus=503;deliveries=[];
  const {store,id,job}=await execute();assert.equal(job.status,'delivery_failed');
  const original=deliveries[0].body;
  callbackStatus=200;store.replay(id);const lease=store.claim('offline-replay-slot');
  await runJob({store,job:lease,source:fixture(),endpoint:'http://127.0.0.1:1',ingestion:{url:`${origin}/ingest`,secret:'fixture-ingest-secret'}});
  assert.equal(store.job(id).status,'completed');assert.deepEqual(deliveries[1].body,original);assert.equal(store.captures(id).length,1);store.close();
});
test('capture-only source can be mapped and reprocessed after configuration changes',async()=>{
  const source={...fixture(),adapter:null};const {store,id,job}=await execute('normal',{source});
  assert.equal(job.status,'captured');assert.equal(job.delivered,0);store.replay(id);
  const lease=store.claim('replay');
  await runJob({store,job:lease,source:fixture(),endpoint:'http://127.0.0.1:1',ingestion:{url:`${origin}/ingest`,secret:'fixture-ingest-secret'}});
  assert.equal(store.job(id).status,'completed');store.close();
});
test('schema changes and malformed JSON remain reviewable; blocked and HTML-only pages fail explicitly',async()=>{
  for(const [mode,state,error,captures] of [['schema','needs_review','schema_changed',1],['malformed','needs_review','invalid_json',1],['blocked','failed','source_http_429',0],['html','failed','no_matching_response',0]]) {
    const result=await execute(mode);assert.equal(result.job.status,state,mode);assert.equal(result.job.error,error,mode);assert.equal(result.store.captures(result.id).length,captures);result.store.close();
  }
});
test('an explicit empty API list is a valid zero-result search',async()=>{
  const {store,job}=await execute('empty');assert.equal(job.status,'completed');assert.equal(job.delivered,0);store.close();
});
test('capture is format agnostic: JSON served as text and binary bodies retain their bytes',async()=>{
  const plain=await execute('plain');assert.equal(plain.job.status,'completed');assert.equal(plain.store.captures(plain.id)[0].mime_type,'text/plain');plain.store.close();
  const binary=await execute('binary');assert.equal(binary.job.status,'needs_review');
  const capture=binary.store.captures(binary.id,true)[0];assert.equal(capture.mime_type,'application/octet-stream');
  assert.deepEqual(Buffer.from(capture.body,'base64'),Buffer.from([0,255,128,2,3]));binary.store.close();
});
test('HAR import preserves response bytes, excludes request credentials and rejects missing bodies',()=>{
  const entry={_resourceType:'fetch',request:{url:`${origin}/api/search?token=private`,headers:[{name:'Authorization',value:'secret'}],cookies:[{name:'session',value:'secret'}]},response:{status:200,content:{mimeType:'application/octet-stream',encoding:'base64',text:Buffer.from([0,255,2]).toString('base64')}}};
  const captures=capturesFromHar({log:{entries:[entry]}},fixture());assert.equal(captures.length,1);
  assert.deepEqual(Buffer.from(captures[0].body,'base64'),Buffer.from([0,255,2]));assert.equal(captures[0].response_url,`${origin}/api/search`);
  assert.ok(!JSON.stringify(captures).includes('secret'));assert.ok(!JSON.stringify(captures).includes('token='));
  assert.throws(()=>capturesFromHar({log:{entries:[{...entry,response:{status:200,content:{mimeType:'text/plain'}}}]}},fixture()),/har_response_body_missing/);
});
test('missing identity, wrong host, commercial use and invalid numeric values cannot be ingested',()=>{
  for(const change of [{id:null},{href:'https://attacker.example/listing'},{description:'Local comercial en venta. Cambio de uso pendiente.'},{price:true},{price:'100.000 €'}]) {
    assert.throws(()=>decodeCapture(JSON.stringify({data:{ads:[{...item,...change}]}}),fixture()));
  }
});
test('queue survives restarts, deduplicates active jobs, leases browsers exclusively and fences stale owners',()=>{
  const path=join(dir,'queue.sqlite'),store=new Store(path),request=validateJob({source_id:'fixture',search_urls:[origin]},[fixture()]);
  const id=store.enqueue(request);assert.equal(store.enqueue(request),id);store.close();
  const fresh=new Store(path),first=fresh.claim('browser-A');assert.equal(first.id,id);
  const secondId=fresh.enqueue({...request,ubicacion:'second'});assert.equal(fresh.claim('browser-A'),null);
  const second=fresh.claim('browser-B');assert.equal(second.id,secondId);
  fresh.recover(Date.now()+100000);
  assert.equal(fresh.job(id).status,'interrupted');assert.throws(()=>fresh.addCapture(first,{body:'{}',page_index:0,response_url:origin}),/lease_lost/);
  assert.equal(fresh.finish(first,'completed'),false);assert.throws(()=>fresh.replay(id),/capture_incomplete/);fresh.close();
});
test('authenticated API validates navigation URLs and isolates raw capture access',async()=>{
  const store=new Store(':memory:'),api=createApi({store,sources:[fixture()],apiKey:'fixture-worker-secret'}),url=await listen(api);
  const headers={authorization:'Bearer fixture-worker-secret','content-type':'application/json'};
  try {
    assert.equal((await fetch(`${url}/health`)).status,200);assert.equal((await fetch(`${url}/jobs`)).status,401);
    assert.equal((await fetch(`${url}/jobs`,{method:'POST',headers,body:JSON.stringify({source_id:'fixture',search_urls:['http://169.254.169.254/']})})).status,400);
    const response=await fetch(`${url}/jobs`,{method:'POST',headers,body:JSON.stringify({source_id:'fixture',search_urls:[origin]})});
    assert.equal(response.status,202);const job=await response.json();
    assert.equal((await fetch(`${url}/jobs/${job.job_id}`,{headers})).status,200);
    assert.equal((await fetch(`${url}/jobs/${job.job_id}/captures/${'a'.repeat(64)}`,{headers})).status,404);
    const badUrl=new URL(origin);badUrl.username='secret';assert.throws(()=>validateJob({source_id:'fixture',search_urls:[badUrl.href]},[fixture()]));
  } finally {await new Promise(r=>api.close(r));store.close();}
});
