import { authorize, cors } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
serve(async (req) => {
  const denied = await authorize(req, "twilio");
  if (denied) return denied;
  return Response.json(
    {
      error:
        "Función pausada hasta validar permisos, destinatarios, presupuestos y utilidad en el piloto.",
    },
    { status: 503, headers: cors },
  );
});
