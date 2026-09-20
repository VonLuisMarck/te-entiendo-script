import { serve } from "../_shared/runtime.ts";
import { authorize, cors } from "../_shared/security.ts";
serve(async req => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  return Response.json({ success: false, error: 'Programación automática pendiente de configurar. Ningún horario ha sido modificado.' }, { status: 501, headers: cors });
});
