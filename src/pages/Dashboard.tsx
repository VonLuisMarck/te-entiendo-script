import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Building2, Users, TrendingUp, FileText, LogOut, Settings, Search, MapPin, BarChart3, Archive, Zap } from "lucide-react";
import { generateBusinessReport } from "@/lib/business-report-generator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpainHeatmap } from "@/components/SpainHeatmap";
import findooLogo from "@/assets/findoo-logo.png";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    propiedades: 0,
    clientes: 0,
    matchings: 0,
    historico: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();

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

  const menuItems = [
    { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
    { title: "Propiedades", url: "/propiedades", icon: Building2 },
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Matchings", url: "/matchings", icon: Search },
    { title: "Scraper", url: "/scraper", icon: FileText },
    { title: "Métricas", url: "/metricas", icon: BarChart3 },
    { title: "Mercado", url: "/mercado-ciudades", icon: MapPin },
    { title: "Ubicaciones", url: "/ubicaciones", icon: MapPin },
    { title: "Reclasificar", url: "/reclassify-properties", icon: TrendingUp },
    { title: "Batch Processing", url: "/batch-processing", icon: Zap },
    { title: "Histórico", url: "/historico", icon: Archive },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card/50 backdrop-blur-sm flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <img src={findooLogo} alt="Findoo" className="h-10 w-10 object-contain" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Findoo
            </h1>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.url;
              return (
                <button
                  key={item.url}
                  onClick={() => navigate(item.url)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-5 w-5 mr-3" />
            Ajustes
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Salir
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" onClick={handleGenerateReport}>
                <FileText className="h-4 w-4 mr-2" />
                Informe
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
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

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4">Mapa de Propiedades Activas</h3>
            <SpainHeatmap />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
