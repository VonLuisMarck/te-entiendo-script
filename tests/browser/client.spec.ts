import { test, expect, type Page } from '@playwright/test';

const uid = '00000000-0000-4000-8000-000000000001';
const cid = '00000000-0000-4000-8000-000000000010';
const mid = '00000000-0000-4000-8000-000000000020';
const user = { id: uid, email: 'cliente@example.test', aud: 'authenticated', role: 'authenticated',
  app_metadata: {}, user_metadata: { nombre: 'Cliente' }, created_at: new Date().toISOString() };

async function fixture(page: Page, signedIn = true) {
  const unexpected: string[] = [], writes: { path: string; method: string; body: any }[] = [];
  let favorite = false, profileCalls = 0;
  const customer = { id: cid, perfil: 'vivir', telefono: '+34612345678', presupuesto_min: 100000, presupuesto_max: 220000 };
  const criteria = { id: '00000000-0000-4000-8000-000000000030', cliente_id: cid, ubicaciones: ['Madrid'],
    flexibilidad_presupuesto: 0, banos_min: 2, dormitorios_min: 2, tiene_ascensor: true, tipo_propiedad: ['Piso'] };
  if (signedIn) {
    const token = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'fixture'].join('.');
    await page.addInitScript(session => localStorage.setItem('sb-fixture-auth-token', JSON.stringify(session)), {
      access_token: token, token_type: 'bearer', refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user,
    });
  }
  await page.route('https://fixture.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') return reply({});
    if (path === '/auth/v1/user') return reply(user);
    if (path === '/auth/v1/signup') return reply({ ...user, confirmation_sent_at: new Date().toISOString() });
    if (path === '/functions/v1/check-subscription') return reply({ subscribed: false, tier: 'free', billing_enabled: false });
    if (path === '/rest/v1/rpc/ensure_cliente_profile') { profileCalls++; return reply(cid); }
    if (path === '/rest/v1/clientes' || path === '/rest/v1/criterios_busqueda') {
      const value = path.endsWith('clientes') ? customer : criteria;
      if (method === 'PATCH' || method === 'POST') {
        const body = req.postDataJSON(); writes.push({ path, method, body }); Object.assign(value, body);
      }
      return reply(req.headers()['accept']?.includes('object+json') ? value : [value]);
    }
    if (path === '/rest/v1/matchings') {
      if (method === 'PATCH') { favorite = req.postDataJSON().favorito; writes.push({ path, method, body: req.postDataJSON() }); return reply([{ id: mid }]); }
      expect(url.searchParams.get('cliente_id')).toBe(`eq.${cid}`);
      expect(url.searchParams.get('propiedad.activo')).toBe('eq.true');
      expect(url.searchParams.get('propiedad.last_seen')).toMatch(/^gte\./);
      return reply(url.searchParams.get('favorito') && !favorite ? [] : [{ id: mid, favorito: favorite, score: 100,
        criterios_cumplidos: { presupuesto: true, ubicacion: true }, propiedad: {
          id: '00000000-0000-4000-8000-000000000040', titulo: 'Piso de prueba en Madrid', precio: 190000,
          ubicacion: 'Madrid', metros: 90, dormitorios: 2, banos: 2, url: 'https://www.pisos.com/fixture',
          imagenes: [], activo: true, portal_origen: 'pisos', last_seen: new Date().toISOString(),
        } }]);
    }
    unexpected.push(`${method} ${path}`); return reply({ error: 'Unexpected request in fixture' }, 500);
  });
  return { writes, unexpected, profileCalls: () => profileCalls };
}

test('signup requiring confirmation does not insert a customer before a session exists', async ({ page }) => {
  const state = await fixture(page, false);
  await page.goto('/auth');
  await page.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente Prueba');
  await page.getByLabel('Email', { exact: true }).fill('cliente@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('only-a-test-password');
  await page.getByRole('button', { name: 'Crear Cuenta', exact: true }).click();
  await expect(page.getByText('Revisa tu correo y confirma la cuenta.', { exact: false })).toBeVisible();
  expect(state.profileCalls()).toBe(0); expect(state.writes).toHaveLength(0); expect(state.unexpected).toEqual([]);
});

test('customer sees recommendations, saves a favorite and can reopen the saved search', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const state = await fixture(page);
  await page.goto('/cliente/dashboard');
  await expect(page.getByRole('heading', { name: 'Tus inmuebles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Piso de prueba en Madrid' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver anuncio original' })).toHaveAttribute('href', 'https://www.pisos.com/fixture');
  await expect(page.getByRole('button', { name: /Suscribirme/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar favorito', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Editar búsqueda' }).click();
  await expect(page.getByLabel('Ciudades, barrios o provincias')).toHaveValue('Madrid');
  await expect(page.getByLabel('Hasta (€)', { exact: true })).toHaveValue('220000');
  await expect(page.getByLabel('Baños mínimos')).toHaveValue('2');
  await expect(page.getByLabel('Ascensor imprescindible')).toBeChecked();
  await page.getByLabel('Hasta (€)', { exact: true }).fill('230000');
  await page.getByRole('button', { name: 'Guardar mi búsqueda' }).click();
  await expect(page.getByRole('heading', { name: 'Tus inmuebles' })).toBeVisible();
  expect(state.writes.find(w => w.path.endsWith('clientes'))?.body.presupuesto_max).toBe(230000);
  expect(state.writes.find(w => w.path.endsWith('criterios_busqueda'))).toMatchObject({ method: 'PATCH', body: { banos_min: 2, flexibilidad_presupuesto: 0, tiene_ascensor: true } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test('admin inspects captured response and reprocesses it without sending worker credentials', async ({ page }) => {
  await fixture(page);
  const id='00000000-0000-4000-8000-000000000050', captureId='a'.repeat(64);
  const job={id,status:'captured',error:'adapter_not_configured',delivered:0,captures:1,created_at:Date.now(),request:{source_id:'pisos',ubicacion:'Murcia',search_urls:['https://www.pisos.com/venta/pisos-murcia_capital/']}};
  const actions:string[]=[];
  await page.route('https://fixture.supabase.co/rest/v1/user_roles*',route=>route.fulfill({contentType:'application/json',body:'{"role":"admin"}'}));
  await page.route('https://fixture.supabase.co/functions/v1/browser-worker',async route=>{
    const body=route.request().postDataJSON();actions.push(body.action);
    expect(route.request().headers()['x-scraper-secret']).toBeUndefined();
    const values:Record<string,unknown>={sources:{sources:[{id:'pisos',portal:'pisos',label:'Pisos.com',adapter_version:null}]},list:{jobs:[job]},get:{job,captures:[{id:captureId,response_url:'https://www.pisos.com/fixture-api',page_index:0,mime_type:'text/plain',bytes:23,captured_at:Date.now()}],preview:[],preview_error:'adapter_not_configured'},capture:{capture:{body:'',text:'{"datoSoloAPI":132456.78}',mime_type:'text/plain'}},replay:{success:true,job_id:id}};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(values[body.action])});
  });
  await page.goto('/scraper');
  await expect(page.getByRole('heading',{name:'Búsquedas con navegador'})).toBeVisible();
  await page.getByRole('button',{name:/pisos · Murcia/}).click();
  await page.getByRole('button',{name:/fixture-api/}).click();
  await expect(page.getByLabel('Respuesta original')).toContainText('132456.78');
  await page.getByRole('button',{name:'Reprocesar bruto guardado'}).click();
  await expect.poll(()=>actions.filter(action=>action==='replay').length).toBe(1);
  expect(actions).not.toContain('create');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
