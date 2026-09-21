import Stripe from 'stripe';
import { serve } from '../_shared/runtime.ts';
import { database, stripeClient, syncBilling } from '../_shared/billing-service.ts';
serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('Webhook not configured', { status: 503 });
  const stripe = stripeClient();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature') || '', secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch { return new Response('Invalid signature', { status: 400 }); }
  const supported = ['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'];
  if (!supported.includes(event.type)) return Response.json({ received: true });
  try {
    const object = event.data.object as any;
    const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
    if (!customerId) return new Response('Missing customer', { status: 400 });
    const db = database();
    const mapping = await db.from('stripe_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    if (mapping.error) throw mapping.error;
    // This Stripe account can serve other products; never map a user from untrusted metadata.
    if (!mapping.data) return Response.json({ received: true, ignored: true });
    await syncBilling(db, stripe, customerId);
    return Response.json({ received: true });
  } catch (error) { console.error('[stripe-webhook]', error); return new Response('Retry delivery', { status: 503 }); }
});
