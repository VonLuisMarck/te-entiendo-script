import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Home, LogOut, Plus, Edit, MapPin, Euro, Bed, Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { z } from "zod";

const clienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100, "Nombre demasiado largo"),
  email: z.string().email("Email inválido").max(255, "Email demasiado largo"),
  telefono: z.string().regex(/^[+]?[0-9]{9,15}$/, "Teléfono inválido (9-15 dígitos)").optional().or(z.literal("")),
  tipo_suscripcion: z.enum(['free', 'basic', 'premium']),
  presupuesto_min: z.number().positive("El presupuesto mínimo debe ser positivo").max(10000000, "Presupuesto demasiado alto"),
  presupuesto_max: z.number().positive("El presupuesto máximo debe ser positivo").max(10000000, "Presupuesto demasiado alto"),
  ubicaciones: z.array(z.string().trim().min(1).max(100)).min(1, "Debe seleccionar al menos una ubicación").max(10, "Máximo 10 ubicaciones"),
  tipo_propiedad: z.array(z.string()).min(1, "Debe seleccionar al menos un tipo de propiedad"),
  dormitorios_min: z.number().int().min(0).max(10).optional(),
  metros_min: z.number().positive().max(10000).optional(),
  metros_max: z.number().positive().max(10000).optional(),
  condition: z.array(z.string()),
}).refine(data => data.presupuesto_max >= data.presupuesto_min, {
  message: "El presupuesto máximo debe ser mayor o igual al mínimo",
  path: ["presupuesto_max"],
}).refine(data => !data.metros_max || !data.metros_min || data.metros_max >= data.metros_min, {
  message: "Los metros máximos deben ser mayores o iguales a los mínimos",
  path: ["metros_max"],
});

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  presupuesto_min: number;
  presupuesto_max: number;
  activo: boolean;
  perfil: 'alquilar' | 'vender' | 'vivir';
  criterios_busqueda?: Array<{
    ubicaciones: string[];
    tipo_propiedad: string[];
    dormitorios_min: number;
    metros_min: number;
    metros_max: number;
    condition: string[];
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
    tipo_suscripcion: "free" as 'free' | 'basic' | 'premium',
    presupuesto_min: "",
    presupuesto_max: "",
    perfil: "vivir" as 'alquilar' | 'vender' | 'vivir',
    ubicaciones: [] as string[],
    tipo_propiedad: [] as string[],
    dormitorios_min: "",
    metros_min: "",
    metros_max: "",
    condition: [] as string[],
    tiene_ascensor: false,
    tiene_parking: false,
  });
  const [ubicacionInput, setUbicacionInput] = useState("");
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
            dormitorios_min,
            metros_min,
            metros_max,
            condition
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data as any || []);
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

      // Validate form data
      const validated = clienteSchema.parse({
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono || undefined,
        tipo_suscripcion: formData.tipo_suscripcion,
        presupuesto_min: parseFloat(formData.presupuesto_min),
        presupuesto_max: parseFloat(formData.presupuesto_max),
        ubicaciones: formData.ubicaciones,
        tipo_propiedad: formData.tipo_propiedad,
        dormitorios_min: formData.dormitorios_min ? parseInt(formData.dormitorios_min) : undefined,
        metros_min: formData.metros_min ? parseFloat(formData.metros_min) : undefined,
        metros_max: formData.metros_max ? parseFloat(formData.metros_max) : undefined,
        condition: formData.condition,
      });

      // Crear cliente
      const { data: newCliente, error: clienteError } = await supabase.from("clientes").insert({
        user_id: session.session.user.id,
        nombre: validated.nombre,
        email: validated.email,
        telefono: validated.telefono || null,
        tipo_suscripcion: validated.tipo_suscripcion,
        presupuesto_min: validated.presupuesto_min,
        presupuesto_max: validated.presupuesto_max,
        perfil: formData.perfil,
      }).select().single();

      if (clienteError) throw clienteError;

      // Crear criterios de búsqueda
      const { error: criteriosError } = await supabase.from("criterios_busqueda").insert({
        cliente_id: newCliente.id,
        ubicaciones: validated.ubicaciones,
        tipo_propiedad: validated.tipo_propiedad,
        dormitorios_min: validated.dormitorios_min || null,
        metros_min: validated.metros_min || null,
        metros_max: validated.metros_max || null,
        condition: validated.condition,
        tiene_ascensor: formData.tiene_ascensor ? true : null,
        tiene_parking: formData.tiene_parking ? true : null,
      });

      if (criteriosError) throw criteriosError;

      toast.success("Cliente y preferencias creados exitosamente");
      setDialogOpen(false);
      setFormData({ 
        nombre: "", email: "", telefono: "", tipo_suscripcion: "free", presupuesto_min: "", presupuesto_max: "",
        perfil: "vivir", ubicaciones: [], tipo_propiedad: [], dormitorios_min: "",
        metros_min: "", metros_max: "", condition: [], tiene_ascensor: false, tiene_parking: false
      });
      setUbicacionInput("");
      loadClientes();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error al crear cliente. Por favor verifica los datos.");
      }
    }
  };

  const addUbicacion = () => {
    if (ubicacionInput.trim() && !formData.ubicaciones.includes(ubicacionInput.trim())) {
      setFormData({ ...formData, ubicaciones: [...formData.ubicaciones, ubicacionInput.trim()] });
      setUbicacionInput("");
    }
  };

  const removeUbicacion = (ubi: string) => {
    setFormData({ ...formData, ubicaciones: formData.ubicaciones.filter(u => u !== ubi) });
  };

  const toggleTipoPropiedad = (tipo: string) => {
    setFormData({
      ...formData,
      tipo_propiedad: formData.tipo_propiedad.includes(tipo)
        ? formData.tipo_propiedad.filter(t => t !== tipo)
        : [...formData.tipo_propiedad, tipo]
    });
  };

  const toggleCondition = (cond: string) => {
    setFormData({
      ...formData,
      condition: formData.condition.includes(cond)
        ? formData.condition.filter(c => c !== cond)
        : [...formData.condition, cond]
    });
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
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Cliente</DialogTitle>
                  <DialogDescription>Añade un nuevo cliente y sus preferencias</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Datos Básicos */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Datos Básicos</h3>
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
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
                    </div>
                  </div>

                  {/* Tipo de Suscripción */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Tipo de Suscripción *</h3>
                    <Select value={formData.tipo_suscripcion} onValueChange={(value: any) => setFormData({ ...formData, tipo_suscripcion: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">🆓 Free - Notificaciones básicas</SelectItem>
                        <SelectItem value="basic">📱 Basic - Notificaciones mejoradas</SelectItem>
                        <SelectItem value="premium">⭐ Premium - Notificaciones + PDF por WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Perfil */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Perfil de Inversión *</h3>
                    <Select value={formData.perfil} onValueChange={(value: any) => setFormData({ ...formData, perfil: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vivir">🏡 Comprar para vivir</SelectItem>
                        <SelectItem value="alquilar">💰 Comprar para alquilar</SelectItem>
                        <SelectItem value="vender">📈 Comprar para vender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Presupuesto */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Presupuesto</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="presupuesto_min">Mínimo (€)</Label>
                        <Input
                          id="presupuesto_min"
                          type="number"
                          value={formData.presupuesto_min}
                          onChange={(e) => setFormData({ ...formData, presupuesto_min: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="presupuesto_max">Máximo (€)</Label>
                        <Input
                          id="presupuesto_max"
                          type="number"
                          value={formData.presupuesto_max}
                          onChange={(e) => setFormData({ ...formData, presupuesto_max: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ubicaciones */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Ubicaciones *</h3>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ej: Murcia Centro"
                        value={ubicacionInput}
                        onChange={(e) => setUbicacionInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addUbicacion())}
                      />
                      <Button type="button" onClick={addUbicacion} variant="secondary">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.ubicaciones.map((ubi) => (
                        <Badge key={ubi} variant="secondary" className="cursor-pointer" onClick={() => removeUbicacion(ubi)}>
                          {ubi} ✕
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de Propiedad */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Tipo de Propiedad</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {['piso', 'casa', 'apartamento', 'chalet'].map((tipo) => (
                        <div key={tipo} className="flex items-center space-x-2">
                          <Checkbox
                            id={tipo}
                            checked={formData.tipo_propiedad.includes(tipo)}
                            onCheckedChange={() => toggleTipoPropiedad(tipo)}
                          />
                          <label htmlFor={tipo} className="text-sm cursor-pointer capitalize">
                            {tipo}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Características */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Características</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dormitorios_min">Dormitorios Min</Label>
                        <Input
                          id="dormitorios_min"
                          type="number"
                          min="0"
                          value={formData.dormitorios_min}
                          onChange={(e) => setFormData({ ...formData, dormitorios_min: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metros_min">m² Min</Label>
                        <Input
                          id="metros_min"
                          type="number"
                          value={formData.metros_min}
                          onChange={(e) => setFormData({ ...formData, metros_min: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metros_max">m² Max</Label>
                        <Input
                          id="metros_max"
                          type="number"
                          value={formData.metros_max}
                          onChange={(e) => setFormData({ ...formData, metros_max: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tiene_ascensor"
                          checked={formData.tiene_ascensor}
                          onCheckedChange={(checked) => setFormData({ ...formData, tiene_ascensor: checked as boolean })}
                        />
                        <label htmlFor="tiene_ascensor" className="text-sm cursor-pointer">
                          Ascensor
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tiene_parking"
                          checked={formData.tiene_parking}
                          onCheckedChange={(checked) => setFormData({ ...formData, tiene_parking: checked as boolean })}
                        />
                        <label htmlFor="tiene_parking" className="text-sm cursor-pointer">
                          Parking
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Estado</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {['nuevo', 'buen estado', 'a reformar'].map((cond) => (
                        <div key={cond} className="flex items-center space-x-2">
                          <Checkbox
                            id={cond}
                            checked={formData.condition.includes(cond)}
                            onCheckedChange={() => toggleCondition(cond)}
                          />
                          <label htmlFor={cond} className="text-sm cursor-pointer capitalize">
                            {cond}
                          </label>
                        </div>
                      ))}
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
                    <div>
                      <CardTitle className="text-lg">{cliente.nombre}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {cliente.perfil === 'vivir' ? '🏡 Vivir' : cliente.perfil === 'alquilar' ? '💰 Alquilar' : '📈 Vender'}
                      </Badge>
                    </div>
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
                  
                  {(cliente.presupuesto_min || cliente.presupuesto_max) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {cliente.presupuesto_min?.toLocaleString('es-ES')} - {cliente.presupuesto_max?.toLocaleString('es-ES')} €
                      </span>
                    </div>
                  )}

                  {cliente.criterios_busqueda && cliente.criterios_busqueda[0] && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold">Criterios:</p>
                      {cliente.criterios_busqueda[0].ubicaciones && cliente.criterios_busqueda[0].ubicaciones.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cliente.criterios_busqueda[0].ubicaciones.map((ubi, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {ubi}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {cliente.criterios_busqueda[0].tipo_propiedad && cliente.criterios_busqueda[0].tipo_propiedad.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cliente.criterios_busqueda[0].tipo_propiedad.map((tipo, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs capitalize">
                              <Building className="h-3 w-3 mr-1" />
                              {tipo}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {cliente.criterios_busqueda[0].dormitorios_min && (
                        <div className="text-xs text-muted-foreground">
                          <Bed className="h-3 w-3 inline mr-1" />
                          Min {cliente.criterios_busqueda[0].dormitorios_min} dormitorios
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
