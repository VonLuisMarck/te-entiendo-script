import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Source { id: string; label: string; portal: string; adapter_version: string | null }
interface Job { id: string; status: string; error: string | null; delivered: number; captures?: number; created_at: number; request: { source_id: string; ubicacion: string; search_urls: string[]; provenance?: string } }
interface Capture { id: string; page_index: number; response_url: string; captured_at: number; body_sha256: string; bytes: number; mime_type: string }
interface Detail { job: Job; captures: Capture[]; preview: Record<string, unknown>[]; preview_error: string | null }
const states: Record<string,string> = { queued:"En cola",running:"Capturando",captured:"Bruto guardado",completed:"Procesado",needs_review:"Revisar adaptador",delivery_failed:"Envío pendiente",interrupted:"Interrumpido",failed:"Error" };
const messages: Record<string,string> = {
  adapter_not_configured:"El bruto está disponible. Configura y valida un adaptador antes de publicar anuncios.",
  no_matching_response:"La página no emitió una respuesta que coincida con la fuente. Revisa sus endpoints y las acciones de búsqueda.",
  schema_changed:"La respuesta ha cambiado de estructura. El bruto se conserva para corregir el adaptador.",
  listing_requires_review:"Hay anuncios con datos incompletos o uso residencial no confirmado. Revisa el bruto.",
  ingestion_not_configured:"Falta configurar el destino de ingesta del worker.",
  ingestion_failed:"El backend no confirmó la ingesta. Puedes volver a enviar los datos guardados.",
  browser_connection_failed:"No se pudo conectar al navegador. Revisa el proceso Chromium y su endpoint CDP.",
  response_not_utf8:"Respuesta binaria guardada. Se necesita un decodificador para interpretar este formato.",
  decoder_not_configured:"El formato necesita un decodificador específico. La respuesta original se conserva.",
  browser_ERR_EMPTY_RESPONSE:"El navegador no ha recibido una respuesta del portal.",
  source_http_403:"El portal ha denegado el acceso. La búsqueda se ha detenido.",
  source_http_429:"El portal ha limitado las peticiones. La búsqueda se ha detenido.",
};
async function worker<T>(body: Record<string,unknown>): Promise<T> {
  const { data, error }=await supabase.functions.invoke('browser-worker',{body});
  if (error) {
    let message=error.message;
    if ('context' in error && error.context instanceof Response) {
      const value=await error.context.json().catch(()=>null);
      message=value?.error ?? message;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export default function Scraper() {
  const client=useQueryClient();
  const [sourceId,setSourceId]=useState(''), [urls,setUrls]=useState(''), [location,setLocation]=useState('');
  const [selected,setSelected]=useState(''), [captureId,setCaptureId]=useState('');
  const [busy,setBusy]=useState(false), [actionError,setActionError]=useState('');
  const sources=useQuery({queryKey:['worker-sources'],queryFn:()=>worker<{sources:Source[]}>({action:'sources'}),retry:false});
  const activeSourceId=sources.data?.sources.find(source=>source.id===sourceId)?.id ?? sources.data?.sources[0]?.id ?? '';
  const jobs=useQuery({queryKey:['worker-jobs'],queryFn:()=>worker<{jobs:Job[]}>({action:'list'}),refetchInterval:5000,retry:false});
  const detail=useQuery({queryKey:['worker-job',selected],queryFn:()=>worker<Detail>({action:'get',job_id:selected}),enabled:!!selected,refetchInterval:5000,retry:false});
  const raw=useQuery({queryKey:['worker-capture',selected,captureId],queryFn:()=>worker<{capture:{body:string;text:string|null;mime_type:string}}>({action:'capture',job_id:selected,capture_id:captureId}),enabled:!!selected&&!!captureId,retry:false});
  const select=(id:string)=>{ setSelected(id);setCaptureId('');setActionError(''); };
  const run=async (replay=false)=>{
    setBusy(true);setActionError('');
    try {
      const result=await worker<{job_id:string}>(replay?{action:'replay',job_id:selected}:{action:'create',source_id:activeSourceId,search_urls:urls.split('\n').map(s=>s.trim()).filter(Boolean),ubicacion:location});
      select(result.job_id);
      await client.invalidateQueries({queryKey:['worker-jobs']});
      await client.invalidateQueries({queryKey:['worker-job',result.job_id]});
    } catch(error) { setActionError(error instanceof Error?error.message:'No se pudo iniciar la búsqueda'); }
    finally { setBusy(false); }
  };
  const error=actionError || sources.error?.message || jobs.error?.message || detail.error?.message || raw.error?.message;
  const job=detail.data?.job;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Búsquedas con navegador</h1><p className="text-muted-foreground">Captura, revisión de respuestas originales y reprocesamiento de anuncios.</p></div>
      <Button variant="outline" asChild><Link to="/dashboard">Volver al panel</Link></Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className="space-y-6 min-w-0">
        <Card><CardHeader><CardTitle>Nueva búsqueda</CardTitle></CardHeader><CardContent>
          <form className="space-y-4" onSubmit={e=>{e.preventDefault();void run();}}>
            <div className="space-y-2"><Label htmlFor="source">Fuente</Label><select id="source" value={activeSourceId} onChange={e=>setSourceId(e.target.value)} className="w-full rounded border bg-background p-2">
              {(sources.data?.sources ?? []).map(source=><option key={source.id} value={source.id}>{source.label}</option>)}
            </select></div>
            <div className="space-y-2"><Label htmlFor="search-urls">URLs de búsqueda</Label><Textarea id="search-urls" required rows={5} value={urls} onChange={e=>setUrls(e.target.value)} placeholder="Pega la URL de resultados del portal"/><p className="text-xs text-muted-foreground">Una URL por línea, hasta cinco. Incluye en cada URL los filtros y la página que quieras revisar.</p></div>
            <div className="space-y-2"><Label htmlFor="location">Etiqueta de zona (opcional)</Label><Input id="location" value={location} maxLength={120} onChange={e=>setLocation(e.target.value)} placeholder="Murcia"/></div>
            <p className="text-sm text-muted-foreground">{sources.data?.sources.find(s=>s.id===activeSourceId)?.adapter_version ? 'Adaptador configurado. Los datos válidos se enviarán al procesamiento.' : 'Solo captura: podrás revisar el bruto antes de configurar la normalización.'}</p>
            <Button type="submit" disabled={busy||!sources.data} className="w-full">{busy?'Solicitando…':'Iniciar búsqueda'}</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Trabajos recientes</CardTitle></CardHeader><CardContent className="space-y-2">
          {jobs.isPending && <p>Cargando trabajos…</p>}
          {jobs.data?.jobs.length===0 && <p className="text-sm text-muted-foreground">Todavía no hay búsquedas.</p>}
          {jobs.data?.jobs.map(item=><button key={item.id} type="button" aria-pressed={selected===item.id} onClick={()=>select(item.id)} className={`w-full rounded border p-3 text-left ${selected===item.id?'border-primary bg-muted':''}`}>
            <span className="block font-medium">{item.request.source_id} · {item.request.ubicacion || 'Búsqueda por URL'}</span>
            <span className="block text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('es-ES')}</span>
            <span className="mt-2 flex flex-wrap justify-between gap-2 text-sm"><span>{states[item.status]??item.status}</span><span>{item.captures ?? 0} capturas</span></span>
          </button>)}
        </CardContent></Card>
      </div>
      <div className="min-w-0 space-y-6">
        {!selected && <Card><CardContent className="py-12 text-center text-muted-foreground">Selecciona un trabajo para revisar sus datos.</CardContent></Card>}
        {job && <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-3">Detalle de la búsqueda <Badge variant="outline">{states[job.status]??job.status}</Badge></CardTitle></CardHeader><CardContent className="space-y-4">
          <p className="break-all text-xs text-muted-foreground">{job.id}</p>
          {job.error && <p role="status">{messages[job.error]??job.error}</p>}
          <p className="text-sm text-muted-foreground">Origen: {job.request.provenance === "har_import" ? "Importación HAR" : "Navegador CDP"}</p>
          <p>{job.delivered} anuncios confirmados en la última ingesta.</p>
          <Button variant="outline" disabled={busy||!['captured','needs_review','delivery_failed','completed'].includes(job.status)} onClick={()=>void run(true)}>Reprocesar bruto guardado</Button>
          <p className="text-xs text-muted-foreground">Reprocesar usa las capturas existentes y el adaptador actual. No vuelve a visitar el portal.</p>
        </CardContent></Card>}
        {detail.data && <Card><CardHeader><CardTitle>Respuestas capturadas</CardTitle></CardHeader><CardContent className="space-y-4">
          {detail.data.captures.length===0 && <p className="text-muted-foreground">Aún no hay respuestas guardadas.</p>}
          {detail.data.captures.map(item=><button type="button" key={item.id} aria-pressed={captureId===item.id} onClick={()=>setCaptureId(item.id)} className="block w-full rounded border p-3 text-left text-sm">
            <span className="block break-all">{item.response_url}</span><span className="text-muted-foreground">Página {item.page_index+1} · {item.mime_type} · {Math.ceil(item.bytes/1024)} KB · {new Date(item.captured_at).toLocaleTimeString('es-ES')}</span>
          </button>)}
          {raw.isFetching && captureId && <p>Cargando bruto…</p>}
          {raw.data && <><h3 className="font-semibold">Respuesta original · {raw.data.capture.mime_type}{raw.data.capture.text === null ? " · Base64" : ""}</h3><pre aria-label="Respuesta original" className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-4 text-xs">{raw.data.capture.text ?? raw.data.capture.body}</pre></>}
        </CardContent></Card>}
        {detail.data && <Card><CardHeader><CardTitle>Vista normalizada</CardTitle></CardHeader><CardContent>
          {detail.data.preview_error && <p>{messages[detail.data.preview_error]??detail.data.preview_error}</p>}
          {detail.data.preview.length>0 && <pre aria-label="Vista normalizada" className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-4 text-xs">{JSON.stringify(detail.data.preview,null,2)}</pre>}
          {!detail.data.preview.length&&!detail.data.preview_error&&<p>No hay anuncios en la respuesta validada.</p>}
        </CardContent></Card>}
      </div>
    </div>
  </main>;
}
