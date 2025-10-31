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
  ubicacion: string | null;
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
  const [generatingFake, setGeneratingFake] = useState(false);
  const [formData, setFormData] = useState({
    portal: "fotocasa",
    ubicacion: "murcia"
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
      
      if (data.success) {
        toast.success(`✅ Scraping iniciado en Fly.io (Job ID: ${data.job_id.substring(0, 8)}...)`);
        toast.info('Los resultados aparecerán en el historial cuando el scraping termine', { duration: 5000 });
        
        // Recargar logs después de unos segundos para ver si ya hay resultados
        setTimeout(() => loadLogs(), 10000);
      } else {
        toast.error(data.message || "Error al iniciar scraping");
      }
      
      loadLogs();
    } catch (error: any) {
      toast.error(error.message || "Error al ejecutar scraping");
    } finally {
      setScraping(false);
    }
  };

  const handleGenerateFakeData = async () => {
    setGeneratingFake(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-fake-data', {
        body: {
          cantidad: 50,
          ciudades: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga']
        }
      });

      if (error) throw error;
      
      toast.success(`✨ ${data.propiedades_creadas} propiedades fake generadas! Precio medio: ${data.precio_medio.toLocaleString()}€`);
      loadLogs();
    } catch (error: any) {
      toast.error(error.message || "Error al generar datos fake");
    } finally {
      setGeneratingFake(false);
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
                <CardDescription>
                  Scraping completo de toda España - Los filtros se aplicarán en el matching
                </CardDescription>
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
                        <SelectItem value="pisos">Pisos.com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ubicacion">Ciudad</Label>
                    <Select
                      value={formData.ubicacion}
                      onValueChange={(value) => setFormData({ ...formData, ubicacion: value })}
                    >
                      <SelectTrigger id="ubicacion">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="murcia">Murcia</SelectItem>
                        <SelectItem value="madrid">Madrid</SelectItem>
                        <SelectItem value="barcelona">Barcelona</SelectItem>
                        <SelectItem value="valencia">Valencia</SelectItem>
                        <SelectItem value="sevilla">Sevilla</SelectItem>
                        <SelectItem value="malaga">Málaga</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={scraping}>
                    <Play className={`h-4 w-4 mr-2 ${scraping ? 'animate-pulse' : ''}`} />
                    {scraping ? 'Scrapeando...' : 'Ejecutar Scraping'}
                  </Button>
                </form>

                <div className="mt-6 space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleGenerateFakeData}
                    disabled={generatingFake}
                  >
                    <Activity className={`h-4 w-4 mr-2 ${generatingFake ? 'animate-pulse' : ''}`} />
                    {generatingFake ? 'Generando...' : '✨ Generar Datos Fake'}
                  </Button>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Datos de Prueba
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Genera 50 propiedades fake realistas en varias ciudades para probar el sistema sin necesidad del scraper real.
                    </p>
                  </div>
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
                            <h4 className="font-semibold">
                              {log.ubicacion || 'Toda España'}
                            </h4>
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
