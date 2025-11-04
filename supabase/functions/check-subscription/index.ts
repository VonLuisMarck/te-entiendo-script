import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Mapeo de product_id a subscription_tier
const PRODUCT_TO_TIER: Record<string, string> = {
  'prod_TKAF23fhblkfJU': 'basic',           // Básico
  'prod_TKAFdxpTBCEdel': 'investor',        // Inversor
  'prod_TKAGwOzkUFemBK': 'investor_platino' // Inversor Premium
};

// Función para obtener límites según tier
function getTierLimits(tier: string) {
  const limits: Record<string, any> = {
    free: {
      limite_matchings_mes: 5,
      max_ciudades_acceso: 0,
      dias_historico_acceso: 7,
      puede_descargar_datos: false,
      formatos_descarga: [],
      tiene_acceso_ine: false,
      tiene_api_access: false,
      periodicidad_alertas: 'ninguna',
      max_ubicaciones_alerta: 0,
      estimaciones_reforma_mes: 0
    },
    basic: {
      limite_matchings_mes: 20,
      max_ciudades_acceso: 0,
      dias_historico_acceso: 90,
      puede_descargar_datos: false,
      formatos_descarga: [],
      tiene_acceso_ine: false,
      tiene_api_access: false,
      periodicidad_alertas: 'semanal',
      max_ubicaciones_alerta: 1,
      estimaciones_reforma_mes: 3
    },
    investor: {
      limite_matchings_mes: null,
      max_ciudades_acceso: null,
      dias_historico_acceso: 365,
      puede_descargar_datos: true,
      formatos_descarga: ['pdf', 'excel', 'csv'],
      tiene_acceso_ine: true,
      tiene_api_access: false,
      periodicidad_alertas: 'diaria',
      max_ubicaciones_alerta: 5,
      estimaciones_reforma_mes: null
    },
    investor_platino: {
      limite_matchings_mes: null,
      max_ciudades_acceso: null,
      dias_historico_acceso: null,
      puede_descargar_datos: true,
      formatos_descarga: ['pdf', 'excel', 'csv'],
      tiene_acceso_ine: true,
      tiene_api_access: false,
      periodicidad_alertas: 'inmediata',
      max_ubicaciones_alerta: null,
      estimaciones_reforma_mes: null
    }
  };
  
  return limits[tier] || limits.free;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, checking for free tier");
      
      // Actualizar cliente a free tier con límites
      const limits = getTierLimits('free');
      const { error: updateError } = await supabaseClient
        .from('clientes')
        .update({ 
          tipo_suscripcion: 'free',
          ...limits
        })
        .eq('user_id', user.id);
      
      if (updateError) {
        logStep("Error updating client to free tier", { error: updateError });
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: 'free',
        product_id: null,
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let tier = 'free';

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product as string;
      tier = PRODUCT_TO_TIER[productId] || 'free';
      logStep("Determined subscription tier", { productId, tier });

      // Actualizar stripe_customers
      const { error: stripeError } = await supabaseClient
        .from('stripe_customers')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          current_period_end: subscriptionEnd
        }, { onConflict: 'user_id' });

      if (stripeError) {
        logStep("Error updating stripe_customers", { error: stripeError });
      }

      // Actualizar tipo_suscripcion y límites en clientes
      const limits = getTierLimits(tier);
      const { error: clienteError } = await supabaseClient
        .from('clientes')
        .update({ 
          tipo_suscripcion: tier,
          ...limits
        })
        .eq('user_id', user.id);

      if (clienteError) {
        logStep("Error updating cliente subscription tier", { error: clienteError });
      }
    } else {
      logStep("No active subscription found");
      
      // Actualizar a free tier con límites
      const limits = getTierLimits('free');
      const { error: updateError } = await supabaseClient
        .from('clientes')
        .update({ 
          tipo_suscripcion: 'free',
          ...limits
        })
        .eq('user_id', user.id);
      
      if (updateError) {
        logStep("Error updating client to free tier", { error: updateError });
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
