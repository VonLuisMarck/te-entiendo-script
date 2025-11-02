import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Building2, Users, Search, TrendingUp, LogOut, BarChart3, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    propiedades: 0,
    clientes: 0,
    matchings: 0,
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
      const [propiedadesRes, clientesRes, matchingsRes] = await Promise.all([
        supabase.from("propiedades").select("id", { count: "exact", head: true }),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("matchings").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        propiedades: propiedadesRes.count || 0,
        clientes: clientesRes.count || 0,
        matchings: matchingsRes.count || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
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
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              InmoFinder
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
            Bienvenido de vuelta, {user?.user_metadata?.nombre || user?.email}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
