import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Search, TrendingUp, Users, Sparkles, Target, Zap, FileText } from "lucide-react";
import { generateBusinessReport } from "@/lib/business-report-generator";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();

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

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Verificar si es admin o cliente
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .single();
        
        if (roleData) {
          navigate("/dashboard");
        } else {
          navigate("/cliente/dashboard");
        }
      }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex justify-center mb-6">
            <div className="relative p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110">
              <Building2 className="h-16 w-16 text-primary animate-pulse" />
              <Sparkles className="h-6 w-6 text-primary absolute -top-2 -right-2 animate-bounce" />
            </div>
          </div>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent drop-shadow-lg">
            InmoFinder
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Plataforma inteligente de matching de propiedades inmobiliarias. 
            <span className="block mt-2 font-semibold text-foreground/80">
              Conecta clientes con sus propiedades ideales mediante scraping automático y scoring avanzado.
            </span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 min-w-[200px]"
            >
              <Zap className="mr-2 h-5 w-5" />
              Comenzar Ahora
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate("/auth")}
              className="border-2 hover:bg-primary/10 hover:border-primary transition-all duration-300 hover:scale-105 min-w-[200px]"
            >
              <Target className="mr-2 h-5 w-5" />
              Iniciar Sesión
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={handleGenerateReport}
              className="border-2 border-accent hover:bg-accent/10 hover:border-accent/80 transition-all duration-300 hover:scale-105 min-w-[200px]"
            >
              <FileText className="mr-2 h-5 w-5" />
              Ver Informe Demo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="group text-center p-8 rounded-xl border-2 bg-gradient-to-br from-card to-card/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-primary/50 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300 shadow-md">
                <Search className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">Scraping Automático</h3>
            <p className="text-muted-foreground leading-relaxed">
              Extrae propiedades de múltiples portales inmobiliarios automáticamente
            </p>
          </div>

          <div className="group text-center p-8 rounded-xl border-2 bg-gradient-to-br from-card to-card/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-primary/50 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300 shadow-md">
                <TrendingUp className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">Scoring Inteligente</h3>
            <p className="text-muted-foreground leading-relaxed">
              Algoritmo de matching que calcula la compatibilidad entre clientes y propiedades
            </p>
          </div>

          <div className="group text-center p-8 rounded-xl border-2 bg-gradient-to-br from-card to-card/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-primary/50 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300 shadow-md">
                <Users className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">Gestión de Clientes</h3>
            <p className="text-muted-foreground leading-relaxed">
              Define criterios de búsqueda personalizados para cada cliente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
