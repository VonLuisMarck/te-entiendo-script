import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { authorize, verifyTwilio, verifyElevenLabs } from '../supabase/functions/_shared/security.ts';
const values = { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'public-key', SUPABASE_SERVICE_ROLE_KEY: 'private-service', SCRAPER_SECRET: 'scraper-secret', TWILIO_AUTH_TOKEN: 'fixture-token', TWILIO_ADMIN_WEBHOOK_URL: 'https://fixture.invalid/twilio', ELEVENLABS_WEBHOOK_SECRET: 'fixture-eleven' };
const env = (name: string) => values[name];
const req = (token?: string) => new Request('https://fixture.invalid/action', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
const fetcher = (admin: boolean) => (async (url: string) => Response.json(url.includes('/auth/') ? { id: 'user-a' } : admin ? [{ role: 'admin' }] : [])) as typeof fetch;
test('anonymous and normal users cannot call administrative functions', async () => {
 assert.equal((await authorize(req(), 'admin', env, fetcher(false)))?.status, 401);
 assert.equal((await authorize(req('user-token'), 'admin', env, fetcher(false)))?.status, 403);
 assert.equal(await authorize(req('admin-token'), 'admin', env, fetcher(true)), null);
});
test('service credential is matched exactly; public/forged JWT is not trusted', async () => {
 const reject = (async () => new Response(null, { status: 401 })) as typeof fetch;
 assert.equal(await authorize(req('private-service'), 'admin', env, reject), null);
 assert.equal((await authorize(req('public-key'), 'admin', env, reject))?.status, 401);
 assert.equal((await authorize(req('forged.jwt.claims'), 'admin', env, reject))?.status, 401);
 assert.equal((await authorize(req('private-service'), 'user', env, reject))?.status, 401);
});
test('scraper secret only authorizes its webhook; missing configuration fails closed', async () => {
 const webhook = new Request('https://fixture.invalid', { method: 'POST', headers: { 'x-scraper-secret': 'scraper-secret' } });
 assert.equal(await authorize(webhook, 'scraper', env), null);
 assert.equal((await authorize(webhook, 'admin', env))?.status, 401);
 assert.equal((await authorize(webhook, 'scraper', () => undefined))?.status, 401);
});
test('authentication outage is not interpreted as an authorized session', async () => {
 const broken = (async () => { throw new Error('network'); }) as typeof fetch;
 assert.equal((await authorize(req('user'), 'admin', env, broken))?.status, 503);
});
test('Twilio verifies URL and all fields; spoofing From is insufficient', async () => {
 const body = new URLSearchParams({ From: 'whatsapp:+34000000000', Body: 'estado' });
 const data = values.TWILIO_ADMIN_WEBHOOK_URL + 'BodyestadoFromwhatsapp:+34000000000';
 const signature = createHmac('sha1', values.TWILIO_AUTH_TOKEN).update(data).digest('base64');
 const request = new Request(values.TWILIO_ADMIN_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature }, body });
 assert.equal(await verifyTwilio(request, env), true);
 body.set('Body', 'activar');
 assert.equal(await verifyTwilio(new Request(request.url, { method: 'POST', headers: request.headers, body }), env), false);
});
test('ElevenLabs rejects modified and stale signatures', async () => {
 const timestamp = 1800000000, body = '{"event":"conversation.ended"}';
 const sig = createHmac('sha256', values.ELEVENLABS_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
 const request = new Request('https://fixture.invalid', { method: 'POST', headers: { 'elevenlabs-signature': `t=${timestamp},v0=${sig}` }, body });
 assert.equal(await verifyElevenLabs(request, env, timestamp * 1000), true);
 assert.equal(await verifyElevenLabs(request, env, (timestamp + 301) * 1000), false);
});
