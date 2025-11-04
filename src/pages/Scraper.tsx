import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Home, LogOut, Play, Activity, Search, Database, RefreshCw, Clock, CheckCircle2, AlertCircle, Trash2, Power, PowerOff, Plus, FileText } from "lucide-react";
import { generateBusinessReport } from "@/lib/business-report-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    nombre: "",
    intervalo: "24h" as "1h" | "6h" | "12h" | "24h",
    horaInicio: 2,  // hora por defecto 2am
    portal: "fotocasa",
    ubicacion: "murcia",
    scraping_mode: "single" as "single" | "all"
  });
  const navigate = useNavigate();

  const intervalToCron = (intervalo: string, hora: number) => {
    switch(intervalo) {
      case "1h": return "0 * * * *";              // Cada hora (ignora hora de inicio)
      case "6h": return `0 ${hora},${(hora+6)%24},${(hora+12)%24},${(hora+18)%24} * * *`;  // Cada 6 horas desde la hora especificada
      case "12h": return `0 ${hora},${(hora+12)%24} * * *`;  // Cada 12 horas desde la hora especificada
      case "24h": return `0 ${hora} * * *`;       // Diario a la hora especificada
      default: return `0 ${hora} * * *`;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadLogs();
        loadCronJobs();
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

  const loadCronJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("scraping_triggers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCronJobs(data || []);
    } catch (error) {
      console.error("Error loading cron jobs:", error);
    }
  };

  const toggleCronJob = async (id: string, activo: boolean) => {
    try {
      const { error } = await supabase
        .from("scraping_triggers")
        .update({ activo: !activo })
        .eq("id", id);

      if (error) throw error;
      toast.success(activo ? "Trigger desactivado" : "Trigger activado");
      loadCronJobs();
    } catch (error: any) {
      toast.error("Error al actualizar trigger");
    }
  };

  const deleteCronJob = async (id: string) => {
    try {
      const { error } = await supabase
        .from("scraping_triggers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Trigger eliminado");
      loadCronJobs();
    } catch (error: any) {
      toast.error("Error al eliminar trigger");
    }
  };

  const createTrigger = async () => {
    if (!newTrigger.nombre) {
      toast.error("Ingresa un nombre para el trigger");
      return;
    }

    try {
      const { error } = await supabase
        .from("scraping_triggers")
        .insert({
          nombre: newTrigger.nombre,
          cron_expression: intervalToCron(newTrigger.intervalo, newTrigger.horaInicio),
          portal: newTrigger.portal,
          ubicacion: newTrigger.scraping_mode === "all" ? null : newTrigger.ubicacion,
          scraping_mode: newTrigger.scraping_mode,
          activo: true
        });

      if (error) throw error;
      
      toast.success("✅ Trigger creado exitosamente");
      setDialogOpen(false);
      setNewTrigger({
        nombre: "",
        intervalo: "24h",
        horaInicio: 2,
        portal: "fotocasa",
        ubicacion: "murcia",
        scraping_mode: "single"
      });
      loadCronJobs();
    } catch (error: any) {
      toast.error("Error al crear trigger");
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

  const handleGenerateReport = async () => {
    try {
      // Cargar métricas del sistema
      const [propsData, clientesData, matchingsData, scrapingData] = await Promise.all([
        supabase.from("propiedades").select("id, activo, created_at, precio, precio_m2"),
        supabase.from("clientes").select("id, tipo_suscripcion, activo"),
        supabase.from("matchings").select("id, score, notificado, created_at"),
        supabase.from("scraping_logs").select("propiedades_encontradas, propiedades_nuevas, duracion_segundos").gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
      ]);
      
      const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
      
      const metrics = {
        propiedades: {
          total: propsData.data?.length || 0,
          activas: propsData.data?.filter(p => p.activo).length || 0,
          nuevasSemana: propsData.data?.filter(p => new Date(p.created_at) > sevenDaysAgo).length || 0,
          precioMedio: propsData.data?.reduce((sum, p) => sum + (p.precio || 0), 0) / (propsData.data?.length || 1),
          precioM2Medio: propsData.data?.reduce((sum, p) => sum + (p.precio_m2 || 0), 0) / (propsData.data?.length || 1)
        },
        clientes: {
          total: clientesData.data?.length || 0,
          free: clientesData.data?.filter(c => c.tipo_suscripcion === 'free').length || 0,
          basic: clientesData.data?.filter(c => c.tipo_suscripcion === 'basic').length || 0,
          investor: clientesData.data?.filter(c => c.tipo_suscripcion === 'investor' || c.tipo_suscripcion === 'investor_platino').length || 0,
          activos: clientesData.data?.filter(c => c.activo).length || 0
        },
        matchings: {
          total: matchingsData.data?.length || 0,
          semana: matchingsData.data?.filter(m => new Date(m.created_at) > sevenDaysAgo).length || 0,
          scorePromedio: matchingsData.data && matchingsData.data.length > 0 ? matchingsData.data.reduce((sum, m) => sum + (m.score || 0), 0) / matchingsData.data.length : null,
          notificados: matchingsData.data?.filter(m => m.notificado).length || 0
        },
        scraping: {
          logsTotal: scrapingData.data?.length || 0,
          totalScraped: scrapingData.data?.reduce((sum, s) => sum + (s.propiedades_encontradas || 0), 0) || 0,
          totalNuevas: scrapingData.data?.reduce((sum, s) => sum + (s.propiedades_nuevas || 0), 0) || 0,
          duracionMedia: scrapingData.data && scrapingData.data.length > 0 ? scrapingData.data.reduce((sum, s) => sum + (s.duracion_segundos || 0), 0) / scrapingData.data.length : 0
        }
      };
      
      generateBusinessReport(metrics);
      toast.success("Informe generado correctamente");
    } catch (error) {
      console.error("Error generando informe:", error);
      toast.error("Error al generar el informe");
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleGenerateReport}
              className="hover:bg-primary/10 hover:border-primary/50 transition-all"
            >
              <FileText className="h-4 w-4 mr-2" />
              Descargar Informe
            </Button>
            <Button
              variant="outline" 
              onClick={handleLogout}
              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
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
              </CardContent>
            </Card>

            {/* Control de Cron Jobs */}
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Power className="h-5 w-5 text-primary" />
                  <CardTitle>Control Automático</CardTitle>
                </div>
                <CardDescription>
                  Gestiona los trabajos programados del sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Control de Scrapers */}
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Scrapers cada 6h</Label>
                      <p className="text-sm text-muted-foreground">Ejecuta scrapers automáticamente</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const { error } = await supabase.functions.invoke('manage-cron-jobs', {
                          body: { action: 'stop_scrapers' }
                        });
                        if (!error) toast.success("Scrapers detenidos");
                      }}
                    >
                      <PowerOff className="h-4 w-4 mr-2" />
                      Detener
                    </Button>
                  </div>
                </div>

                {/* Control de Limpieza */}
                <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label className="text-base font-medium">Limpieza Automática</Label>
                      <p className="text-sm text-muted-foreground">Archiva propiedades inactivas</p>
                    </div>
                    <Switch
                      defaultChecked={true}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase.functions.invoke('manage-cron-jobs', {
                          body: { 
                            action: checked ? 'start_cleanup' : 'stop_cleanup',
                            frequency: '0 */2 * * *'
                          }
                        });
                        if (!error) {
                          toast.success(checked ? "Limpieza activada" : "Limpieza desactivada");
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Frecuencia</Label>
                    <Select
                      defaultValue="0 */2 * * *"
                      onValueChange={async (frequency) => {
                        const { error } = await supabase.functions.invoke('manage-cron-jobs', {
                          body: { 
                            action: 'update_cleanup_frequency',
                            frequency
                          }
                        });
                        if (!error) toast.success("Frecuencia actualizada");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0 * * * *">Cada hora</SelectItem>
                        <SelectItem value="0 */2 * * *">Cada 2 horas</SelectItem>
                        <SelectItem value="0 */4 * * *">Cada 4 horas</SelectItem>
                        <SelectItem value="0 */6 * * *">Cada 6 horas</SelectItem>
                        <SelectItem value="0 */12 * * *">Cada 12 horas</SelectItem>
                        <SelectItem value="0 0 * * *">Diaria (medianoche)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección de Triggers Automáticos */}
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="pb-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <CardTitle>Triggers Automáticos</CardTitle>
                    {cronJobs.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {cronJobs.filter(j => j.activo).length} activos
                      </Badge>
                    )}
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Crear Trigger Automático</DialogTitle>
                        <DialogDescription>
                          Configura un scraping que se ejecute automáticamente
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nombre del Trigger</Label>
                          <Input 
                            placeholder="Ej: Scraping diario Murcia"
                            value={newTrigger.nombre}
                            onChange={(e) => setNewTrigger({...newTrigger, nombre: e.target.value})}
                          />
                        </div>
                        
                        <div>
                          <Label>Frecuencia</Label>
                          <Select
                            value={newTrigger.intervalo}
                            onValueChange={(value: "1h" | "6h" | "12h" | "24h") => setNewTrigger({...newTrigger, intervalo: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1h">⏱️ Cada hora</SelectItem>
                              <SelectItem value="6h">🕕 Cada 6 horas</SelectItem>
                              <SelectItem value="12h">🕛 Cada 12 horas</SelectItem>
                              <SelectItem value="24h">📅 Cada 24 horas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newTrigger.intervalo !== "1h" && (
                          <div>
                            <Label>Hora de inicio (0-23)</Label>
                            <Select
                              value={newTrigger.horaInicio.toString()}
                              onValueChange={(value) => setNewTrigger({...newTrigger, horaInicio: parseInt(value)})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {Array.from({length: 24}, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i.toString().padStart(2, '0')}:00 {i < 12 ? 'AM' : 'PM'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                              {newTrigger.intervalo === "6h" && `Se ejecutará a las ${newTrigger.horaInicio}h, ${(newTrigger.horaInicio+6)%24}h, ${(newTrigger.horaInicio+12)%24}h, ${(newTrigger.horaInicio+18)%24}h`}
                              {newTrigger.intervalo === "12h" && `Se ejecutará a las ${newTrigger.horaInicio}h y ${(newTrigger.horaInicio+12)%24}h`}
                              {newTrigger.intervalo === "24h" && `Se ejecutará diariamente a las ${newTrigger.horaInicio}h`}
                            </p>
                          </div>
                        )}

                        <div>
                          <Label>Portal</Label>
                          <Select
                            value={newTrigger.portal}
                            onValueChange={(value) => setNewTrigger({...newTrigger, portal: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fotocasa">Fotocasa</SelectItem>
                              <SelectItem value="pisos">Pisos.com</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Modo de Scraping</Label>
                          <Select
                            value={newTrigger.scraping_mode}
                            onValueChange={(value: "single" | "all") => setNewTrigger({...newTrigger, scraping_mode: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Ciudad Individual</SelectItem>
                              <SelectItem value="all">🌍 Toda España</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newTrigger.scraping_mode === "single" && (
                          <div>
                            <Label>Ciudad</Label>
                            <Select
                              value={newTrigger.ubicacion}
                              onValueChange={(value) => setNewTrigger({...newTrigger, ubicacion: value})}
                            >
                              <SelectTrigger>
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
                        
                        <Button className="w-full" onClick={createTrigger}>
                          ✨ Crear Trigger
                        </Button>
                        <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                          <p className="text-xs text-muted-foreground">
                            ℹ️ Los triggers se guardarán y podrás activarlos/desactivarlos. La ejecución automática requiere configurar pg_cron.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>
                  Configura scrapers para que se ejecuten automáticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cronJobs.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cronJobs.map((job) => {
                      const getFrecuencia = (cron: string) => {
                        if (cron === "0 * * * *") return "⏱️ Cada hora";
                        if (cron.match(/^0 \d+,\d+,\d+,\d+ \* \* \*$/)) return "🕕 Cada 6h";
                        if (cron.match(/^0 \d+,\d+ \* \* \*$/)) return "🕛 Cada 12h";
                        if (cron.match(/^0 \d+ \* \* \*$/)) {
                          const hora = cron.split(' ')[1];
                          return `📅 Diario ${hora}h`;
                        }
                        return `📅 ${cron}`;
                      };

                      return (
                        <div key={job.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow bg-card">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{job.nombre}</h4>
                              <p className="text-xs text-muted-foreground">
                                {job.portal} • {job.scraping_mode === 'all' ? '🌍 Toda España' : job.ubicacion}
                              </p>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => toggleCronJob(job.id, job.activo)}
                                title={job.activo ? "Desactivar" : "Activar"}
                              >
                                {job.activo ? (
                                  <Power className="h-4 w-4 text-green-500" />
                                ) : (
                                  <PowerOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0 hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`¿Eliminar el trigger "${job.nombre}"?`)) {
                                    deleteCronJob(job.id);
                                  }
                                }}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{getFrecuencia(job.cron_expression)}</span>
                            <Badge variant={job.activo ? "default" : "outline"} className="text-xs">
                              {job.activo ? "🟢 Activo" : "⚪ Inactivo"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay triggers configurados</p>
                    <p className="text-xs text-muted-foreground mt-1">Crea tu primer trigger para automatizar el scraping</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-primary/20">
              <CardContent className="pt-6">
                <div className="space-y-4">
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
            <Card className="shadow-lg border-primary/20 h-[calc(100vh-12rem)]">
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
              <CardContent className="h-[calc(100%-5rem)] overflow-y-auto">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Cargando historial...</p>
                ) : (
                  <div className="space-y-3 pr-2">
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
