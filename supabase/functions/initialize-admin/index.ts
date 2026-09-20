import { serve } from "../_shared/runtime.ts";
import { cors } from "../_shared/security.ts";

// Bootstrap is an operator SQL action. Never create an account with shared credentials.
serve((req) => req.method === 'OPTIONS'
  ? new Response(null, { headers: cors })
  : Response.json({ error: 'Inicialización HTTP deshabilitada. Usa el procedimiento de administración documentado.' },
      { status: 410, headers: cors }));
