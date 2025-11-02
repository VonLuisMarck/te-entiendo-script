import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpIcon, ArrowDownIcon, TrendingUp, MapPin, Home, LogOut, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MetricaCiudad {
  ciudad: string;
  provincia: string;
  precio_medio: number;
  precio_m2_medio: number;
  total_propiedades: number;
  total_pisos: number;
  total_chalets: number;
  proyeccion_revalorizacion_anual: number | null;
  variacion_mensual: number | null;
  tendencia: string | null;
  precio_m2_min: number;
  precio_m2_max: number;
}

const MercadoCiudades = () => {
  const [metricas, setMetricas] = useState<MetricaCiudad[]>([]);
  const [loading, setLoading] = useState(true);
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
      // Obtener métricas solo de ciudades (sin distrito)
      const { data, error } = await supabase
        .from("metricas_barrios")
        .select("*")
        .is("distrito", null)
        .order("total_propiedades", { ascending: false });

      if (error) throw error;
      setMetricas(data || []);
    } catch (error) {
      console.error("Error loading metricas:", error);
      toast.error("Error al cargar métricas de mercado");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-ES").format(Math.round(num));
  };

  const getTendenciaColor = (tendencia: string | null) => {
    switch (tendencia) {
      case "alza":
        return "text-green-600 dark:text-green-400";
      case "baja":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getTendenciaIcon = (tendencia: string | null) => {
    switch (tendencia) {
      case "alza":
        return <ArrowUpIcon className="h-4 w-4" />;
      case "baja":
        return <ArrowDownIcon className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
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
              <MapPin className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Mercado por Ciudades</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Análisis del mercado inmobiliario por ciudades basado en datos actuales de propiedades
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando datos del mercado...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metricas.map((metrica) => (
              <Card key={`${metrica.ciudad}-${metrica.provincia}`} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{metrica.ciudad}</CardTitle>
                      <CardDescription>{metrica.provincia}</CardDescription>
                    </div>
                    {metrica.tendencia && (
                      <Badge variant="outline" className={getTendenciaColor(metrica.tendencia)}>
                        <span className="flex items-center gap-1">
                          {getTendenciaIcon(metrica.tendencia)}
                          {metrica.tendencia}
                        </span>
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Precio medio</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatNumber(metrica.precio_medio)} €
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Precio medio por m²</p>
                    <p className="text-xl font-semibold">
                      {formatNumber(metrica.precio_m2_medio)} €/m²
                    </p>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Propiedades</p>
                        <p className="font-semibold">{metrica.total_propiedades}</p>
                      </div>
                      {metrica.total_pisos > 0 && (
                        <div>
                          <p className="text-muted-foreground">Pisos</p>
                          <p className="font-semibold">{metrica.total_pisos}</p>
                        </div>
                      )}
                      {metrica.total_chalets > 0 && (
                        <div>
                          <p className="text-muted-foreground">Chalets</p>
                          <p className="font-semibold">{metrica.total_chalets}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {metrica.proyeccion_revalorizacion_anual !== null && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Proyección anual</p>
                      <p className={`text-lg font-bold ${
                        metrica.proyeccion_revalorizacion_anual >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {metrica.proyeccion_revalorizacion_anual > 0 ? '+' : ''}
                        {metrica.proyeccion_revalorizacion_anual.toFixed(1)}%
                      </p>
                    </div>
                  )}

                  {metrica.variacion_mensual !== null && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Variación mensual</p>
                      <p className={`text-base font-semibold ${
                        metrica.variacion_mensual >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {metrica.variacion_mensual > 0 ? '+' : ''}
                        {metrica.variacion_mensual.toFixed(2)}%
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Rango de precios/m²</p>
                    <p className="text-sm font-medium">
                      {formatNumber(metrica.precio_m2_min)} - {formatNumber(metrica.precio_m2_max)} €/m²
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && metricas.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay datos de mercado disponibles
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MercadoCiudades;
