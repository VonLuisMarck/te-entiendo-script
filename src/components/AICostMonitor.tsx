import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, TrendingUp, AlertTriangle, Calendar, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface CostTracking {
  fecha: string;
  coste_acumulado_dia_usd: number;
  llamadas_ia_dia: number;
  tokens_consumidos_dia: number;
  ultimo_batch_coste_usd: number;
  ultimo_batch_timestamp: string;
  alerta_activa: boolean;
  alerta_mensaje: string | null;
}

interface CostConfig {
  umbral_diario_usd: number;
  umbral_mensual_usd: number;
  umbral_por_batch_usd: number;
  notificar_ui: boolean;
  pausar_automatico: boolean;
}

export const AICostMonitor = () => {
  const [realtimeCost, setRealtimeCost] = useState<CostTracking | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Obtener configuración
  const { data: config } = useQuery({
    queryKey: ['ai-cost-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_cost_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      return data as CostConfig | null;
    }
  });

  // Obtener tracking del día actual
  const { data: todayTracking, refetch } = useQuery({
    queryKey: ['ai-cost-tracking-today'],
    queryFn: async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('ai_cost_tracking')
        .select('*')
        .eq('fecha', hoy)
        .maybeSingle();
      return data as CostTracking | null;
    },
    refetchInterval: 5000 // Refetch cada 5s como fallback
  });

  // Obtener coste mensual
  const { data: costeMensual } = useQuery({
    queryKey: ['ai-cost-monthly'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_coste_mensual_actual');
      if (error) throw error;
      return data as number;
    }
  });

  // Suscripción en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel('ai-cost-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_cost_tracking'
        },
        (payload) => {
          console.log('[Realtime] Actualización de costes:', payload);
          const newData = payload.new as CostTracking;
          setRealtimeCost(newData);
          
          // Mostrar alerta si está activa
          if (newData.alerta_activa && newData.alerta_mensaje && config?.notificar_ui) {
            setShowAlert(true);
            toast.warning('⚠️ Umbral de costes superado', {
              description: newData.alerta_mensaje,
              duration: 10000
            });
          }
          
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [config, refetch]);

  const currentTracking = realtimeCost || todayTracking;
  const costeDiario = currentTracking?.coste_acumulado_dia_usd || 0;
  const umbralDiario = config?.umbral_diario_usd || 10;
  const umbralMensual = config?.umbral_mensual_usd || 200;
  
  const porcentajeDiario = Math.min((costeDiario / umbralDiario) * 100, 100);
  const porcentajeMensual = Math.min(((costeMensual || 0) / umbralMensual) * 100, 100);

  const getColorByPercentage = (percentage: number) => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColorByPercentage = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Alerta si se supera umbral */}
      {showAlert && currentTracking?.alerta_activa && currentTracking?.alerta_mensaje && (
        <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Umbral de Costes Superado</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{currentTracking.alerta_mensaje}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAlert(false)}
            >
              Cerrar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Grid de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coste Diario */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Coste Hoy</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getColorByPercentage(porcentajeDiario)}`}>
                ${costeDiario.toFixed(4)}
              </span>
              <span className="text-sm text-muted-foreground">
                / ${umbralDiario.toFixed(2)}
              </span>
            </div>
            <Progress 
              value={porcentajeDiario} 
              className="h-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{currentTracking?.llamadas_ia_dia || 0} llamadas</span>
              <Badge variant="outline" className={getColorByPercentage(porcentajeDiario)}>
                {porcentajeDiario.toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Coste Mensual */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Coste Este Mes</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getColorByPercentage(porcentajeMensual)}`}>
                ${(costeMensual || 0).toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">
                / ${umbralMensual.toFixed(2)}
              </span>
            </div>
            <Progress 
              value={porcentajeMensual} 
              className="h-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Presupuesto mensual</span>
              <Badge variant="outline" className={getColorByPercentage(porcentajeMensual)}>
                {porcentajeMensual.toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Último Batch */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Último Batch</span>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-purple-600">
                ${(currentTracking?.ultimo_batch_coste_usd || 0).toFixed(4)}
              </span>
            </div>
            {currentTracking?.ultimo_batch_timestamp && (
              <p className="text-xs text-muted-foreground">
                {new Date(currentTracking.ultimo_batch_timestamp).toLocaleString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>Umbral: ${config?.umbral_por_batch_usd || 2}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info de realtime */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Monitoreo en Tiempo Real Activo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Los costes se actualizan automáticamente después de cada procesamiento batch.
            Las alertas se mostrarán instantáneamente cuando se superen los umbrales configurados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};