import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, LogOut, CreditCard, Settings, BarChart3 } from 'lucide-react';

const ClienteDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { subscribed, tier, subscriptionEnd, loading: subLoading, checkSubscription } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    // Check for success or canceled params
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({
        title: "¡Suscripción exitosa!",
        description: "Tu suscripción ha sido activada correctamente.",
      });
      checkSubscription();
      // Clean URL
      window.history.replaceState({}, '', '/cliente/dashboard');
    } else if (canceled === 'true') {
      toast({
        title: "Pago cancelado",
        description: "No se ha procesado ningún pago.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, '', '/cliente/dashboard');
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleCheckout = async (priceId: string) => {
    try {
      setCheckoutLoading(priceId);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión para suscribirte.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar el proceso de pago. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Error",
        description: "No se pudo abrir el portal de gestión. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Portal de Cliente</h1>
            <p className="text-muted-foreground mt-2">
              Bienvenido, {user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            {(tier === 'investor' || tier === 'investor_platino') && (
              <Button onClick={() => navigate('/cliente/metricas')} variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Métricas
              </Button>
            )}
            <Button onClick={() => navigate('/cliente/settings')} variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Current Subscription Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Tu Suscripción Actual</CardTitle>
            <CardDescription>
              {tier === 'free' && 'Plan gratuito - Actualiza para desbloquear más funciones'}
              {tier === 'basic' && 'Plan Básico - Acceso a funciones principales'}
              {tier === 'investor' && 'Plan Inversor - Funcionalidades avanzadas'}
              {tier === 'investor_platino' && 'Plan Inversor Premium - Acceso completo'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant={tier === 'free' ? 'secondary' : 'default'} className="text-lg px-4 py-2">
                  {tier === 'free' && 'Free'}
                  {tier === 'basic' && 'Básico'}
                  {tier === 'investor' && 'Inversor'}
                  {tier === 'investor_platino' && 'Inversor Premium'}
                </Badge>
                {subscriptionEnd && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Válido hasta: {new Date(subscriptionEnd).toLocaleDateString('es-ES')}
                  </p>
                )}
              </div>
              {subscribed && (
                <Button onClick={handleManageSubscription} disabled={portalLoading}>
                  {portalLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Gestionar Suscripción
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans */}
        <h2 className="text-2xl font-bold mb-4">Planes Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(SUBSCRIPTION_TIERS).filter(([key]) => key !== 'free').map(([key, plan]) => {
            const isCurrentPlan = tier === key;

            return (
              <Card key={key} className={isCurrentPlan ? 'border-primary border-2' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrentPlan && (
                      <Badge variant="default">Tu Plan</Badge>
                    )}
                  </div>
                  <CardDescription className="text-2xl font-bold">€{plan.price}/mes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleCheckout(plan.priceId!)}
                    disabled={isCurrentPlan || checkoutLoading === plan.priceId}
                    className="w-full"
                    variant={isCurrentPlan ? 'secondary' : 'default'}
                  >
                    {checkoutLoading === plan.priceId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : isCurrentPlan ? (
                      'Plan Actual'
                    ) : (
                      'Suscribirse'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClienteDashboard;
