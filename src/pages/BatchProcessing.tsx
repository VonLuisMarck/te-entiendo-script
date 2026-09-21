import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Play, Database, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AICostMonitor } from "@/components/AICostMonitor";
import { AICostSettings } from "@/components/AICostSettings";

const BatchProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(50);

  // Stats de propiedades raw
  const { data: rawStats, refetch: refetchRawStats } = useQuery({
    queryKey: ['raw-stats'],
    queryFn: async () => {
      const { count: pendientes } = await supabase
        .from('propiedades_raw')
        .select('*', { count: 'exact', head: true })
        .eq('procesado', false);

      const { count: procesadas } = await supabase
        .from('propiedades_raw')
        .select('*', { count: 'exact', head: true })
        .eq('procesado', true);

      const { count: conErrores } = await supabase
        .from('propiedades_raw')
        .select('*', { count: 'exact', head: true })
        .eq('procesado', false)
        .gte('intentos_procesamiento', 3);

      return {
        pendientes: pendientes || 0,
        procesadas: procesadas || 0,
        conErrores: conErrores || 0,
        total: (pendientes || 0) + (procesadas || 0)
      };
    }
  });

  // Últimos logs de procesamiento
  const { data: recentLogs } = useQuery({
    queryKey: ['batch-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('batch_processing_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    }
  });

  const handleProcessBatch = async () => {
    if (!rawStats || rawStats.pendientes === 0) {
      toast.error('No hay propiedades pendientes de procesar');
      return;
    }

    setIsProcessing(true);
    
    try {
      toast.info(`Procesando batch de ${Math.min(batchSize, rawStats.pendientes)} propiedades...`);
      
      const { data, error } = await supabase.functions.invoke('batch-classify-properties', {
        body: { batch_size: batchSize, max_intentos: 3 }
      });

      if (error) throw error;

      if (data && typeof data.exitosas === "number") {
        (data.fallidas > 0 ? toast.warning : toast.success)(
          `Lote completado: ${data.exitosas} exitosas, ${data.fallidas} fallidas`,
          { 
            description: `Duración: ${data.duracion_segundos}s | Coste estimado: $${data.coste_estimado_usd.toFixed(4)}`,
            duration: 5000 
          }
        );

        if (data.errores && data.errores.length > 0) {
          console.error('Errores en batch:', data.errores);
        }
      } else {
        throw new Error(data.error || 'Error desconocido');
      }

      // Refrescar estadísticas
      refetchRawStats();
      
    } catch (error: any) {
      console.error('Error en procesamiento batch:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const progressPercentage = rawStats 
    ? Math.round((rawStats.procesadas / rawStats.total) * 100) 
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Procesamiento Batch</h1>
          <p className="text-muted-foreground mt-1">
            Sistema optimizado de clasificación de propiedades por lotes
          </p>
        </div>
      </div>

      {/* Monitor de Costes en Tiempo Real */}
      <AICostMonitor />

      {/* Configuración de Umbrales */}
      <AICostSettings />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{rawStats?.pendientes || 0}</span>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Procesadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-green-600">{rawStats?.procesadas || 0}</span>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con Errores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-red-600">{rawStats?.conErrores || 0}</span>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{progressPercentage}%</span>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Panel de Control</CardTitle>
          <CardDescription>
            Normaliza hasta {batchSize} anuncios por lote usando los datos de origen. Los anuncios incompletos quedan señalados para revisión.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Tamaño del batch</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="flex-1"
                  disabled={isProcessing}
                />
                <Badge variant="secondary" className="w-16 justify-center">
                  {batchSize}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Propiedades procesadas por llamada (10-100)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleProcessBatch}
              disabled={isProcessing || !rawStats || rawStats.pendientes === 0}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Procesar Batch
                </>
              )}
            </Button>

            <div className="text-sm text-muted-foreground">
              {rawStats && rawStats.pendientes > 0 && (
                <span>
                  Procesará hasta {Math.min(batchSize, rawStats.pendientes)} propiedades
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Procesamiento</CardTitle>
          <CardDescription>Últimas ejecuciones del sistema batch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentLogs && recentLogs.length > 0 ? (
              recentLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.total_propiedades} propiedades</Badge>
                      <Badge variant="default" className="bg-green-500">
                        {log.propiedades_exitosas} exitosas
                      </Badge>
                      {log.propiedades_fallidas > 0 && (
                        <Badge variant="destructive">
                          {log.propiedades_fallidas} fallidas
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('es-ES')} • 
                      Duración: {log.duracion_segundos}s • 
                      Coste: ${log.coste_estimado_usd?.toFixed(4) || '0.0000'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay logs de procesamiento aún
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Datos de origen verificables</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">El procesamiento de este lote no llama a modelos de IA. Precio, superficie, ubicación e imágenes proceden del anuncio. Revisa los errores antes de recalcular las recomendaciones.</CardContent>
      </Card>
    </div>
  );
};

export default BatchProcessing;
