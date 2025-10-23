import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Home, LogOut, TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Matching {
  id: string;
  score: number;
  criterios_cumplidos: any;
  created_at: string;
  clientes: {
    nombre: string;
    email: string;
  };
  propiedades: {
    titulo: string;
    precio: number;
    ubicacion: string;
    tipo_propiedad: string;
    url: string;
  };
}

const Matchings = () => {
  const [matchings, setMatchings] = useState<Matching[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadMatchings();
      }
    });
  }, [navigate]);

  const loadMatchings = async () => {
    try {
      const { data, error } = await supabase
        .from("matchings")
        .select(`
          *,
          clientes (nombre, email),
          propiedades (titulo, precio, ubicacion, tipo_propiedad, url)
        `)
        .order("score", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMatchings(data || []);
    } catch (error) {
      console.error("Error loading matchings:", error);
      toast.error("Error al cargar matchings");
    } finally {
      setLoading(false);
    }
  };

  const recalcularMatchings = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('matching-service', {
        body: { recalcular_todos: true }
      });

      if (error) throw error;
      
      toast.success(`Matchings recalculados: ${data.matchings_creados} nuevos`);
      loadMatchings();
    } catch (error: any) {
      toast.error(error.message || "Error al recalcular matchings");
    } finally {
      setCalculating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-yellow-500";
    return "text-orange-500";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
              <Search className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Matchings</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={recalcularMatchings} disabled={calculating}>
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
            <p className="text-muted-foreground">Cargando matchings...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matchings.map((matching) => (
              <Card key={matching.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {matching.clientes?.nombre}
                      </CardTitle>
                      <CardDescription>{matching.clientes?.email}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getScoreColor(matching.score)}`}>
                        {matching.score}%
                      </div>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={matching.score} className="h-2" />
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">{matching.propiedades?.titulo}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Ubicación:</span>{" "}
                        {matching.propiedades?.ubicacion}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>{" "}
                        {matching.propiedades?.tipo_propiedad}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Precio:</span>{" "}
                        {matching.propiedades?.precio.toLocaleString('es-ES')} €
                      </div>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 p-0 h-auto"
                      onClick={() => window.open(matching.propiedades?.url, '_blank')}
                    >
                      Ver propiedad →
                    </Button>
                  </div>

                  {matching.criterios_cumplidos && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(matching.criterios_cumplidos).map(([key, value]) => (
                        value && (
                          <Badge
                            key={key}
                            variant={value ? "default" : "secondary"}
                            className="text-xs"
                          >
                            ✓ {key}
                          </Badge>
                        )
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Creado: {new Date(matching.created_at).toLocaleDateString('es-ES')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && matchings.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No hay matchings todavía</p>
            <Button onClick={recalcularMatchings}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Calcular Matchings
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Matchings;
