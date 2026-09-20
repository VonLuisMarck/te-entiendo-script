import { serve } from '../_shared/runtime.ts';
import { authorize, cors } from '../_shared/security.ts';
import { subscriptionState } from '../_shared/billing.ts';
import { database, stripeClient, currentUser, syncBilling } from '../_shared/billing-service.ts';
serve(async req => {
  const denied = await authorize(req, 'user'); if (denied) return denied;
  try {
    const db = database(), user = await currentUser(req, db);
    const mapping = await db.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (mapping.error) throw mapping.error;
    const state = mapping.data ? await syncBilling(db, stripeClient(), mapping.data.stripe_customer_id) : subscriptionState([]);
    return Response.json({ ...state, billing_enabled: Deno.env.get('BILLING_ENABLED') === 'true' }, { headers: cors });
  } catch (error) {
    console.error('[check-subscription]', error);
    return Response.json({ error: 'No se pudo verificar la suscripción' }, { status: 503, headers: cors });
  }
});
