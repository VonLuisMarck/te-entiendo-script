import { authorize, cors } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
serve(async req => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  return Response.json({error:'Generación de imágenes retirada. Usa imágenes propias del catálogo.'},{status:410,headers:cors});
});
