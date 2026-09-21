// Authentication happens before business logic, including when verify_jwt=false.
// Fetch/env injection keeps these checks testable without a live Supabase project.
export type Env = (name: string) => string | undefined;
export type Access = 'admin' | 'user' | 'scraper' | 'twilio' | 'elevenlabs';
export const runtimeEnv: Env = (name) => (globalThis as any).Deno.env.get(name);
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-scraper-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: cors });
}
export function equalSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const a = new TextEncoder().encode(actual), b = new TextEncoder().encode(expected);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}
async function hmac(secret: string, data: string, hash: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
export async function verifyTwilio(req: Request, env: Env): Promise<boolean> {
  const token = env('TWILIO_AUTH_TOKEN'), url = env('TWILIO_ADMIN_WEBHOOK_URL');
  if (!token || !url || !req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) return false;
  const params = new URLSearchParams(await req.clone().text());
  let data = url;
  for (const key of [...new Set(params.keys())].sort()) {
    for (const value of [...new Set(params.getAll(key))].sort()) data += key + value;
  }
  const signature = btoa(String.fromCharCode(...await hmac(token, data, 'SHA-1')));
  return equalSecret(req.headers.get('x-twilio-signature'), signature);
}
export async function verifyElevenLabs(req: Request, env: Env, now = Date.now()): Promise<boolean> {
  const secret = env('ELEVENLABS_WEBHOOK_SECRET');
  if (!secret) return false;
  const parts = (req.headers.get('elevenlabs-signature') ?? '').split(',').map(p => p.trim());
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const bytes = await hmac(secret, `${timestamp}.${await req.clone().text()}`, 'SHA-256');
  const expected = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return parts.filter(p => p.startsWith('v0=')).some(p => equalSecret(p.slice(3), expected));
}
export async function authorize(
  req: Request, access: Access, env: Env = runtimeEnv, fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!['POST', 'GET'].includes(req.method)) return jsonError(405, 'Método no permitido');
  try {
    if (access === 'twilio') return await verifyTwilio(req, env) ? null : jsonError(401, 'Firma inválida');
    if (access === 'elevenlabs') return await verifyElevenLabs(req, env) ? null : jsonError(401, 'Firma inválida');
    // The scraper secret can ingest listings only. It never authorizes admin actions.
    if (access === 'scraper') return equalSecret(req.headers.get('x-scraper-secret'), env('SCRAPER_SECRET'))
      ? null : jsonError(401, 'Credenciales de scraper inválidas');
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return jsonError(401, 'Inicia sesión para continuar');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY'), url = env('SUPABASE_URL');
    if (!url || !serviceKey) return jsonError(503, 'Autenticación no configurada');
    if (access === 'admin' && equalSecret(token, serviceKey)) return null;
    const userResponse = await fetcher(`${url}/auth/v1/user`, {
      headers: { apikey: env('SUPABASE_ANON_KEY') || serviceKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return jsonError(userResponse.status >= 500 ? 503 : 401, 'No se pudo verificar la sesión');
    const user = await userResponse.json();
    if (typeof user.id !== 'string') return jsonError(401, 'Sesión inválida');
    if (access === 'user') return null;
    const roles = await fetcher(`${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(10000),
    });
    if (!roles.ok) return jsonError(503, 'No se pudieron verificar los permisos');
    const rows = await roles.json();
    return Array.isArray(rows) && rows.some(r => r.role === 'admin') ? null : jsonError(403, 'Se requiere administrador');
  } catch {
    return jsonError(503, 'No se pudo verificar la autorización');
  }
}
