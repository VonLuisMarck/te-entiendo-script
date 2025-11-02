import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Home, LogOut, Play, Activity, Search, Database, RefreshCw, Clock, CheckCircle2, AlertCircle } from "lucide-react";
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
    ubicacion: "murcia",
    maxPages: null as number | null,  // null = sin límite
    scrapingMode: "single" as "single" | "all"  // single ciudad o toda españa
  });
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [loadingCron, setLoadingCron] = useState(false);
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
      if (formData.scrapingMode === "all") {
        // Scraping masivo de toda España
        const ciudades = ['murcia', 'madrid', 'barcelona', 'valencia', 'sevilla', 'malaga'];
        toast.info(`🚀 Lanzando scraping masivo en ${ciudades.length} ciudades...`);
        
        for (const ciudad of ciudades) {
          const { data, error } = await supabase.functions.invoke('scraping-service', {
            body: {
              portal: formData.portal,
              ubicacion: ciudad,
              max_pages: formData.maxPages
            }
          });

          if (data?.success) {
            console.log(`✅ ${ciudad} scraping iniciado: ${data.job_id}`);
          }
        }
        
        toast.success(`✅ ${ciudades.length} scrapers lanzados en paralelo`);
        setTimeout(() => loadLogs(), 10000);
      } else {
        // Scraping de ciudad individual
        const { data, error } = await supabase.functions.invoke('scraping-service', {
          body: {
            portal: formData.portal,
            ubicacion: formData.ubicacion,
            max_pages: formData.maxPages
          }
        });

        if (error) throw error;
        
        if (data.success) {
          toast.success(`✅ Scraping iniciado en Fly.io (Job ID: ${data.job_id.substring(0, 8)}...)`);
          toast.info('Los resultados aparecerán en el historial cuando el scraping termine', { duration: 5000 });
          setTimeout(() => loadLogs(), 10000);
        } else {
          toast.error(data.message || "Error al iniciar scraping");
        }
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
      <header className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="hover:scale-110 transition-transform"
            >
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 ring-2 ring-primary/20">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Scraper
                </h1>
                <p className="text-xs text-muted-foreground">Gestión de datos inmobiliarios</p>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow border-primary/20">
              <CardHeader className="pb-4 space-y-1">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  <CardTitle>Configurar Scraping</CardTitle>
                </div>
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
                    <Label htmlFor="scrapingMode">Modo de Scraping</Label>
                    <Select
                      value={formData.scrapingMode}
                      onValueChange={(value: "single" | "all") => setFormData({ ...formData, scrapingMode: value })}
                    >
                      <SelectTrigger id="scrapingMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Ciudad Individual</SelectItem>
                        <SelectItem value="all">🌍 Toda España (6 ciudades)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.scrapingMode === "single" && (
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
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="maxPages">Límite de páginas</Label>
                    <Input
                      id="maxPages"
                      type="number"
                      placeholder="Sin límite (dejar vacío)"
                      value={formData.maxPages || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        maxPages: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      min="1"
                    />
                    <p className="text-sm text-muted-foreground">
                      Dejar vacío para scraper todas las páginas disponibles. Solo descarga propiedades nuevas (incremental).
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-md hover:shadow-lg transition-all" 
                    disabled={scraping}
                  >
                    <Play className={`h-4 w-4 mr-2 ${scraping ? 'animate-spin' : ''}`} />
                    {scraping ? 'Scrapeando...' : formData.scrapingMode === "all" ? '🚀 Lanzar Scraping Masivo' : 'Ejecutar Scraping'}
                  </Button>

                  {formData.scrapingMode === "all" && (
                    <p className="text-xs text-muted-foreground text-center">
                      Se lanzarán 6 scrapers en paralelo (Murcia, Madrid, Barcelona, Valencia, Sevilla, Málaga)
                    </p>
                  )}
                </form>

                <div className="mt-6 pt-6 border-t space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full border-dashed hover:border-solid hover:bg-accent/10 transition-all"
                    onClick={handleGenerateFakeData}
                    disabled={generatingFake}
                  >
                    <Activity className={`h-4 w-4 mr-2 ${generatingFake ? 'animate-pulse' : ''}`} />
                    {generatingFake ? 'Generando...' : '✨ Generar Datos Fake'}
                  </Button>

                  <div className="p-4 bg-gradient-to-br from-accent/5 to-accent/10 rounded-lg border border-accent/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-accent" />
                      Datos de Prueba
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Genera 50 propiedades fake realistas en varias ciudades para probar el sistema sin necesidad del scraper real.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="pb-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <CardTitle>Historial de Scraping</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={loadLogs}
                    className="hover:bg-primary/10"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>Últimas ejecuciones del scraper</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Cargando historial...</p>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div 
                        key={log.id} 
                        className="border rounded-xl p-4 hover:shadow-md transition-all bg-gradient-to-br from-card to-muted/20 group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                              <Database className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <Badge 
                                variant="outline" 
                                className="mb-2 bg-background/50"
                              >
                                {log.portal}
                              </Badge>
                              <h4 className="font-semibold text-base">
                                {log.ubicacion || 'Toda España'}
                              </h4>
                            </div>
                          </div>
                          <Badge 
                            variant={log.status === 'success' ? 'default' : 'destructive'}
                            className="gap-1"
                          >
                            {log.status === 'success' ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {log.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3 mt-4 p-3 bg-background/60 rounded-lg">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">Encontradas</p>
                            <p className="text-lg font-bold">{log.propiedades_encontradas}</p>
                          </div>
                          <div className="text-center border-l">
                            <p className="text-xs text-muted-foreground mb-1">Nuevas</p>
                            <p className="text-lg font-bold text-success">{log.propiedades_nuevas}</p>
                          </div>
                          <div className="text-center border-l">
                            <p className="text-xs text-muted-foreground mb-1">Actualizadas</p>
                            <p className="text-lg font-bold text-primary">{log.propiedades_actualizadas}</p>
                          </div>
                          <div className="text-center border-l">
                            <p className="text-xs text-muted-foreground mb-1">Duración</p>
                            <p className="text-lg font-bold">{log.duracion_segundos}s</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loading && logs.length === 0 && (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
                      <Activity className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">No hay historial todavía</p>
                    <p className="text-sm text-muted-foreground mt-2">Ejecuta tu primer scraping para comenzar</p>
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
