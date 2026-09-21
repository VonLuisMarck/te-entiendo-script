import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Store } from './store.mjs';
import { loadSources, validateJob } from './config.mjs';
import { runJob } from './runner.mjs';

// A bounded live diagnostic with its own browser/profile. Does not ingest or contact advertisers.
const {values}=parseArgs({options:{source:{type:'string'},url:{type:'string'}}});
const sources=loadSources(resolve(process.env.SOURCES_FILE ?? 'sources.example.json'));
const request=validateJob({source_id:values.source,search_urls:[values.url]},sources);
const source={...sources.find(s=>s.id===request.source_id),adapter:null};
const port=Number(process.env.CDP_PORT ?? 9239);
mkdirSync('data',{recursive:true,mode:0o700});
const store=new Store('data/inspect.sqlite');
const context=await chromium.launchPersistentContext(resolve('data/inspect-browser'),{
  executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,headless:process.env.HEADLESS !== 'false',
  args:[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--disable-dev-shm-usage'],
});
try {
  const id=store.enqueue(request), endpoint=`http://127.0.0.1:${port}`;
  const job=store.claim(endpoint);
  if (!job || job.id !== id) throw new Error('inspection_queue_busy');
  await runJob({store,job,source,endpoint,ingestion:{}});
  console.log(JSON.stringify({job:store.job(id),captures:store.captures(id)},null,2));
  if (store.job(id).status !== 'captured') process.exitCode=1;
} finally { await context.close();store.close(); }
