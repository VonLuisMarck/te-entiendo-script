import { serve } from "../_shared/runtime.ts";
import { authorize, cors } from "../_shared/security.ts";
import { createClient } from "@supabase/supabase-js";
serve(async (req) => {
  const denied = await authorize(req, "user");
  if (denied) return denied;
  if (req.method !== "POST")
    return Response.json(
      { error: "Método no permitido" },
      { status: 405, headers: cors },
    );
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const token = req.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error,
    } = await db.auth.getUser(token);
    if (error || !user) throw new Error();
    const body = await req.json();
    if (body.confirmation !== "ELIMINAR")
      return Response.json(
        { error: "Confirmación requerida" },
        { status: 400, headers: cors },
      );
    // Validate a recent sign-in server-side; updating a token alone is insufficient.
    if (
      !user.last_sign_in_at ||
      !Number.isFinite(Date.parse(user.last_sign_in_at)) ||
      Date.now() - Date.parse(user.last_sign_in_at) > 300000
    )
      return Response.json(
        { error: "Vuelve a iniciar sesión antes de eliminar la cuenta" },
        { status: 401, headers: cors },
      );
    const billing = await db
      .from("stripe_customers")
      .select("subscription_status")
      .eq("user_id", user.id);
    if (billing.error) throw billing.error;
    if (
      billing.data?.some((row) =>
        [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
          "paused",
        ].includes(row.subscription_status),
      )
    )
      return Response.json(
        {
          error:
            "Gestiona y cancela primero tu suscripción para evitar cobros posteriores.",
        },
        { status: 409, headers: cors },
      );
    const result = await db.auth.admin.deleteUser(user.id);
    if (result.error) throw result.error;
    return Response.json({ success: true }, { headers: cors });
  } catch {
    return Response.json(
      {
        error:
          "No se completó la eliminación. Contacta con soporte para revisar los datos o archivos pendientes.",
      },
      { status: 503, headers: cors },
    );
  }
});
