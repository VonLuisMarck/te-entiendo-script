import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Database, 
  Filter, 
  CheckSquare, 
  Square, 
  Sparkles, 
  RefreshCw, 
  Home,
  Search,
  Calendar,
  Loader2,
  ExternalLink
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PropiedadRaw {
  id: string;
  external_id: string;
  portal_origen: string;
  url: string;
  raw_data: any;
  procesado: boolean;
  created_at: string;
  updated_at: string;
  intentos_procesamiento: number;
  error_procesamiento: string | null;
}

interface Stats {
  total: number;
  procesadas: number;
  pendientes: number;
  errores: number;
}

const PropiedadesRaw = () => {
  const navigate = useNavigate();
  const [propiedades, setPropiedades] = useState<PropiedadRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats>({ total: 0, procesadas: 0, pendientes: 0, errores: 0 });
  
  // Filtros
  const [portalFilter, setPortalFilter] = useState<string>("all");
  const [ubicacionFilter, setUbicacionFilter] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [soloErrores, setSoloErrores] = useState(false);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadPropiedades();
      loadStats();
    }
  }, [portalFilter, ubicacionFilter, fechaDesde, fechaHasta, soloErrores, currentPage]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      // Total
      const { count: total } = await supabase
        .from('propiedades_raw')
        .select('*', { count: 'exact', head: true });

      // Procesadas
      const { count: procesadas } = await supabase
        .from('propiedades_raw')
        .select('*', { count: 'exact', head: true })
        .eq('procesado', true);

      // Errores
      const { count: errores } = await supabase
        .from('propiedades_raw')
        .select('*', { count: 'exact', head: true })
        .not('error_procesamiento', 'is', null);

      setStats({
        total: total || 0,
        procesadas: procesadas || 0,
        pendientes: (total || 0) - (procesadas || 0),
        errores: errores || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPropiedades = async () => {
    try {
      let query = supabase
        .from('propiedades_raw')
        .select('*')
        .eq('procesado', false)
        .order('created_at', { ascending: false });

      if (portalFilter && portalFilter !== 'all') {
        query = query.eq('portal_origen', portalFilter);
      }

      if (ubicacionFilter) {
        query = query.ilike('raw_data->ubicacion', `%${ubicacionFilter}%`);
      }

      if (fechaDesde) {
        query = query.gte('created_at', new Date(fechaDesde).toISOString());
      }

      if (fechaHasta) {
        const endDate = new Date(fechaHasta);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      if (soloErrores) {
        query = query.not('error_procesamiento', 'is', null);
      }

      // Paginación
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;
      query = query.range(start, end);

      const { data, error } = await query;

      if (error) throw error;
      setPropiedades(data || []);
    } catch (error) {
      console.error('Error loading propiedades:', error);
      toast.error('Error al cargar propiedades raw');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === propiedades.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(propiedades.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchProcess = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos una propiedad');
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-classify-properties', {
        body: {
          property_ids: Array.from(selectedIds),
          max_propiedades: selectedIds.size
        }
      });

      if (error) throw error;

      toast.success(`Clasificación iniciada para ${selectedIds.size} propiedades. Procesando en segundo plano...`);
      
      // Limpiar selección y recargar
      setSelectedIds(new Set());
      setTimeout(() => {
        loadPropiedades();
        loadStats();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error processing batch:', error);
      toast.error(error.message || 'Error al procesar lote');
    } finally {
      setProcessing(false);
    }
  };

  const clearFilters = () => {
    setPortalFilter('all');
    setUbicacionFilter('');
    setFechaDesde('');
    setFechaHasta('');
    setSoloErrores(false);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allSelected = propiedades.length > 0 && selectedIds.size === propiedades.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Propiedades Raw</h1>
            </div>
          </div>
          <Button onClick={() => navigate('/batch-processing')} variant="outline">
            <Sparkles className="h-4 w-4 mr-2" />
            Batch Processing
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendientes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Procesadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.procesadas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Con Errores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.errores}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="portal">Portal</Label>
                <Select value={portalFilter} onValueChange={setPortalFilter}>
                  <SelectTrigger id="portal">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="fotocasa">Fotocasa</SelectItem>
                    <SelectItem value="idealista">Idealista</SelectItem>
                    <SelectItem value="pisos">Pisos.com</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ubicacion">Ubicación</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ubicacion"
                    placeholder="Buscar ubicación..."
                    value={ubicacionFilter}
                    onChange={(e) => setUbicacionFilter(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="fecha-desde">Fecha Desde</Label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fecha-desde"
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="fecha-hasta">Fecha Hasta</Label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fecha-hasta"
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="solo-errores"
                  checked={soloErrores}
                  onCheckedChange={(checked) => setSoloErrores(checked as boolean)}
                />
                <Label htmlFor="solo-errores" className="cursor-pointer">
                  Solo con errores
                </Label>
              </div>

              <Button variant="outline" onClick={clearFilters} size="sm">
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Acciones y Selección */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Deseleccionar Todas
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Seleccionar Todas
                    </>
                  )}
                </Button>
                
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} de {propiedades.length} seleccionadas
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadPropiedades();
                    loadStats();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>

                <Button
                  onClick={handleBatchProcess}
                  disabled={selectedIds.size === 0 || processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Clasificar Seleccionadas ({selectedIds.size})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {processing && (
              <div className="mt-4">
                <Progress value={33} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">
                  Procesando propiedades en segundo plano. Esto puede tardar unos minutos...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Propiedades */}
        <Card>
          <CardHeader>
            <CardTitle>Propiedades Raw Pendientes</CardTitle>
            <CardDescription>
              {propiedades.length} propiedades sin clasificar (Página {currentPage})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {propiedades.map((propiedad) => (
                <div
                  key={propiedad.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(propiedad.id)}
                    onCheckedChange={() => toggleSelect(propiedad.id)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-sm truncate">
                        {propiedad.raw_data?.titulo || 'Sin título'}
                      </h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary">
                          {propiedad.portal_origen}
                        </Badge>
                        {propiedad.error_procesamiento && (
                          <Badge variant="destructive">Error</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                      <div>
                        <strong>ID:</strong> {propiedad.external_id}
                      </div>
                      <div>
                        <strong>Ubicación:</strong> {propiedad.raw_data?.ubicacion || 'N/A'}
                      </div>
                      <div>
                        <strong>Precio:</strong> {propiedad.raw_data?.precio ? `${propiedad.raw_data.precio.toLocaleString('es-ES')} €` : 'N/A'}
                      </div>
                      <div>
                        <strong>Fecha:</strong> {new Date(propiedad.created_at).toLocaleDateString('es-ES')}
                      </div>
                    </div>

                    {propiedad.error_procesamiento && (
                      <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                        <strong>Error:</strong> {propiedad.error_procesamiento}
                      </div>
                    )}

                    {propiedad.intentos_procesamiento > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Intentos de procesamiento: {propiedad.intentos_procesamiento}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(propiedad.url, '_blank')}
                      className="mt-2"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver Original
                    </Button>
                  </div>
                </div>
              ))}

              {propiedades.length === 0 && (
                <div className="text-center py-12">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay propiedades pendientes</h3>
                  <p className="text-muted-foreground">
                    Todas las propiedades raw han sido procesadas o no hay resultados con estos filtros
                  </p>
                </div>
              )}
            </div>

            {/* Paginación */}
            {propiedades.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={propiedades.length < itemsPerPage}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PropiedadesRaw;
