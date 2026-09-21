import { authorize, cors } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
serve(async req => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  return Response.json({success:false,error:'Los triggers por ciudad se han retirado. Usa búsquedas con URLs explícitas en el panel de navegador.'},{status:410,headers:cors});
});
