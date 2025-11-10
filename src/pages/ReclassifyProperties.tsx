import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ReclassifyProperties() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleReclassify = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reclassify-properties', {
        body: {}
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success(`✅ ${data.corregidas} propiedades reclasificadas correctamente`);
      } else {
        toast.error('Error en la reclasificación');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al reclasificar propiedades');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            ← Volver al Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reclasificar Ubicaciones de Propiedades</CardTitle>
            <CardDescription>
              Corrige las propiedades que tienen barrios guardados como distritos según la jerarquía correcta del JSON de ubicaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Esta operación:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Analizará todas las propiedades con distrito</li>
                  <li>Identificará barrios guardados incorrectamente como distritos</li>
                  <li>Los corregirá al distrito padre correspondiente</li>
                  <li>Ejemplo: "Castellana" → "Salamanca" (distrito padre)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Button 
                onClick={handleReclassify}
                disabled={isProcessing}
                size="lg"
                className="w-full max-w-md"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reclasificando propiedades...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Iniciar Reclasificación
                  </>
                )}
              </Button>
            </div>

            {result && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">Resultados de la Reclasificación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total propiedades</p>
                      <p className="text-2xl font-bold">{result.total_propiedades}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Corregidas</p>
                      <p className="text-2xl font-bold text-green-600">{result.corregidas}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Ya correctas</p>
                      <p className="text-2xl font-bold text-blue-600">{result.ya_correctas}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Actualizadas</p>
                      <p className="text-2xl font-bold text-primary">{result.actualizadas}</p>
                    </div>
                  </div>

                  {result.ejemplos_cambios && result.ejemplos_cambios.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Ejemplos de cambios realizados:</h4>
                      <div className="bg-background rounded-md p-3 space-y-1 max-h-60 overflow-y-auto">
                        {result.ejemplos_cambios.map((cambio: string, idx: number) => (
                          <p key={idx} className="text-xs font-mono text-muted-foreground">
                            {cambio}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {result.message}
                    </AlertDescription>
                  </Alert>

                  <div className="pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/metricas')}
                      className="w-full"
                    >
                      Ver Métricas Actualizadas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}