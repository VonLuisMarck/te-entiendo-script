import { serve } from "../_shared/runtime.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authorize, cors } from "../_shared/security.ts";
import { scoreProperty, readAll } from "../_shared/matching.ts";
const schema = z.object({
  cliente_id: z.string().uuid().optional(),
  propiedad_id: z.string().uuid().optional(),
  recalcular_todos: z.boolean().optional(),
});
serve(async (req) => {
  const denied = await authorize(req, "admin");
  if (denied) return denied;
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let lock: string | null = null;
  try {
    const input = schema.parse(await req.json());
    const lease = await db.rpc("acquire_processing_lock", {
      p_name: "matching",
      p_seconds: 300,
    });
    if (lease.error) throw lease.error;
    lock = lease.data;
    if (!lock)
      return Response.json(
        { error: "Ya hay un cálculo en marcha" },
        { status: 409, headers: cors },
      );
    if (input.cliente_id) {
      const queued = await db.rpc("queue_matching", {
        p_client: input.cliente_id,
        p_reason: "operator.requested",
      });
      if (queued.error) throw queued.error;
    } else if (input.recalcular_todos || input.propiedad_id) {
      const clients = await db
        .from("clientes")
        .select("id")
        .eq("activo", true)
        .limit(501);
      if (clients.error) throw clients.error;
      if (clients.data.length > 500)
        throw new Error("Solicita recálculo por cliente");
      for (const c of clients.data) {
        const r = await db.rpc("queue_matching", {
          p_client: c.id,
          p_reason: "operator.requested",
        });
        if (r.error) throw r.error;
      }
    }
    const queue = await db
      .from("matching_queue")
      .select("*")
      .order("requested_at")
      .limit(20);
    if (queue.error) throw queue.error;
    let evaluated = 0,
      recommended = 0,
      published = 0,
      stale = 0;
    for (const task of queue.data) {
      const state = await db
        .from("search_state")
        .select("*")
        .eq("cliente_id", task.cliente_id)
        .single();
      if (state.error) throw state.error;
      const client = state.data.snapshot,
        criteria = client.criteria;
      const properties = await readAll(async (after) => {
        let q = db
          .from("propiedades")
          .select("*")
          .eq("activo", true)
          .gte("last_seen", new Date(Date.now() - 7 * 86400000).toISOString())
          .order("id")
          .limit(500);
        if (client.presupuesto_min != null)
          q = q.gte("precio", client.presupuesto_min);
        if (client.presupuesto_max != null)
          q = q.lte(
            "precio",
            client.presupuesto_max *
              (1 + (criteria?.flexibilidad_presupuesto ?? 0) / 100),
          );
        if (after) q = q.gt("id", after);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      }, 5000);
      const matches = properties.map((property) => {
        const result = scoreProperty(client, criteria, property);
        evaluated++;
        if (result.eligible) recommended++;
        return {
          propiedad_id: property.id,
          property_version: property.data_version,
          score: result.score,
          criterios_cumplidos: {
            ...result.checks,
            motivos: result.reasons,
            preferences: result.preferences,
            preference_reasons: result.preferenceReasons,
            completeness: result.completeness,
            age_days: result.age_days,
            version: result.ranking_version,
          },
        };
      });
      const result = await db.rpc("publish_matching", {
        p_client: task.cliente_id,
        p_search_version: state.data.version,
        p_generation: task.generation,
        p_matches: matches,
      });
      if (result.error?.code === "40001") {
        stale++;
        continue;
      }
      if (result.error) throw result.error;
      published++;
    }
    return Response.json(
      {
        success: true,
        status: "completed",
        clientes: published,
        evaluados: evaluated,
        recomendados: recommended,
        recalculo_pendiente: stale,
      },
      { headers: cors },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        component: "matching",
        code:
          error instanceof z.ZodError ? "invalid_input" : "processing_failed",
      }),
    );
    return Response.json(
      {
        success: false,
        error:
          "No se publicó el cálculo. La cola conserva los trabajos pendientes.",
      },
      { status: error instanceof z.ZodError ? 400 : 500, headers: cors },
    );
  } finally {
    if (lock)
      await db.rpc("release_processing_lock", {
        p_name: "matching",
        p_token: lock,
      });
  }
});
