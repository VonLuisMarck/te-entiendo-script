import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Home, LogOut, TrendingUp, RefreshCw, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Metrica {
  id: string;
  ciudad: string;
  barrio: string | null;
  precio_medio: number;
  precio_m2_medio: number;
  precio_m2_min: number;
  precio_m2_max: number;
  total_propiedades: number;
  total_pisos: number;
  total_chalets: number;
  tendencia: string;
  ultima_actualizacion: string;
}

const Metricas = () => {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadMetricas();
      }
    });
  }, [navigate]);

  const loadMetricas = async () => {
    try {
      const { data, error } = await supabase
        .from("metricas_barrios")
        .select("*")
        .order("ciudad", { ascending: true })
        .order("barrio", { ascending: true, nullsFirst: true });

      if (error) throw error;
      setMetricas(data || []);
    } catch (error) {
      console.error("Error loading metricas:", error);
      toast.error("Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  };

  const recalcularMetricas = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-metrics', {
        body: { recalcular_todo: true }
      });

      if (error) throw error;
      
      toast.success(`Métricas actualizadas: ${data.metricas_actualizadas} zonas`);
      loadMetricas();
    } catch (error: any) {
      toast.error(error.message || "Error al recalcular métricas");
    } finally {
      setCalculating(false);
    }
  };

  const getTendenciaColor = (tendencia: string) => {
    switch (tendencia) {
      case 'subiendo': return 'text-green-500';
      case 'bajando': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'subiendo': return '↗️';
      case 'bajando': return '↘️';
      default: return '→';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('es-ES');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Análisis de Mercado</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={recalcularMetricas} disabled={calculating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando métricas...</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Métricas por Ciudad y Barrio</CardTitle>
              <CardDescription>
                Datos agregados de {metricas.length} zonas - Actualizado: {
                  metricas.length > 0 
                    ? new Date(metricas[0].ultima_actualizacion).toLocaleString('es-ES')
                    : '-'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Barrio</TableHead>
                      <TableHead className="text-right">€/m² Medio</TableHead>
                      <TableHead className="text-right">€/m² Min-Max</TableHead>
                      <TableHead className="text-right">Precio Medio</TableHead>
                      <TableHead className="text-center">Propiedades</TableHead>
                      <TableHead className="text-center">Pisos/Chalets</TableHead>
                      <TableHead className="text-center">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricas.map((metrica) => (
                      <TableRow key={metrica.id}>
                        <TableCell className="font-medium">{metrica.ciudad}</TableCell>
                        <TableCell>
                          {metrica.barrio ? (
                            metrica.barrio
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Total Ciudad
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(metrica.precio_m2_medio)} €
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatNumber(metrica.precio_m2_min)} - {formatNumber(metrica.precio_m2_max)} €
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(metrica.precio_medio)} €
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{metrica.total_propiedades}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {metrica.total_pisos} / {metrica.total_chalets}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getTendenciaColor(metrica.tendencia)}>
                            {getTendenciaIcon(metrica.tendencia)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && metricas.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No hay métricas calculadas todavía</p>
            <p className="text-sm text-muted-foreground mb-4">
              Primero necesitas hacer scraping de propiedades
            </p>
            <Button onClick={recalcularMetricas}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Calcular Métricas
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Metricas;
