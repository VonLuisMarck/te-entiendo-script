import { authorize, cors } from '../_shared/security.ts';
import { serve } from '../_shared/runtime.ts';

// The browser client never receives the worker credential or the CDP endpoint.
serve(async req => {
  const denied=await authorize(req,'admin');
  if (denied) return denied;
  if (req.method === 'OPTIONS') return new Response(null,{headers:cors});
  if (req.method !== 'POST') return Response.json({error:'Método no permitido'},{status:405,headers:cors});
  try {
    const key=Deno.env.get('SCRAPER_API_KEY'), endpoint=Deno.env.get('BROWSER_WORKER_URL');
    if (!key || !endpoint) return Response.json({error:'Configura BROWSER_WORKER_URL y SCRAPER_API_KEY'},{status:503,headers:cors});
    const base=new URL(endpoint);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('invalid_worker_origin');
    const body=await req.json();
    const {action,job_id,capture_id}=body;
    if (job_id && !/^[a-f0-9-]{36}$/.test(job_id)) return Response.json({error:'Job inválido'},{status:400,headers:cors});
    if (capture_id && !/^[a-f0-9]{64}$/.test(capture_id)) return Response.json({error:'Captura inválida'},{status:400,headers:cors});
    const paths:Record<string,string>={sources:'/sources',list:'/jobs',create:'/jobs'};
    if (job_id) { paths.get=`/jobs/${job_id}`; paths.replay=`/jobs/${job_id}/replay`; if(capture_id) paths.capture=`/jobs/${job_id}/captures/${capture_id}`; }
    const path=paths[action];
    if (!path) return Response.json({error:'Acción inválida'},{status:400,headers:cors});
    const post=action==='create' || action==='replay';
    const response=await fetch(new URL(path,base),{method:post?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      ...(post?{body:JSON.stringify(action==='create'?{source_id:body.source_id,search_urls:body.search_urls,ubicacion:body.ubicacion}:{})}:{})});
    return new Response(await response.text(),{status:response.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  } catch { return Response.json({error:'No se pudo consultar el worker'},{status:502,headers:cors}); }
});
