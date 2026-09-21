import { serve } from "../_shared/runtime.ts";
import { authorize, cors } from "../_shared/security.ts";
import { createClient } from "@supabase/supabase-js";
serve(async (req) => {
  const denied = await authorize(req, "admin");
  if (denied) return denied;
  if (req.method !== "POST")
    return Response.json(
      { error: "Método no permitido" },
      { status: 405, headers: cors },
    );
  if (Deno.env.get("EMAIL_ENABLED") !== "true")
    return Response.json(
      { error: "Email no habilitado; avisos disponibles en la bandeja" },
      { status: 503, headers: cors },
    );
  const key = Deno.env.get("RESEND_API_KEY"),
    from = Deno.env.get("EMAIL_FROM"),
    origin = Deno.env.get("APP_URL");
  if (!key || !from || !origin)
    return Response.json(
      { error: "Email no configurado" },
      { status: 503, headers: cors },
    );
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const u = new URL(origin);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash
    )
      throw new Error();
    const prepared = await db.rpc("prepare_email_outbox", {
      p_from: from,
      p_app_url: u.origin,
    });
    if (prepared.error) throw prepared.error;
    let accepted = 0,
      uncertain = 0;
    for (let i = 0; i < 10; i++) {
      const claimed = await db.rpc("claim_email_delivery");
      if (claimed.error) throw claimed.error;
      const delivery = claimed.data;
      if (!delivery?.id) break;
      let status = "uncertain",
        providerId: string | null = null;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `findoo/${delivery.id}`,
          },
          body: JSON.stringify(delivery.payload),
        });
        const result = await response.json();
        if (response.ok && typeof result.id === "string") {
          status = "accepted";
          providerId = result.id;
          accepted++;
        } else if (
          response.status >= 400 &&
          response.status < 500 &&
          ![408, 409, 429].includes(response.status)
        )
          status = "failed";
      } catch {
        /* A timeout may follow provider acceptance. Retain the exact request/key. */
      }
      if (status === "uncertain") uncertain++;
      const saved = await db.rpc("finish_email_delivery", {
        p_id: delivery.id,
        p_attempt: delivery.attempts,
        p_status: status,
        p_provider_id: providerId,
      });
      if (saved.error) throw saved.error;
    }
    return Response.json(
      { success: true, accepted, uncertain },
      { headers: cors },
    );
  } catch {
    return Response.json(
      { error: "La outbox conserva los envíos para revisión" },
      { status: 503, headers: cors },
    );
  }
});
