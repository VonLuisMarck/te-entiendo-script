import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { subscriptionState } from './billing.ts';
export const database = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
export const stripeClient = () => {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe no configurado');
  return new Stripe(key, { apiVersion: '2025-08-27.basil', timeout: 15000, maxNetworkRetries: 1 });
};
export async function currentUser(req: Request, db: ReturnType<typeof database>) {
  const token = req.headers.get('authorization')!.replace(/^Bearer\s+/i, '');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email) throw new Error('Sesión inválida');
  return data.user;
}
export async function syncBilling(db: ReturnType<typeof database>, stripe: ReturnType<typeof stripeClient>, customerId: string) {
  const name = `billing:${customerId}`;
  const lease = await db.rpc('acquire_processing_lock', { p_name: name, p_seconds: 180 });
  if (lease.error || !lease.data) throw new Error('Sincronización de facturación ocupada');
  try {
    // Fetch current state: duplicate/out-of-order webhooks cannot reinstate old plans.
    const subscriptions: any[] = [];
    for await (const s of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
      subscriptions.push(s);
      if (subscriptions.length > 1000) throw new Error('Demasiadas suscripciones');
    }
    const state = subscriptionState(subscriptions);
    const { error } = await db.rpc('sync_customer_subscription', { p_customer_id: customerId,
      p_subscription_id: state.subscription_id, p_status: state.status, p_tier: state.tier, p_period_end: state.subscription_end });
    if (error) throw error;
    return state;
  } finally { await db.rpc('release_processing_lock', { p_name: name, p_token: lease.data }); }
}
