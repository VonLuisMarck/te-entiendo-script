import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';
import { 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Search, 
  Bell, 
  TrendingUp, 
  Crown,
  Sparkles,
  MapPin,
  Home,
  Euro
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEPS = [
  { id: 1, title: 'Bienvenida', icon: Sparkles },
  { id: 2, title: 'Tu Plan', icon: Crown },
  { id: 3, title: 'Configuración', icon: Search },
  { id: 4, title: 'Listo', icon: CheckCircle },
];

const ClienteOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tier, checkSubscription } = useSubscription();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  
  // Criterios de búsqueda
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [nuevaUbicacion, setNuevaUbicacion] = useState('');
  const [presupuestoMin, setPresupuestoMin] = useState('');
  const [presupuestoMax, setPresupuestoMax] = useState('');
  const [tipoPropiedad, setTipoPropiedad] = useState<string[]>([]);

  useEffect(() => {
    checkExistingCliente();
  }, []);

  const checkExistingCliente = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    // Verificar si ya existe un cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (cliente) {
      setClienteId(cliente.id);
    }
  };

  const addUbicacion = () => {
    if (nuevaUbicacion.trim() && ubicaciones.length < 5) {
      setUbicaciones([...ubicaciones, nuevaUbicacion.trim()]);
      setNuevaUbicacion('');
    }
  };

  const removeUbicacion = (index: number) => {
    setUbicaciones(ubicaciones.filter((_, i) => i !== index));
  };

  const toggleTipoPropiedad = (tipo: string) => {
    if (tipoPropiedad.includes(tipo)) {
      setTipoPropiedad(tipoPropiedad.filter(t => t !== tipo));
    } else {
      setTipoPropiedad([...tipoPropiedad, tipo]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Crear o actualizar cliente
      let finalClienteId = clienteId;
      
      if (!finalClienteId) {
        const { data: newCliente, error: clienteError } = await supabase
          .from('clientes')
          .insert({
            user_id: user.id,
            nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
            email: user.email!,
            perfil: 'invertir',
            presupuesto_min: presupuestoMin ? parseFloat(presupuestoMin) : null,
            presupuesto_max: presupuestoMax ? parseFloat(presupuestoMax) : null,
          })
          .select('id')
          .single();

        if (clienteError) throw clienteError;
        finalClienteId = newCliente.id;
      } else {
        // Actualizar presupuestos
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            presupuesto_min: presupuestoMin ? parseFloat(presupuestoMin) : null,
            presupuesto_max: presupuestoMax ? parseFloat(presupuestoMax) : null,
          })
          .eq('id', finalClienteId);

        if (updateError) throw updateError;
      }

      // Crear criterios de búsqueda si hay ubicaciones
      if (ubicaciones.length > 0 && finalClienteId) {
        const { error: criteriosError } = await supabase
          .from('criterios_busqueda')
          .insert({
            cliente_id: finalClienteId,
            ubicaciones,
            tipo_propiedad: tipoPropiedad.length > 0 ? tipoPropiedad : null,
          });

        if (criteriosError) throw criteriosError;
      }

      toast({
        title: "¡Bienvenido a InmoFinder! 🎉",
        description: "Tu cuenta ha sido configurada correctamente.",
      });

      navigate('/cliente/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "No se pudo completar la configuración. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-elegant">
        <CardHeader className="text-center border-b">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                      ${isActive ? 'border-primary bg-primary text-primary-foreground' : ''}
                      ${isCompleted ? 'border-success bg-success text-white' : ''}
                      ${!isActive && !isCompleted ? 'border-muted bg-muted/20 text-muted-foreground' : ''}
                    `}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`
                        w-16 h-0.5 mx-2
                        ${currentStep > step.id ? 'bg-success' : 'bg-muted'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <Progress value={progress} className="h-2 mb-4" />
          <CardTitle className="text-3xl">
            {STEPS[currentStep - 1].title}
          </CardTitle>
          <CardDescription>
            Paso {currentStep} de {STEPS.length}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          {/* Step 1: Bienvenida */}
          {currentStep === 1 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Sparkles className="h-16 w-16 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">¡Bienvenido a InmoFinder!</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Tu plataforma de inteligencia inmobiliaria que te ayuda a encontrar las mejores oportunidades 
                de inversión mediante análisis avanzado de mercado y matchings inteligentes.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Search className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h4 className="font-semibold mb-1">Matchings Inteligentes</h4>
                  <p className="text-sm text-muted-foreground">
                    Recibe propiedades que coinciden con tus criterios
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h4 className="font-semibold mb-1">Análisis de Mercado</h4>
                  <p className="text-sm text-muted-foreground">
                    Métricas en tiempo real de €/m² y tendencias
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Bell className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h4 className="font-semibold mb-1">Alertas Personalizadas</h4>
                  <p className="text-sm text-muted-foreground">
                    Notificaciones cuando aparecen oportunidades
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Plan actual */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Tu Plan Actual</h3>
                <p className="text-muted-foreground">
                  Conoce las funcionalidades disponibles en tu plan
                </p>
              </div>

              <Card className="border-2 border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">
                      {SUBSCRIPTION_TIERS[tier].name}
                    </CardTitle>
                    <Badge variant="default" className="text-lg px-4 py-1">
                      €{SUBSCRIPTION_TIERS[tier].price}/mes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {SUBSCRIPTION_TIERS[tier].features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {tier === 'free' && (
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-1">¿Quieres más funcionalidades?</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Actualiza tu plan para desbloquear alertas, análisis de reforma, datos INE y más.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/cliente/dashboard')}
                      >
                        Ver Planes Premium
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Configuración */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Configura tus Preferencias</h3>
                <p className="text-muted-foreground">
                  Cuéntanos qué tipo de propiedades buscas para recibir matchings personalizados
                </p>
              </div>

              {/* Ubicaciones */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ubicaciones de Interés
                </Label>
                <p className="text-sm text-muted-foreground">
                  Añade hasta 5 ciudades o zonas donde quieres buscar propiedades
                </p>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: Madrid, Barcelona, Valencia..."
                    value={nuevaUbicacion}
                    onChange={(e) => setNuevaUbicacion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUbicacion())}
                    disabled={ubicaciones.length >= 5}
                  />
                  <Button 
                    onClick={addUbicacion}
                    disabled={!nuevaUbicacion.trim() || ubicaciones.length >= 5}
                  >
                    Añadir
                  </Button>
                </div>

                {ubicaciones.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ubicaciones.map((ubicacion, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive/10"
                        onClick={() => removeUbicacion(index)}
                      >
                        {ubicacion} ✕
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Presupuesto */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Rango de Presupuesto
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Mínimo</Label>
                    <Input
                      type="number"
                      placeholder="50,000"
                      value={presupuestoMin}
                      onChange={(e) => setPresupuestoMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Máximo</Label>
                    <Input
                      type="number"
                      placeholder="200,000"
                      value={presupuestoMax}
                      onChange={(e) => setPresupuestoMax(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Tipo de Propiedad */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Tipo de Propiedad
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {['Piso', 'Casa', 'Chalet', 'Ático'].map((tipo) => (
                    <Button
                      key={tipo}
                      variant={tipoPropiedad.includes(tipo) ? 'default' : 'outline'}
                      onClick={() => toggleTipoPropiedad(tipo)}
                      className="justify-start"
                    >
                      {tipoPropiedad.includes(tipo) && (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {tipo}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Consejo:</strong> Puedes modificar estos criterios en cualquier momento desde tu panel de configuración.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Finalización */}
          {currentStep === 4 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-success/10 rounded-full">
                  <CheckCircle className="h-16 w-16 text-success" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold">¡Todo Listo!</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Tu cuenta está configurada. Ahora puedes empezar a recibir matchings de propiedades 
                que se ajusten a tus criterios y explorar el análisis de mercado.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <Card className="text-left">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Próximos Pasos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>• Explora tu dashboard personalizado</p>
                    <p>• Revisa métricas de mercado en tiempo real</p>
                    <p>• Configura alertas personalizadas</p>
                    <p>• Analiza oportunidades de inversión</p>
                  </CardContent>
                </Card>

                <Card className="text-left">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Tu Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>{SUBSCRIPTION_TIERS[tier].name}</strong></p>
                    <p>Matchings: {SUBSCRIPTION_TIERS[tier].limits.matchings || '∞'}/mes</p>
                    <p>Alertas: {SUBSCRIPTION_TIERS[tier].limits.alertas ? '✓' : '✗'}</p>
                    <p>Dashboard: {SUBSCRIPTION_TIERS[tier].limits.dashboard}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>

        <div className="border-t p-6 flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              onClick={() => setCurrentStep(Math.min(STEPS.length, currentStep + 1))}
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={loading}
            >
              {loading ? (
                <>Configurando...</>
              ) : (
                <>
                  Ir al Dashboard
                  <CheckCircle className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ClienteOnboarding;
