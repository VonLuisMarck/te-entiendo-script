import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Building2, Users, TrendingUp, FileText, LogOut, Settings, Search, MapPin, BarChart3, Archive } from "lucide-react";
import { generateBusinessReport } from "@/lib/business-report-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpainHeatmap } from "@/components/SpainHeatmap";
import homelyLogo from "@/assets/homely-logo.png";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    propiedades: 0,
    clientes: 0,
    matchings: 0,
    historico: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadStats();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadStats = async () => {
    try {
      const [propiedadesRes, clientesRes, matchingsRes, historicoRes] = await Promise.all([
        supabase.from("propiedades").select("id", { count: "exact", head: true }),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("matchings").select("id", { count: "exact", head: true }),
        supabase.from("propiedades_historico").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        propiedades: propiedadesRes.count || 0,
        clientes: clientesRes.count || 0,
        matchings: matchingsRes.count || 0,
        historico: historicoRes.count || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
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
      toast.success("📄 Informe generado correctamente");
    } catch (error) {
      console.error("Error generando informe:", error);
      toast.error("Error al generar el informe");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={homelyLogo} alt="Homely" className="h-10 w-10 object-contain" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Homely
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={handleGenerateReport}>
              <FileText className="h-4 w-4 mr-2" />
              Descargar Informe
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Bienvenido, {user?.user_metadata?.nombre || user?.email}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 border-t-4 border-t-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propiedades</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                {stats.propiedades}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total en base de datos</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 border-t-4 border-t-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.clientes}</div>
              <p className="text-xs text-muted-foreground mt-1">Clientes activos</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 border-t-4 border-t-warning">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matchings</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.matchings}</div>
              <p className="text-xs text-muted-foreground mt-1">Total de coincidencias</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 border-t-4 border-t-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Histórico</CardTitle>
              <div className="p-2 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground">{stats.historico.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Propiedades archivadas totales</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Mapa de Propiedades Activas</h3>
          <SpainHeatmap />
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Navegación Rápida</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/propiedades")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  Propiedades
                </CardTitle>
                <CardDescription className="text-sm">
                  Gestiona y visualiza todas las propiedades scrapeadas
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/clientes")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                    <Users className="h-6 w-6 text-success" />
                  </div>
                  Clientes
                </CardTitle>
                <CardDescription className="text-sm">
                  Administra tus clientes y sus criterios de búsqueda
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/matchings")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors">
                    <Search className="h-6 w-6 text-warning" />
                  </div>
                  Matchings
                </CardTitle>
                <CardDescription className="text-sm">
                  Revisa las coincidencias entre clientes y propiedades
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/scraper")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  Scraper
                </CardTitle>
                <CardDescription className="text-sm">
                  Configura y ejecuta scrapers de portales inmobiliarios
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/metricas")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                    <BarChart3 className="h-6 w-6 text-accent" />
                  </div>
                  Métricas de Mercado
                </CardTitle>
                <CardDescription className="text-sm">
                  Análisis de precios por ciudad y barrio - Detecta chollos
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/mercado-ciudades")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  Mercado por Ciudades
                </CardTitle>
                <CardDescription className="text-sm">
                  Análisis del mercado inmobiliario por ciudades
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/ubicaciones")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                    <MapPin className="h-6 w-6 text-accent" />
                  </div>
                  Gestionar Ubicaciones
                </CardTitle>
                <CardDescription className="text-sm">
                  Editar catálogo de provincias, ciudades y distritos
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-glow hover:scale-105 transition-all duration-300 shadow-elegant group" onClick={() => navigate("/historico")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-muted/10 group-hover:bg-muted/20 transition-colors">
                    <Archive className="h-6 w-6 text-muted-foreground" />
                  </div>
                  Histórico
                </CardTitle>
                <CardDescription className="text-sm">
                  Consulta el histórico de propiedades archivadas
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
