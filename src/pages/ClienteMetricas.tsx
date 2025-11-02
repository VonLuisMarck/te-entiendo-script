import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Loader2, ArrowLeft, TrendingUp, Home, Euro, BarChart3, Lock, Activity, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Area, AreaChart } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip as InfoTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricasBarrio {
  id: string;
  ciudad: string;
  distrito: string | null;
  precio_medio: number;
  precio_m2_medio: number;
  total_propiedades: number;
  tendencia: string;
  proyeccion_revalorizacion_anual: number;
  indice_dinamismo: number;
  variacion_mensual: number;
  ultima_actualizacion: string;
}

const ClienteMetricas = () => {
  const navigate = useNavigate();
  const { tier, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<MetricasBarrio[]>([]);
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<string>('todas');

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
        .order('barrio', { ascending: true });

      if (error) throw error;
      
      const metricasData = data || [];
      setMetricas(metricasData);
      
      // Extraer ciudades únicas
      const ciudadesUnicas = [...new Set(metricasData.map(m => m.ciudad))].sort();
      setCiudades(ciudadesUnicas);
      
      // Si solo hay una ciudad, seleccionarla por defecto
      if (ciudadesUnicas.length === 1) {
        setCiudadSeleccionada(ciudadesUnicas[0]);
      }
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

  // Filtrar métricas por ciudad
  const metricasFiltradas = ciudadSeleccionada === 'todas' 
    ? metricas 
    : metricas.filter(m => m.ciudad === ciudadSeleccionada);

  // Preparar datos para gráficos
  const preciosPorBarrio = metricasFiltradas
    .sort((a, b) => b.precio_m2_medio - a.precio_m2_medio)
    .slice(0, 10)
    .map(m => ({
      nombre: m.distrito ? `${m.distrito}, ${m.ciudad}` : m.ciudad,
      precio_m2: Math.round(m.precio_m2_medio),
      propiedades: m.total_propiedades
    }));

  const dinamismoPorBarrio = metricasFiltradas
    .filter(m => m.indice_dinamismo && m.indice_dinamismo > 0)
    .sort((a, b) => b.indice_dinamismo - a.indice_dinamismo)
    .slice(0, 10)
    .map(m => ({
      nombre: m.distrito ? `${m.distrito}, ${m.ciudad}` : m.ciudad,
      dinamismo: m.indice_dinamismo,
      variacion: m.variacion_mensual || 0
    }));

  // Calcular métricas agregadas
  const precioMedioTotal = metricasFiltradas.length > 0 
    ? Math.round(metricasFiltradas.reduce((sum, m) => sum + m.precio_m2_medio, 0) / metricasFiltradas.length)
    : 0;
  
  const dinamismosValidos = metricasFiltradas.filter(m => m.indice_dinamismo && m.indice_dinamismo > 0);
  const dinamismoMedio = dinamismosValidos.length > 0
    ? (dinamismosValidos.reduce((sum, m) => sum + m.indice_dinamismo, 0) / dinamismosValidos.length).toFixed(1)
    : 0;

  const totalPropiedades = metricasFiltradas.reduce((sum, m) => sum + (m.total_propiedades || 0), 0);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/cliente/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-4xl font-bold">Análisis del Mercado</h1>
                <p className="text-muted-foreground mt-1">Datos en tiempo real del mercado inmobiliario</p>
              </div>
            </div>
            
            {ciudades.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ciudad:</span>
                <Select value={ciudadSeleccionada} onValueChange={setCiudadSeleccionada}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecciona ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las ciudades</SelectItem>
                    {ciudades.map(ciudad => (
                      <SelectItem key={ciudad} value={ciudad}>{ciudad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {metricasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {ciudadSeleccionada === 'todas' 
                    ? 'No hay métricas disponibles en este momento' 
                    : `No hay métricas disponibles para ${ciudadSeleccionada}`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Métricas principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardDescription>Precio medio €/m²</CardDescription>
                    <InfoTooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Precio promedio por metro cuadrado en la zona seleccionada. Es útil para comparar el valor de propiedades de diferentes tamaños.</p>
                      </TooltipContent>
                    </InfoTooltip>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Euro className="h-8 w-8 text-primary" />
                      <div>
                        <div className="text-3xl font-bold">
                          {new Intl.NumberFormat('es-ES', {
                            maximumFractionDigits: 0
                          }).format(precioMedioTotal)}
                        </div>
                        <p className="text-xs text-muted-foreground">€/m² promedio</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardDescription>Índice de dinamismo</CardDescription>
                    <InfoTooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Mide la actividad del mercado en la zona. Un valor alto indica que hay muchas propiedades nuevas y movimiento constante. Valores bajos sugieren un mercado más estático.</p>
                      </TooltipContent>
                    </InfoTooltip>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Activity className="h-8 w-8 text-primary" />
                      <div>
                        <div className="text-3xl font-bold">{dinamismoMedio}</div>
                        <p className="text-xs text-muted-foreground">Nivel de actividad</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardDescription>Propiedades analizadas</CardDescription>
                    <InfoTooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Número total de propiedades incluidas en el análisis. Más propiedades significa datos más precisos y representativos del mercado.</p>
                      </TooltipContent>
                    </InfoTooltip>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Home className="h-8 w-8 text-primary" />
                      <div>
                        <div className="text-3xl font-bold">
                          {new Intl.NumberFormat('es-ES').format(totalPropiedades)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total en base de datos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

            {/* Gráfico de precios */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Barrios por Precio €/m²</CardTitle>
                <CardDescription>
                  Comparativa de precios medios por metro cuadrado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={preciosPorBarrio} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="nombre" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [
                        `${new Intl.NumberFormat('es-ES', { 
                          style: 'currency', 
                          currency: 'EUR',
                          maximumFractionDigits: 0 
                        }).format(value)}/m²`, 
                        'Precio'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="precio_m2" 
                      fill="hsl(var(--primary))" 
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de dinamismo */}
            {dinamismoPorBarrio.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Índice de Dinamismo por Barrio</CardTitle>
                  <CardDescription>
                    Nivel de actividad y variación mensual del mercado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={dinamismoPorBarrio} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <defs>
                        <linearGradient id="colorDinamismo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="nombre" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'dinamismo' 
                            ? value.toFixed(1)
                            : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
                          name === 'dinamismo' ? 'Índice' : 'Variación mensual'
                        ]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="dinamismo" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorDinamismo)"
                        name="Índice de dinamismo"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="variacion" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        name="Variación mensual (%)"
                        dot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ClienteMetricas;
