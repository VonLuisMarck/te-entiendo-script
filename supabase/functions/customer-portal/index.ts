import { serve } from '../_shared/runtime.ts';
import { authorize, cors } from '../_shared/security.ts';
import { appOrigin } from '../_shared/billing.ts';
import { database, stripeClient, currentUser } from '../_shared/billing-service.ts';
serve(async req => {
  const denied = await authorize(req, 'user'); if (denied) return denied;
  try {
    const db = database(), stripe = stripeClient(), user = await currentUser(req, db);
    const mapping = await db.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (mapping.error) throw mapping.error;
    if (!mapping.data) return Response.json({ error: 'No hay una cuenta de facturación asociada' }, { status: 404, headers: cors });
    const session = await stripe.billingPortal.sessions.create({ customer: mapping.data.stripe_customer_id, return_url: `${appOrigin(Deno.env.get('APP_URL'))}/cliente/dashboard` });
    return Response.json({ url: session.url }, { headers: cors });
  } catch (error) {
    console.error('[customer-portal]', error);
    return Response.json({ error: 'No se pudo abrir el portal de facturación' }, { status: 503, headers: cors });
  }
});
