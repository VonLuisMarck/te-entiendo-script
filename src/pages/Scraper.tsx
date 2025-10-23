import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Home, LogOut, Play, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ScrapingLog {
  id: string;
  portal: string;
  ubicacion: string;
  propiedades_encontradas: number;
  propiedades_nuevas: number;
  propiedades_actualizadas: number;
  duracion_segundos: number;
  status: string;
  created_at: string;
}

const Scraper = () => {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [formData, setFormData] = useState({
    portal: "fotocasa",
    ubicacion: "Murcia",
    tipo_propiedad: "piso",
  });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadLogs();
      }
    });
  }, [navigate]);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("scraping_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error loading logs:", error);
      toast.error("Error al cargar logs");
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setScraping(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('scraping-service', {
        body: formData
      });

      if (error) throw error;
      
      toast.success(`Scraping completado: ${data.propiedades_nuevas} nuevas propiedades`);
      loadLogs();
    } catch (error: any) {
      toast.error(error.message || "Error al ejecutar scraping");
    } finally {
      setScraping(false);
    }
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
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Scraper</h1>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Configurar Scraping</CardTitle>
                <CardDescription>Extrae propiedades de portales inmobiliarios</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleScrape} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="portal">Portal</Label>
                    <Select
                      value={formData.portal}
                      onValueChange={(value) => setFormData({ ...formData, portal: value })}
                    >
                      <SelectTrigger id="portal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fotocasa">Fotocasa</SelectItem>
                        <SelectItem value="idealista">Idealista</SelectItem>
                        <SelectItem value="pisos">Pisos.com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ubicacion">Ubicación</Label>
                    <Input
                      id="ubicacion"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                      placeholder="Ej: Murcia, Barcelona..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Propiedad</Label>
                    <Select
                      value={formData.tipo_propiedad}
                      onValueChange={(value) => setFormData({ ...formData, tipo_propiedad: value })}
                    >
                      <SelectTrigger id="tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piso">Piso</SelectItem>
                        <SelectItem value="casa">Casa</SelectItem>
                        <SelectItem value="chalet">Chalet</SelectItem>
                        <SelectItem value="atico">Ático</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={scraping}>
                    <Play className={`h-4 w-4 mr-2 ${scraping ? 'animate-pulse' : ''}`} />
                    {scraping ? 'Scrapeando...' : 'Ejecutar Scraping'}
                  </Button>
                </form>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Nota
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Este scraper es un simulador para desarrollo. Conecta tu scraper Python real mediante el endpoint de la Edge Function.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Scraping</CardTitle>
                <CardDescription>Últimas ejecuciones del scraper</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Cargando historial...</p>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {log.portal}
                            </Badge>
                            <h4 className="font-semibold">{log.ubicacion}</h4>
                          </div>
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Encontradas</p>
                            <p className="font-semibold">{log.propiedades_encontradas}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Nuevas</p>
                            <p className="font-semibold text-green-500">{log.propiedades_nuevas}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Actualizadas</p>
                            <p className="font-semibold text-blue-500">{log.propiedades_actualizadas}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Duración</p>
                            <p className="font-semibold">{log.duracion_segundos}s</p>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-3">
                          {new Date(log.created_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {!loading && logs.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay historial todavía</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scraper;
