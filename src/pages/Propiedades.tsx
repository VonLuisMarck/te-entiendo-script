import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, Bed, Bath, Maximize, Euro, Calendar, LogOut, Home, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { generarPDFAnalisis } from "@/lib/pdf-generator";

interface Propiedad {
  id: string;
  titulo: string;
  descripcion: string;
  precio: number;
  ubicacion: string;
  tipo_propiedad: string;
  dormitorios: number;
  banos: number;
  metros: number;
  precio_m2: number;
  condition: string;
  portal_origen: string;
  url: string;
  fecha_scraping: string;
}

const Propiedades = () => {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadPropiedades();
      }
    });
  }, [navigate]);

  const loadPropiedades = async () => {
    try {
      const { data, error } = await supabase
        .from("propiedades")
        .select("*")
        .eq("activo", true)
        .order("fecha_scraping", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPropiedades(data || []);
    } catch (error) {
      console.error("Error loading propiedades:", error);
      toast.error("Error al cargar propiedades");
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarAnalisis = async (propiedad: Propiedad) => {
    setGeneratingPDF(propiedad.id);
    try {
      // Obtener sesión del usuario para buscar su perfil
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Debe iniciar sesión para descargar el análisis");
        return;
      }

      // Buscar cliente del usuario
      const { data: cliente } = await supabase
        .from("clientes")
        .select("perfil")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // Buscar matching de esta propiedad con el usuario
      const { data: matching } = await supabase
        .from("matchings")
        .select("*, clientes!inner(user_id)")
        .eq("propiedad_id", propiedad.id)
        .eq("clientes.user_id", session.user.id)
        .maybeSingle();

      // Buscar métricas de la zona
      const [ciudad, barrio] = propiedad.ubicacion.split(',').map(s => s.trim());
      
      // Intentar primero con barrio específico, luego ciudad
      let metrica = null;
      if (barrio) {
        const { data } = await supabase
          .from("metricas_barrios")
          .select("*")
          .eq("ciudad", ciudad)
          .eq("barrio", barrio)
          .maybeSingle();
        metrica = data;
      }
      
      // Si no hay métricas de barrio, buscar de ciudad
      if (!metrica) {
        const { data } = await supabase
          .from("metricas_barrios")
          .select("*")
          .eq("ciudad", ciudad)
          .is("barrio", null)
          .maybeSingle();
        metrica = data;
      }

      // Generar PDF
      await generarPDFAnalisis({
        propiedad,
        matching: matching || undefined,
        metrica: metrica || undefined,
        clientePerfil: cliente?.perfil || 'vivir'
      });

      toast.success("Análisis descargado correctamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el análisis PDF");
    } finally {
      setGeneratingPDF(null);
    }
  };

  const filteredPropiedades = propiedades.filter(
    (prop) =>
      prop.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.ubicacion.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Propiedades</h1>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Input
            placeholder="Buscar por título o ubicación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando propiedades...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPropiedades.map((propiedad) => (
              <Card key={propiedad.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary">{propiedad.tipo_propiedad}</Badge>
                    <Badge variant="outline">{propiedad.portal_origen}</Badge>
                  </div>
                  <CardTitle className="text-lg">{propiedad.titulo}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {propiedad.ubicacion}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-bold text-primary">
                    {propiedad.precio.toLocaleString('es-ES')} €
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {propiedad.precio_m2?.toFixed(0)} €/m²
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>{propiedad.dormitorios}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span>{propiedad.banos}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Maximize className="h-4 w-4 text-muted-foreground" />
                      <span>{propiedad.metros} m²</span>
                    </div>
                  </div>

                  {propiedad.condition && (
                    <Badge variant="outline" className="text-xs">
                      {propiedad.condition}
                    </Badge>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(propiedad.fecha_scraping).toLocaleDateString('es-ES')}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDescargarAnalisis(propiedad)}
                      disabled={generatingPDF === propiedad.id}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {generatingPDF === propiedad.id ? "Generando..." : "Análisis PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(propiedad.url, '_blank')}
                    >
                      Ver en {propiedad.portal_origen}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredPropiedades.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No se encontraron propiedades
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Propiedades;
