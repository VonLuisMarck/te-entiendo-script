import { serve } from '../_shared/runtime.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authorize, cors } from '../_shared/security.ts';
import { scoreProperty, readAll } from '../_shared/matching.ts';

const schema = z.object({ cliente_id: z.string().uuid().optional(), propiedad_id: z.string().uuid().optional(), recalcular_todos: z.boolean().optional() });
serve(async req => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let lock: string | null = null;
  try {
    const input = schema.parse(await req.json());
    const lease = await db.rpc('acquire_processing_lock', { p_name: 'matching', p_seconds: 300 });
    if (lease.error) throw lease.error;
    lock = lease.data;
    if (!lock) return Response.json({ error: 'Ya hay un cálculo en marcha' }, { status: 409, headers: cors });
    const fetchAll = (table: string, columns: string, filter?: string) => readAll(async after => {
      let q = db.from(table).select(columns).eq('activo', true).order('id').limit(500);
      if (filter) q = q.eq('id', filter);
      if (after) q = q.gt('id', after);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    });
    const clients = await fetchAll('clientes', 'id,perfil,presupuesto_min,presupuesto_max,criterios_busqueda(*)', input.cliente_id);
    const properties = await fetchAll('propiedades', '*', input.propiedad_id);
    if (clients.length * properties.length > 50000) return Response.json({ error: 'Ejecuta el cálculo por cliente (más de 50.000 comparaciones)' }, { status: 413, headers: cors });
    let evaluated = 0, recommended = 0;
    for (const client of clients) {
      const criteria = [...(client.criterios_busqueda ?? [])].sort((a,b) =>
        String(b.updated_at ?? b.created_at).localeCompare(String(a.updated_at ?? a.created_at)) || String(b.id).localeCompare(String(a.id)))[0];
      const matches = properties.map(property => {
        const result = scoreProperty(client, criteria, property);
        evaluated++; if (result.eligible) recommended++;
        return { cliente_id: client.id, propiedad_id: property.id, score: result.score,
          criterios_cumplidos: { ...result.checks, motivos: result.reasons, version: 'criteria-v1' },
          analisis_mercado: { disponible: false } };
      });
      // Persist zero scores too: old recommendations disappear after criteria change.
      // Keep seen/favorite/notified state across recalculations.
      for (let i=0; i<matches.length; i+=100) {
        const { error } = await db.from('matchings').upsert(matches.slice(i,i+100), { onConflict: 'cliente_id,propiedad_id' });
        if (error) throw error;
      }
    }
    return Response.json({ success: true, status: 'completed', clientes: clients.length, propiedades: properties.length, evaluados: evaluated, recomendados: recommended }, { headers: cors });
  } catch (error) {
    console.error('[matching]', error);
    return Response.json({ success: false, error: 'No se completó el cálculo. Puedes reintentarlo.' }, { status: error instanceof z.ZodError ? 400 : 500, headers: cors });
  } finally {
    if (lock) await db.rpc('release_processing_lock', { p_name: 'matching', p_token: lock });
  }
});
