import { authorize, cors } from '../_shared/security.ts';
import { serve } from '../_shared/runtime.ts';

// Legacy implementation lacked atomic quotas, verified recipients and reliable retries.
// Keep the endpoint explicit and closed while the supervised pilot validates the core search.
serve(async req => {
  const denied = await authorize(req, 'user');
  if (denied) return denied;
  return Response.json({ error: 'Esta función todavía no está disponible en el piloto.' }, { status: 503, headers: cors });
});
