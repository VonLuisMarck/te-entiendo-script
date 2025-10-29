import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Phone, Calendar, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LlamadasIA() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [llamadas, setLlamadas] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [propiedades, setPropiedades] = useState<any[]>([]);
  const [iniciandoLlamada, setIniciandoLlamada] = useState<string | null>(null);
  
  // Estado para nueva llamada
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const [propiedadSeleccionada, setPropiedadSeleccionada] = useState("");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    try {
      // Obtener llamadas
      const { data: llamadasData } = await supabase
        .from("llamadas_ia")
        .select(`
          *,
          clientes (nombre, telefono),
          propiedades (titulo, ubicacion, precio)
        `)
        .order("created_at", { ascending: false });

      // Obtener visitas agendadas
      const { data: visitasData } = await supabase
        .from("visitas_agendadas")
        .select(`
          *,
          clientes (nombre, telefono),
          propiedades (titulo, ubicacion)
        `)
        .order("fecha_visita", { ascending: true });

      // Obtener clientes para el selector
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("id, nombre, telefono")
        .eq("activo", true)
        .order("nombre");

      // Obtener propiedades para el selector
      const { data: propiedadesData } = await supabase
        .from("propiedades")
        .select("id, titulo, ubicacion, precio")
        .eq("activo", true)
        .order("fecha_publicacion", { ascending: false })
        .limit(50);

      setLlamadas(llamadasData || []);
      setVisitas(visitasData || []);
      setClientes(clientesData || []);
      setPropiedades(propiedadesData || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const programarLlamada = async () => {
    if (!clienteSeleccionado || !propiedadSeleccionada || !telefono) {
      toast({
        title: "Error",
        description: "Completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("llamadas_ia")
        .insert({
          cliente_id: clienteSeleccionado,
          propiedad_id: propiedadSeleccionada,
          telefono,
          estado: "pendiente",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Llamada programada",
        description: "La llamada ha sido programada correctamente",
      });

      setDialogOpen(false);
      setClienteSeleccionado("");
      setPropiedadSeleccionada("");
      setTelefono("");
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudo programar la llamada",
        variant: "destructive",
      });
    }
  };

  const iniciarLlamada = async (llamadaId: string) => {
    setIniciandoLlamada(llamadaId);
    try {
      const { data, error } = await supabase.functions.invoke("ai-call-agent", {
        body: { llamadaId },
      });

      if (error) throw error;

      toast({
        title: "Llamada iniciada",
        description: "El agente de IA está llamando al cliente",
      });

      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la llamada",
        variant: "destructive",
      });
    } finally {
      setIniciandoLlamada(null);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, any> = {
      pendiente: { variant: "secondary", icon: Clock },
      en_proceso: { variant: "default", icon: Phone },
      completada: { variant: "default", icon: CheckCircle },
      fallida: { variant: "destructive", icon: XCircle },
      cancelada: { variant: "outline", icon: XCircle },
    };

    const config = variants[estado] || variants.pendiente;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  const getNivelInteresBadge = (nivel: string) => {
    const colors: Record<string, string> = {
      alto: "bg-green-500",
      medio: "bg-yellow-500",
      bajo: "bg-orange-500",
      ninguno: "bg-gray-500",
    };

    return (
      <Badge className={colors[nivel] || colors.ninguno}>
        Interés: {nivel}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">Llamadas con IA</h1>
            <p className="text-muted-foreground mt-2">
              Sistema inteligente de llamadas para presentar propiedades
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Phone className="h-4 w-4" />
                Programar Llamada
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Programar Nueva Llamada</DialogTitle>
                <DialogDescription>
                  Selecciona el cliente y la propiedad para la llamada
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={clienteSeleccionado} onValueChange={(value) => {
                    setClienteSeleccionado(value);
                    const cliente = clientes.find(c => c.id === value);
                    if (cliente?.telefono) setTelefono(cliente.telefono);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Propiedad</Label>
                  <Select value={propiedadSeleccionada} onValueChange={setPropiedadSeleccionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una propiedad" />
                    </SelectTrigger>
                    <SelectContent>
                      {propiedades.map((prop) => (
                        <SelectItem key={prop.id} value={prop.id}>
                          {prop.titulo} - {prop.ubicacion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    type="tel"
                    placeholder="+34 600 000 000"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </div>
                <Button onClick={programarLlamada} className="w-full">
                  Programar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Historial de Llamadas */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Llamadas</CardTitle>
            <CardDescription>Todas las llamadas realizadas por el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {llamadas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay llamadas registradas
                </p>
              ) : (
                llamadas.map((llamada) => (
                  <Card key={llamada.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            {getEstadoBadge(llamada.estado)}
                            {llamada.resultado?.nivel_interes && 
                              getNivelInteresBadge(llamada.resultado.nivel_interes)
                            }
                          </div>
                          <h3 className="font-semibold">
                            {llamada.clientes?.nombre} - {llamada.propiedades?.titulo}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {llamada.propiedades?.ubicacion} • {llamada.propiedades?.precio?.toLocaleString()}€
                          </p>
                          {llamada.duracion_segundos && (
                            <p className="text-sm text-muted-foreground">
                              Duración: {Math.floor(llamada.duracion_segundos / 60)}m {llamada.duracion_segundos % 60}s
                            </p>
                          )}
                          {llamada.resultado?.dias_disponibles?.length > 0 && (
                            <p className="text-sm">
                              <strong>Disponibilidad:</strong> {llamada.resultado.dias_disponibles.join(", ")}
                              {llamada.resultado.horarios_disponibles?.length > 0 && 
                                ` (${llamada.resultado.horarios_disponibles.join(", ")})`
                              }
                            </p>
                          )}
                          {llamada.transcripcion && (
                            <details className="text-sm">
                              <summary className="cursor-pointer text-primary">
                                Ver transcripción
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                                {llamada.transcripcion}
                              </pre>
                            </details>
                          )}
                        </div>
                        <div className="ml-4">
                          {llamada.estado === "pendiente" && (
                            <Button
                              onClick={() => iniciarLlamada(llamada.id)}
                              disabled={iniciandoLlamada === llamada.id}
                              className="gap-2"
                            >
                              {iniciandoLlamada === llamada.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Phone className="h-4 w-4" />
                              )}
                              Iniciar Llamada
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visitas Agendadas */}
        <Card>
          <CardHeader>
            <CardTitle>Visitas Agendadas</CardTitle>
            <CardDescription>Visitas resultantes de las llamadas exitosas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {visitas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay visitas agendadas
                </p>
              ) : (
                visitas.map((visita) => (
                  <Card key={visita.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <Badge variant={visita.estado === "confirmada" ? "default" : "secondary"}>
                            {visita.estado.charAt(0).toUpperCase() + visita.estado.slice(1)}
                          </Badge>
                          <h3 className="font-semibold">
                            {visita.clientes?.nombre} - {visita.propiedades?.titulo}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(visita.fecha_visita).toLocaleDateString('es-ES')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {visita.hora_visita}
                            </div>
                          </div>
                          {visita.notas && (
                            <p className="text-sm text-muted-foreground">{visita.notas}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
