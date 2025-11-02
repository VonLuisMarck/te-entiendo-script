import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Archive, Calendar, MapPin, Euro, TrendingDown, Home, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PropiedadHistorico {
  id: string;
  propiedad_id: string | null;
  external_id: string | null;
  portal_origen: string;
  precio: number;
  precio_m2: number | null;
  metros: number | null;
  dormitorios: number | null;
  banos: number | null;
  tipo_propiedad: string;
  ubicacion: string;
  ciudad: string | null;
  distrito: string | null;
  condition: string | null;
  ano_construccion: number | null;
  tiene_ascensor: boolean | null;
  tiene_parking: boolean | null;
  fecha_propiedad: string;
  fecha_archivado: string;
  motivo_archivado: string | null;
}

const Historico = () => {
  const [propiedades, setPropiedades] = useState<PropiedadHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    desactivadas: 0,
    borradas: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadHistorico();
  }, []);

  const loadHistorico = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("propiedades_historico")
        .select("*")
        .order("fecha_archivado", { ascending: false });

      if (error) throw error;

      setPropiedades(data || []);
      
      setStats({
        total: data?.length || 0,
        desactivadas: data?.filter(p => p.motivo_archivado === 'desactivado').length || 0,
        borradas: data?.filter(p => p.motivo_archivado === 'borrado').length || 0,
      });
    } catch (error) {
      console.error("Error cargando histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMotivoColor = (motivo: string | null) => {
    if (motivo === 'borrado') return 'destructive';
    if (motivo === 'desactivado') return 'secondary';
    return 'default';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Archive className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold">Histórico de Propiedades</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-elegant border-t-4 border-t-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Archivadas</CardTitle>
              <Archive className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Propiedades en histórico</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-t-4 border-t-secondary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Desactivadas</CardTitle>
              <TrendingDown className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">{stats.desactivadas}</div>
              <p className="text-xs text-muted-foreground mt-1">Propiedades inactivas</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-t-4 border-t-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Borradas</CardTitle>
              <TrendingDown className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.borradas}</div>
              <p className="text-xs text-muted-foreground mt-1">Eliminadas del sistema</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Propiedades Archivadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando histórico...
              </div>
            ) : propiedades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay propiedades archivadas
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Portal</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center">M²</TableHead>
                      <TableHead className="text-center">Hab</TableHead>
                      <TableHead>Fecha Propiedad</TableHead>
                      <TableHead>Fecha Archivado</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propiedades.map((prop) => (
                      <TableRow key={prop.id}>
                        <TableCell>
                          <Badge variant="outline">{prop.portal_origen}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Home className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{prop.tipo_propiedad}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{prop.ciudad || prop.ubicacion}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Euro className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{prop.precio.toLocaleString()}</span>
                          </div>
                          {prop.precio_m2 && (
                            <div className="text-xs text-muted-foreground">
                              {prop.precio_m2.toFixed(0)} €/m²
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{prop.metros || '-'}</TableCell>
                        <TableCell className="text-center">{prop.dormitorios || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(prop.fecha_propiedad), 'dd/MM/yyyy', { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(prop.fecha_archivado), 'dd/MM/yyyy', { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getMotivoColor(prop.motivo_archivado)}>
                            {prop.motivo_archivado || 'Sin especificar'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Historico;
