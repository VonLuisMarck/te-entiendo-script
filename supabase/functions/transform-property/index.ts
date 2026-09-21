import { authorize, cors } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { normalizeListing } from "../_shared/listing.ts";

serve(async req => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  if (req.method === 'OPTIONS') return new Response(null, {headers: cors});
  try {
    const body = await req.json();
    const row = body.propiedad ?? body;
    if (!row.external_id || !row.portal_origen || !row.url || !row.raw_data || typeof row.raw_data !== 'object') {
      return Response.json({error:'Se requiere un anuncio con identidad y raw_data JSON estructurado'}, {status:400,headers:cors});
    }
    return Response.json({success:true,propiedad:normalizeListing(row)}, {headers:cors});
  } catch {
    return Response.json({success:false,error:'Datos no verificables: revisar captura y adaptador'}, {status:422,headers:cors});
  }
});
