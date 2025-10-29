import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Loader2, ArrowLeft, TrendingUp, Home, Euro, BarChart3, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MetricasBarrio {
  id: string;
  ciudad: string;
  barrio: string;
  precio_medio: number;
  precio_m2_medio: number;
  total_propiedades: number;
  tendencia: string;
  proyeccion_revalorizacion_anual: number;
  ultima_actualizacion: string;
}

const ClienteMetricas = () => {
  const navigate = useNavigate();
  const { tier, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<MetricasBarrio[]>([]);

  // Check if user has access to metrics
  const hasAccess = tier === 'investor' || tier === 'investor_platino';

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      if (hasAccess) {
        await loadMetricas();
      }
      setLoading(false);
    };

    if (!subLoading) {
      checkAuthAndLoad();
    }
  }, [navigate, hasAccess, subLoading]);

  const loadMetricas = async () => {
    try {
      const { data, error } = await supabase
        .from('metricas_barrios')
        .select('*')
        .order('ciudad', { ascending: true })
        .order('barrio', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMetricas(data || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate('/cliente/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Métricas del Mercado</h1>
              <p className="text-muted-foreground">Análisis de tendencias inmobiliarias</p>
            </div>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Contenido Premium</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Las métricas del mercado están disponibles solo para suscriptores de los planes Inversor e Inversor Premium.
              </p>
              <Button onClick={() => navigate('/cliente/dashboard')}>
                Ver Planes Disponibles
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cliente/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Métricas del Mercado</h1>
            <p className="text-muted-foreground">Análisis en tiempo real del mercado inmobiliario</p>
          </div>
        </div>

        {metricas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay métricas disponibles en este momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricas.map((metrica) => (
              <Card key={metrica.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{metrica.ciudad}</CardTitle>
                      <CardDescription>{metrica.barrio || 'Centro ciudad'}</CardDescription>
                    </div>
                    {metrica.tendencia && (
                      <Badge variant={metrica.tendencia === 'subida' ? 'default' : 'secondary'}>
                        {metrica.tendencia === 'subida' ? '📈' : '📊'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Precio medio</span>
                    </div>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('es-ES', { 
                        style: 'currency', 
                        currency: 'EUR',
                        maximumFractionDigits: 0 
                      }).format(metrica.precio_medio)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">€/m²</span>
                    </div>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('es-ES', { 
                        style: 'currency', 
                        currency: 'EUR',
                        maximumFractionDigits: 0 
                      }).format(metrica.precio_m2_medio)}
                    </span>
                  </div>

                  {metrica.proyeccion_revalorizacion_anual && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Proyección anual</span>
                      </div>
                      <span className="font-semibold text-primary">
                        +{metrica.proyeccion_revalorizacion_anual.toFixed(1)}%
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{metrica.total_propiedades} propiedades</span>
                      <span>
                        {new Date(metrica.ultima_actualizacion).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClienteMetricas;
