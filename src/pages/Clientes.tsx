import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Home, LogOut, Plus, Edit, MapPin, Euro } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  presupuesto_min: number;
  presupuesto_max: number;
  activo: boolean;
  criterios_busqueda?: Array<{
    ubicaciones: string[];
    tipo_propiedad: string[];
    dormitorios_min: number;
  }>;
}

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    presupuesto_min: "",
    presupuesto_max: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadClientes();
      }
    });
  }, [navigate]);

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          criterios_busqueda (
            ubicaciones,
            tipo_propiedad,
            dormitorios_min
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error("Error loading clientes:", error);
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("No hay sesión activa");

      const { error } = await supabase.from("clientes").insert({
        user_id: session.session.user.id,
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        presupuesto_min: parseFloat(formData.presupuesto_min),
        presupuesto_max: parseFloat(formData.presupuesto_max),
      });

      if (error) throw error;
      toast.success("Cliente creado exitosamente");
      setDialogOpen(false);
      setFormData({ nombre: "", email: "", telefono: "", presupuesto_min: "", presupuesto_max: "" });
      loadClientes();
    } catch (error: any) {
      toast.error(error.message || "Error al crear cliente");
    }
  };

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
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Clientes</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Cliente</DialogTitle>
                  <DialogDescription>Añade un nuevo cliente al sistema</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="presupuesto_min">Presupuesto Min (€)</Label>
                      <Input
                        id="presupuesto_min"
                        type="number"
                        value={formData.presupuesto_min}
                        onChange={(e) => setFormData({ ...formData, presupuesto_min: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="presupuesto_max">Presupuesto Max (€)</Label>
                      <Input
                        id="presupuesto_max"
                        type="number"
                        value={formData.presupuesto_max}
                        onChange={(e) => setFormData({ ...formData, presupuesto_max: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Crear Cliente</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando clientes...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientes.map((cliente) => (
              <Card key={cliente.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{cliente.nombre}</CardTitle>
                    <Badge variant={cliente.activo ? "default" : "secondary"}>
                      {cliente.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <CardDescription>{cliente.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cliente.telefono && (
                    <p className="text-sm text-muted-foreground">📞 {cliente.telefono}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {cliente.presupuesto_min?.toLocaleString('es-ES')} - {cliente.presupuesto_max?.toLocaleString('es-ES')} €
                    </span>
                  </div>

                  {cliente.criterios_busqueda && cliente.criterios_busqueda[0] && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold">Criterios:</p>
                      {cliente.criterios_busqueda[0].ubicaciones && (
                        <div className="flex flex-wrap gap-1">
                          {cliente.criterios_busqueda[0].ubicaciones.map((ubi, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {ubi}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && clientes.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No hay clientes todavía</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Cliente
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Clientes;
