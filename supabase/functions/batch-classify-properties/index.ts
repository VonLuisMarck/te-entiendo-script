import { serve } from '../_shared/runtime.ts';
import { createClient } from '@supabase/supabase-js';
import { authorize, cors } from '../_shared/security.ts';
import { normalizeListing } from '../_shared/listing.ts';

serve(async req => {
  const denied = await authorize(req, 'admin'); if (denied) return denied;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let lock: string | null = null;
  try {
    const { batch_size = 50, max_intentos = 3 } = await req.json();
    if (!Number.isInteger(batch_size) || batch_size < 1 || batch_size > 100 || !Number.isInteger(max_intentos) || max_intentos < 1 || max_intentos > 5) return Response.json({ error: 'Tamaño de lote o intentos inválidos' }, { status: 400, headers: cors });
    const lease = await db.rpc('acquire_processing_lock', { p_name: 'batch', p_seconds: 300 });
    if (lease.error) throw lease.error;
    lock = lease.data;
    if (!lock) return Response.json({ error: 'Ya hay un lote en marcha' }, { status: 409, headers: cors });
    const { data: rows, error } = await db.from('propiedades_raw').select('*').eq('procesado', false)
      .lt('intentos_procesamiento', max_intentos).order('created_at').order('id').limit(batch_size);
    if (error) throw error;
    let successful = 0;
    const errors: { external_id: string; error: string }[] = [];
    const start = Date.now();
    for (const row of rows ?? []) {
      try {
        const normalized = normalizeListing(row);
        const result = await db.rpc('complete_raw_property', { p_id: row.id, p_updated_at: row.updated_at, p_property: normalized });
        if (result.error) throw result.error;
        successful++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar la propiedad';
        errors.push({ external_id: row.external_id, error: message });
        // Optimistic concurrency: never overwrite a newer source version's state.
        const failure = await db.from('propiedades_raw').update({ intentos_procesamiento: row.intentos_procesamiento + 1, error_procesamiento: message })
          .eq('id', row.id).eq('updated_at', row.updated_at);
        if (failure.error) throw failure.error;
      }
    }
    const log = await db.from('batch_processing_logs').insert({ total_propiedades: rows?.length ?? 0, propiedades_exitosas: successful,
      propiedades_fallidas: errors.length, duracion_segundos: Math.ceil((Date.now()-start)/1000), coste_estimado_usd: 0, errores: errors.length ? errors : null });
    if (log.error) throw log.error;
    return Response.json({ success: errors.length === 0, total: rows?.length ?? 0, exitosas: successful, fallidas: errors.length,
      coste_estimado_usd: 0, duracion_segundos: Math.ceil((Date.now()-start)/1000), errores: errors, message: 'Procesamiento de datos de origen completado' }, { headers: cors });
  } catch (error) { console.error('[batch]', error); return Response.json({ success: false, error: 'No se completó el lote' }, { status: 500, headers: cors }); }
  finally { if (lock) await db.rpc('release_processing_lock', { p_name: 'batch', p_token: lock }); }
});
