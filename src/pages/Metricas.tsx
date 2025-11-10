import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Home, LogOut, TrendingUp, RefreshCw, BarChart3, Search, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Metrica {
  id: string;
  ciudad: string;
  distrito: string | null;
  precio_medio: number;
  precio_m2_medio: number;
  precio_m2_min: number;
  precio_m2_max: number;
  total_propiedades: number;
  total_pisos: number;
  total_chalets: number;
  tendencia: string;
  proyeccion_revalorizacion_anual: number | null;
  indice_dinamismo: number | null;
  meses_datos_historicos: number | null;
  ultima_actualizacion: string;
}

const Metricas = () => {
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [filtros, setFiltros] = useState({
    ciudad: "todas",
    busquedaBarrio: "",
    soloBarrios: false,
    ordenPor: "ciudad"
  });
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
        .order("distrito", { ascending: true, nullsFirst: true });

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

  const getProyeccionColor = (proyeccion: number | null) => {
    if (!proyeccion) return 'text-muted-foreground';
    if (proyeccion >= 5) return 'text-green-600 dark:text-green-400';
    if (proyeccion >= 2) return 'text-emerald-600 dark:text-emerald-400';
    if (proyeccion > 0) return 'text-blue-600 dark:text-blue-400';
    if (proyeccion >= -2) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProyeccionIcon = (proyeccion: number | null) => {
    if (!proyeccion) return '📊';
    if (proyeccion >= 5) return '🚀';
    if (proyeccion >= 2) return '📈';
    if (proyeccion > 0) return '↗️';
    if (proyeccion >= -2) return '→';
    return '📉';
  };

  const getDinamismoColor = (dinamismo: number | null) => {
    if (!dinamismo) return 'text-muted-foreground';
    if (dinamismo >= 80) return 'text-green-600 dark:text-green-400';
    if (dinamismo >= 60) return 'text-blue-600 dark:text-blue-400';
    if (dinamismo >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
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

  // Obtener lista de ciudades únicas
  const ciudades = useMemo(() => {
    const ciudadesUnicas = Array.from(new Set(metricas.map(m => m.ciudad))).sort();
    return ciudadesUnicas;
  }, [metricas]);

  // Filtrar y ordenar métricas
  const metricasFiltradas = useMemo(() => {
    let resultado = [...metricas];

    // Filtro por ciudad
    if (filtros.ciudad !== "todas") {
      resultado = resultado.filter(m => m.ciudad === filtros.ciudad);
    }

    // Filtro por barrio (búsqueda)
    if (filtros.busquedaBarrio) {
      const busqueda = filtros.busquedaBarrio.toLowerCase();
      resultado = resultado.filter(m => 
        m.distrito?.toLowerCase().includes(busqueda) || 
        (!m.distrito && "total ciudad".includes(busqueda))
      );
    }

    // Filtro solo barrios (excluir totales de ciudad)
    if (filtros.soloBarrios) {
      resultado = resultado.filter(m => m.distrito !== null);
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (filtros.ordenPor) {
        case "precio_alto":
          return (b.precio_m2_medio || 0) - (a.precio_m2_medio || 0);
        case "precio_bajo":
          return (a.precio_m2_medio || 0) - (b.precio_m2_medio || 0);
        case "propiedades":
          return b.total_propiedades - a.total_propiedades;
        default: // ciudad
          if (a.ciudad !== b.ciudad) {
            return a.ciudad.localeCompare(b.ciudad);
          }
          // Dentro de la misma ciudad, los totales primero
          if (!a.distrito && b.distrito) return -1;
          if (a.distrito && !b.distrito) return 1;
          if (!a.distrito && !b.distrito) return 0;
          return (a.distrito || '').localeCompare(b.distrito || '');
      }
    });

    return resultado;
  }, [metricas, filtros]);

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
          <>
            {/* Filtros */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Filtro por ciudad */}
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Select
                      value={filtros.ciudad}
                      onValueChange={(value) => setFiltros({ ...filtros, ciudad: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas las ciudades</SelectItem>
                        {ciudades.map((ciudad) => (
                          <SelectItem key={ciudad} value={ciudad}>
                            {ciudad}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Búsqueda por barrio */}
                  <div className="space-y-2">
                    <Label>Buscar Barrio</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nombre del barrio..."
                        value={filtros.busquedaBarrio}
                        onChange={(e) => setFiltros({ ...filtros, busquedaBarrio: e.target.value })}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Ordenar por */}
                  <div className="space-y-2">
                    <Label>Ordenar por</Label>
                    <Select
                      value={filtros.ordenPor}
                      onValueChange={(value) => setFiltros({ ...filtros, ordenPor: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ciudad">Ciudad</SelectItem>
                        <SelectItem value="precio_alto">€/m² Mayor a Menor</SelectItem>
                        <SelectItem value="precio_bajo">€/m² Menor a Mayor</SelectItem>
                        <SelectItem value="propiedades">Más Propiedades</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Solo barrios */}
                  <div className="flex items-end pb-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="soloBarrios"
                        checked={filtros.soloBarrios}
                        onCheckedChange={(checked) => 
                          setFiltros({ ...filtros, soloBarrios: checked as boolean })
                        }
                      />
                      <Label htmlFor="soloBarrios" className="text-sm cursor-pointer">
                        Solo barrios específicos
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Resumen de filtros */}
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Mostrando {metricasFiltradas.length} de {metricas.length} zonas
                  </span>
                  {(filtros.ciudad !== "todas" || filtros.busquedaBarrio || filtros.soloBarrios) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiltros({
                        ciudad: "todas",
                        busquedaBarrio: "",
                        soloBarrios: false,
                        ordenPor: "ciudad"
                      })}
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabla de métricas */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas por Ciudad y Barrio</CardTitle>
                <CardDescription>
                  Datos agregados - Actualizado: {
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
                      <TableHead className="text-right">Propiedades</TableHead>
                      <TableHead className="text-center">Proyección Anual</TableHead>
                      <TableHead className="text-center">Dinamismo</TableHead>
                      <TableHead className="text-center">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricasFiltradas.map((metrica) => (
                      <TableRow key={metrica.id}>
                        <TableCell className="font-medium">{metrica.ciudad}</TableCell>
                        <TableCell>
                          {metrica.distrito ? (
                            metrica.distrito
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Total Ciudad
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(metrica.precio_m2_medio)} €
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{metrica.total_propiedades}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {metrica.proyeccion_revalorizacion_anual !== null ? (
                            <div className="flex items-center justify-center gap-1">
                              <span>{getProyeccionIcon(metrica.proyeccion_revalorizacion_anual)}</span>
                              <span className={`font-semibold ${getProyeccionColor(metrica.proyeccion_revalorizacion_anual)}`}>
                                {metrica.proyeccion_revalorizacion_anual > 0 ? '+' : ''}
                                {metrica.proyeccion_revalorizacion_anual.toFixed(1)}%
                              </span>
                              {metrica.meses_datos_historicos && metrica.meses_datos_historicos >= 3 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({metrica.meses_datos_historicos}m)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span>📊</span>
                              <span className="text-xs text-muted-foreground">Sin histórico</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {metrica.indice_dinamismo !== null ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    metrica.indice_dinamismo >= 80 ? 'bg-green-500' :
                                    metrica.indice_dinamismo >= 60 ? 'bg-blue-500' :
                                    metrica.indice_dinamismo >= 40 ? 'bg-yellow-500' :
                                    'bg-gray-400'
                                  }`}
                                  style={{ width: `${metrica.indice_dinamismo}%` }}
                                />
                              </div>
                              <span className={`font-medium text-sm ${getDinamismoColor(metrica.indice_dinamismo)}`}>
                                {Math.round(metrica.indice_dinamismo)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
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
          </>
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
