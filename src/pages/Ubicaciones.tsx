import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Upload, Download, Save, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const Ubicaciones = () => {
  const [jsonContent, setJsonContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCurrentJson();
  }, []);

  const loadCurrentJson = async () => {
    try {
      const { data, error } = await supabase
        .from('ubicaciones_config')
        .select('contenido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setJsonContent(JSON.stringify(data.contenido, null, 2));
      }
    } catch (error) {
      console.error("Error cargando JSON:", error);
      toast.error("Error al cargar el JSON actual");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        setJsonContent(JSON.stringify(parsed, null, 2));
        toast.success("Archivo cargado correctamente");
      } catch (error) {
        toast.error("Error: El archivo no es un JSON válido");
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ubicaciones.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON descargado");
  };

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(jsonContent);
      setIsLoading(true);

      // Obtener versión actual
      const { data: current } = await supabase
        .from('ubicaciones_config')
        .select('version')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newVersion = (current?.version || 0) + 1;

      // Guardar nueva versión
      const { error } = await supabase
        .from('ubicaciones_config')
        .insert({
          contenido: parsed,
          version: newVersion
        });

      if (error) throw error;

      toast.success("✅ Ubicaciones actualizadas correctamente (v" + newVersion + ")");
      loadCurrentJson();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("Error: JSON inválido. Revisa la sintaxis.");
      } else {
        console.error("Error guardando:", error);
        toast.error("Error al guardar las ubicaciones");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Gestión de Ubicaciones
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Configuración del Catálogo de Ubicaciones</CardTitle>
            <CardDescription>
              Gestiona las provincias, ciudades y distritos disponibles para clasificación. 
              Este JSON define qué ubicaciones puede usar la IA para clasificar propiedades.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <label htmlFor="file-upload">
                <input
                  id="file-upload"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Subir JSON
                  </span>
                </Button>
              </label>
              
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Descargar JSON
              </Button>

              <Button onClick={handleSave} disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contenido JSON:</label>
              <Textarea
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                className="font-mono text-sm min-h-[500px]"
                placeholder='{"Madrid": {"provincia": "Madrid", "ciudades": {...}}}'
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-semibold">📌 Formato esperado:</p>
              <pre className="text-xs overflow-x-auto">{`{
  "Madrid": {
    "provincia": "Madrid",
    "ciudades": {
      "Madrid": ["Chamberí", "Salamanca", "Centro"],
      "Alcalá de Henares": []
    }
  }
}`}</pre>
              <p className="text-muted-foreground mt-2">
                💡 <strong>Importante:</strong> Después de editar aquí, copia este JSON y actualízalo 
                en los archivos de las Edge Functions para que los cambios se apliquen.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Ubicaciones;
