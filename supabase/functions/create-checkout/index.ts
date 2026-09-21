import { serve } from '../_shared/runtime.ts';
import { authorize, cors } from '../_shared/security.ts';
import { priceTiers, appOrigin } from '../_shared/billing.ts';
import { database, stripeClient, currentUser, syncBilling } from '../_shared/billing-service.ts';
serve(async req => {
  const denied = await authorize(req, 'user'); if (denied) return denied;
  if (Deno.env.get('BILLING_ENABLED') !== 'true') return Response.json({ error: 'Los planes de pago todavía no están disponibles' }, { status: 503, headers: cors });
  let release: (() => Promise<void>) | undefined;
  try {
    const { priceId } = await req.json();
    if (typeof priceId !== 'string' || !Object.hasOwn(priceTiers, priceId)) return Response.json({ error: 'Plan inválido' }, { status: 400, headers: cors });
    const origin = appOrigin(Deno.env.get('APP_URL'));
    const db = database(), stripe = stripeClient(), user = await currentUser(req, db);
    const lockName = `checkout-${user.id}`;
    const lock = await db.rpc('acquire_processing_lock', { p_name: lockName, p_seconds: 300 });
    if (lock.error) throw lock.error;
    if (!lock.data) return Response.json({ error: 'Ya hay un pago en preparación. Espera unos segundos.' }, { status: 409, headers: cors });
    release = async () => {
      const result = await db.rpc('release_processing_lock', { p_name: lockName, p_token: lock.data });
      if (result.error) console.error('[checkout] Could not release lease');
    };
    const existing = await db.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (existing.error) throw existing.error;
    let customerId = existing.data?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email!, metadata: { user_id: user.id } }, { idempotencyKey: `findoo-customer-${user.id}` });
      const saved = await db.from('stripe_customers').upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (saved.error) throw saved.error;
      const mapping = await db.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).single();
      if (mapping.error) throw mapping.error;
      customerId = mapping.data.stripe_customer_id;
    }
    const state = await syncBilling(db, stripe, customerId);
    if (state.subscribed) return Response.json({ error: 'Ya tienes una suscripción. Gestiona tu plan desde el portal de facturación.' }, { status: 409, headers: cors });
    const pending = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
    if (pending.has_more) throw new Error('Too many pending checkout sessions');
    const open = pending.data.find(session => session.mode === 'subscription');
    if (open) {
      const lines = await stripe.checkout.sessions.listLineItems(open.id, { limit: 2 });
      if (lines.data.length === 1 && lines.data[0].price?.id === priceId && open.url) {
        return Response.json({ url: open.url }, { headers: cors });
      }
      return Response.json({ error: 'Tienes un pago pendiente con otro plan. Completa ese pago o espera a que caduque.' }, { status: 409, headers: cors });
    }
    const bucket = Math.floor(Date.now() / 1800000);
    const session = await stripe.checkout.sessions.create({ customer: customerId, mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }], client_reference_id: user.id,
      success_url: `${origin}/cliente/dashboard?success=true`, cancel_url: `${origin}/cliente/dashboard?canceled=true`,
      metadata: { user_id: user.id }, subscription_data: { metadata: { user_id: user.id } },
      expires_at: bucket * 1800 + 3600,
    }, { idempotencyKey: `checkout-${user.id}-${priceId}-${bucket}` });
    return Response.json({ url: session.url }, { headers: cors });
  } catch (error) {
    console.error('[checkout]', error);
    return Response.json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }, { status: 503, headers: cors });
  } finally {
    if (release) await release().catch(() => console.error('[checkout] Lease release failed'));
  }
});
