import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Subscription() {
  const navigate = useNavigate();
  const { tier, subscribed, loading: contextLoading, checkSubscription, upgradeUrl, manageSubscription } = useSubscription();
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleUpgrade = async (priceId: string) => {
    try {
      setLoadingCheckout(priceId);
      const url = await upgradeUrl(priceId);
      if (url) {
        window.open(url, '_blank');
        toast.success('Redirigiendo a checkout de Stripe...');
      } else {
        toast.error('Error al crear sesión de pago');
      }
    } catch (error) {
      console.error('Error upgrading:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setLoadingCheckout(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoadingPortal(true);
      const url = await manageSubscription();
      if (url) {
        window.open(url, '_blank');
        toast.success('Abriendo portal de gestión...');
      } else {
        toast.error('Error al abrir portal de cliente');
      }
    } catch (error) {
      console.error('Error managing subscription:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setLoadingPortal(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const tiers = Object.entries(SUBSCRIPTION_TIERS).filter(([key]) => key !== 'free');

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Elige tu plan</h1>
          <p className="text-xl text-muted-foreground">
            Desbloquea todo el potencial de InmoFinder
          </p>
          {subscribed && (
            <div className="mt-4 flex justify-center gap-4">
              <Badge variant="secondary" className="text-lg py-2 px-4">
                Plan actual: {SUBSCRIPTION_TIERS[tier].name}
              </Badge>
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                {loadingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Gestionar suscripción
              </Button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map(([key, tierInfo]) => {
            const isCurrentPlan = tier === key;
            const isPaidPlan = key !== 'free';

            return (
              <Card 
                key={key} 
                className={`relative ${isCurrentPlan ? 'border-primary border-2' : ''}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Tu plan actual
                    </Badge>
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="text-2xl">{tierInfo.name}</CardTitle>
                  <CardDescription>
                    <span className="text-4xl font-bold text-foreground">
                      €{tierInfo.price}
                    </span>
                    <span className="text-muted-foreground">/mes</span>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {tierInfo.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {isCurrentPlan ? (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => checkSubscription()}
                    >
                      Plan actual
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(tierInfo.priceId!)}
                      disabled={loadingCheckout === tierInfo.priceId}
                    >
                      {loadingCheckout === tierInfo.priceId ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        isPaidPlan ? 'Contratar plan' : 'Comenzar gratis'
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            ¿Tienes dudas? Contacta con nuestro equipo
          </p>
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Volver a configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
