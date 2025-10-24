import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Home, LogOut, TrendingUp, RefreshCw, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

interface Matching {
  id: string;
  score: number;
  criterios_cumplidos: any;
  analisis_mercado: any;
  created_at: string;
  cliente_id: string;
  clientes: {
    nombre: string;
    email: string;
  };
  propiedades: {
    titulo: string;
    precio: number;
    ubicacion: string;
    tipo_propiedad: string;
    metros: number;
    dormitorios: number;
    url: string;
  };
}

interface ClienteConMatchings {
  id: string;
  nombre: string;
  email: string;
  matchings: Matching[];
  mejorScore: number;
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
          propiedades (titulo, precio, ubicacion, tipo_propiedad, metros, dormitorios, url)
        `)
        .order("score", { ascending: false });

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

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "outline";
  };

  // Agrupar matchings por cliente
  const clientesConMatchings = useMemo((): ClienteConMatchings[] => {
    const clientesMap = new Map<string, ClienteConMatchings>();

    matchings.forEach((matching) => {
      const clienteId = matching.cliente_id;
      
      if (!clientesMap.has(clienteId)) {
        clientesMap.set(clienteId, {
          id: clienteId,
          nombre: matching.clientes?.nombre || 'Cliente',
          email: matching.clientes?.email || '',
          matchings: [],
          mejorScore: 0
        });
      }

      const cliente = clientesMap.get(clienteId)!;
      cliente.matchings.push(matching);
      cliente.mejorScore = Math.max(cliente.mejorScore, matching.score);
    });

    // Ordenar matchings dentro de cada cliente por score
    clientesMap.forEach((cliente) => {
      cliente.matchings.sort((a, b) => b.score - a.score);
    });

    // Convertir a array y ordenar por mejor score
    return Array.from(clientesMap.values())
      .sort((a, b) => b.mejorScore - a.mejorScore);
  }, [matchings]);

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
          <>
            {clientesConMatchings.length > 0 && (
              <div className="mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen</CardTitle>
                    <CardDescription>
                      {clientesConMatchings.length} cliente{clientesConMatchings.length !== 1 ? 's' : ''} con {matchings.length} matching{matchings.length !== 1 ? 's' : ''} total{matchings.length !== 1 ? 'es' : ''}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}

            <Accordion type="single" collapsible className="space-y-4">
              {clientesConMatchings.map((cliente) => (
                <AccordionItem key={cliente.id} value={cliente.id} className="border rounded-lg">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="text-left">
                        <h3 className="text-lg font-semibold">{cliente.nombre}</h3>
                        <p className="text-sm text-muted-foreground">{cliente.email}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={getScoreBadgeVariant(cliente.mejorScore)} className="text-sm">
                          Mejor: {cliente.mejorScore}%
                        </Badge>
                        <Badge variant="outline">
                          {cliente.matchings.length} propiedad{cliente.matchings.length !== 1 ? 'es' : ''}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-6 pb-4">
                    <div className="space-y-3">
                      {cliente.matchings.map((matching, index) => (
                        <Card key={matching.id} className={index < 5 ? 'border-primary/30' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold mb-1">{matching.propiedades?.titulo}</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {matching.propiedades?.ubicacion}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <div className={`text-2xl font-bold ${getScoreColor(matching.score)}`}>
                                  {matching.score}%
                                </div>
                                {index < 5 && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    Top {index + 1}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Progress value={matching.score} className="h-2 mb-3" />

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Precio:</span>
                                <p className="font-semibold">
                                  {matching.propiedades?.precio.toLocaleString('es-ES')} €
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Tipo:</span>
                                <p className="font-semibold capitalize">
                                  {matching.propiedades?.tipo_propiedad}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Metros:</span>
                                <p className="font-semibold">
                                  {matching.propiedades?.metros} m²
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Habitaciones:</span>
                                <p className="font-semibold">
                                  {matching.propiedades?.dormitorios}
                                </p>
                              </div>
                            </div>

                            {matching.analisis_mercado?.disponible && (
                              <div className="bg-muted/50 p-3 rounded-md mb-3">
                                <p className="text-xs font-semibold mb-1">Análisis de Mercado</p>
                                <p className="text-sm">
                                  {matching.analisis_mercado.mensaje}
                                </p>
                              </div>
                            )}

                            {matching.criterios_cumplidos && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {Object.entries(matching.criterios_cumplidos).map(([key, value]) => (
                                  value && (
                                    <Badge
                                      key={key}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      ✓ {key}
                                    </Badge>
                                  )
                                ))}
                              </div>
                            )}

                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">
                                {new Date(matching.created_at).toLocaleDateString('es-ES')}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(matching.propiedades?.url, '_blank')}
                              >
                                Ver propiedad
                                <ExternalLink className="h-3 w-3 ml-2" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
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
