export const priceTiers: Record<string, string> = {
  price_1SNVunIZNGNvNT1eDLHxmlM2: 'basic',
  price_1SNVvAIZNGNvNT1eZt8aW9BO: 'investor',
  price_1SNVvUIZNGNvNT1eq1p9SZ7l: 'investor_platino',
};
export function subscriptionState(subscriptions: any[], now = Date.now()) {
  const ranks: Record<string, number> = { basic: 1, investor: 2, investor_platino: 3 };
  const eligible = subscriptions.flatMap(s => (s.items?.data ?? []).map((item: any) => ({
    subscription: s, item, tier: priceTiers[item.price?.id],
    // Stripe Basil moved billing periods to subscription items.
    period: Number(item.current_period_end),
  }))).filter(s => s.subscription.status === 'active' && s.tier && Number.isFinite(s.period) && s.period * 1000 > now)
    .sort((a,b) => ranks[b.tier] - ranks[a.tier] || b.period - a.period);
  const selected = eligible[0];
  return selected ? { subscribed: true, tier: selected.tier, subscription_id: selected.subscription.id,
    subscription_end: new Date(selected.period * 1000).toISOString(), status: 'active',
    product_id: typeof selected.item.price.product === 'string' ? selected.item.price.product : selected.item.price.product?.id ?? null,
  } : { subscribed: false, tier: 'free', subscription_id: null, subscription_end: null, status: 'inactive', product_id: null };
}
export function appOrigin(value: string | undefined) {
  if (!value) throw new Error('APP_URL no configurado');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('APP_URL debe usar HTTPS');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('APP_URL debe ser un origen sin rutas');
  return url.origin;
}
