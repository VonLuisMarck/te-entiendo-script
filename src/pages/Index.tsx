import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Search, TrendingUp, Users, Sparkles, Target, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

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
