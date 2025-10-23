import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Search, TrendingUp, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Building2 className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            InmoFinder
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma inteligente de matching de propiedades inmobiliarias. Conecta clientes con sus propiedades ideales mediante scraping automático y scoring avanzado.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Comenzar Ahora
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Iniciar Sesión
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-6 rounded-lg border bg-card">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Search className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Scraping Automático</h3>
            <p className="text-muted-foreground">
              Extrae propiedades de múltiples portales inmobiliarios automáticamente
            </p>
          </div>

          <div className="text-center p-6 rounded-lg border bg-card">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Scoring Inteligente</h3>
            <p className="text-muted-foreground">
              Algoritmo de matching que calcula la compatibilidad entre clientes y propiedades
            </p>
          </div>

          <div className="text-center p-6 rounded-lg border bg-card">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Gestión de Clientes</h3>
            <p className="text-muted-foreground">
              Define criterios de búsqueda personalizados para cada cliente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
