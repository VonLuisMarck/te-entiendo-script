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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
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
  Euro,
  User,
  Target,
  Building2,
  Ruler,
  Bed,
  Bath,
  Car,
  Calendar,
  Wrench,
  Heart
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { z } from 'zod';

const STEPS = [
  { id: 1, title: 'Bienvenida', icon: Sparkles },
  { id: 2, title: 'Tu Plan', icon: Crown },
  { id: 3, title: 'Perfil', icon: User },
  { id: 4, title: 'Ubicación', icon: MapPin },
  { id: 5, title: 'Presupuesto', icon: Euro },
  { id: 6, title: 'Propiedad', icon: Building2 },
  { id: 7, title: 'Características', icon: Home },
  { id: 8, title: 'Finalizar', icon: CheckCircle },
];

const criteriosSchema = z.object({
  ubicaciones: z.array(z.string()).min(1, "Añade al menos una ubicación"),
  presupuestoMin: z.number().positive("El presupuesto mínimo debe ser mayor a 0").optional(),
  presupuestoMax: z.number().positive("El presupuesto máximo debe ser mayor a 0").optional(),
  telefono: z.string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, "Número de teléfono inválido. Usa formato internacional (ej: +34612345678)")
    .min(9, "El teléfono debe tener al menos 9 dígitos")
    .max(20, "El teléfono no puede tener más de 20 caracteres"),
});

const ClienteOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tier, checkSubscription } = useSubscription();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  
  // Perfil inversor
  const [perfil, setPerfil] = useState('vivir');
  const [telefono, setTelefono] = useState('');
  const [objetivoInversion, setObjetivoInversion] = useState('rentabilidad');
  const [horizonteTemporal, setHorizonteTemporal] = useState('medio');
  const [perfilRiesgo, setPerfilRiesgo] = useState('moderado');
  
  // Ubicaciones
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [nuevaUbicacion, setNuevaUbicacion] = useState('');
  const [tipoZona, setTipoZona] = useState<string[]>([]);
  const [proximidadServicios, setProximidadServicios] = useState<string[]>([]);
  
  // Presupuesto
  const [presupuestoMin, setPresupuestoMin] = useState('');
  const [presupuestoMax, setPresupuestoMax] = useState('');
  const [flexibilidadPresupuesto, setFlexibilidadPresupuesto] = useState(10);
  
  // Tipo de propiedad
  const [tipoPropiedad, setTipoPropiedad] = useState<string[]>([]);
  const [metrosMin, setMetrosMin] = useState('');
  const [metrosMax, setMetrosMax] = useState('');
  
  // Características
  const [dormitoriosMin, setDormitoriosMin] = useState<number>(0);
  const [banosMin, setBanosMin] = useState<number>(0);
  const [condicion, setCondicion] = useState<string[]>([]);
  const [caracteristicasEsenciales, setCaracteristicasEsenciales] = useState<string[]>([]);
  const [anoMin, setAnoMin] = useState('');

  useEffect(() => {
    checkExistingCliente();
  }, []);

  const checkExistingCliente = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

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
    if (nuevaUbicacion.trim() && ubicaciones.length < 10) {
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

  const toggleTipoZona = (zona: string) => {
    if (tipoZona.includes(zona)) {
      setTipoZona(tipoZona.filter(z => z !== zona));
    } else {
      setTipoZona([...tipoZona, zona]);
    }
  };

  const toggleProximidad = (servicio: string) => {
    if (proximidadServicios.includes(servicio)) {
      setProximidadServicios(proximidadServicios.filter(s => s !== servicio));
    } else {
      setProximidadServicios([...proximidadServicios, servicio]);
    }
  };

  const toggleCondicion = (cond: string) => {
    if (condicion.includes(cond)) {
      setCondicion(condicion.filter(c => c !== cond));
    } else {
      setCondicion([...condicion, cond]);
    }
  };

  const toggleCaracteristica = (car: string) => {
    if (caracteristicasEsenciales.includes(car)) {
      setCaracteristicasEsenciales(caracteristicasEsenciales.filter(c => c !== car));
    } else {
      setCaracteristicasEsenciales([...caracteristicasEsenciales, car]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // Validar datos críticos
      const validation = criteriosSchema.safeParse({
        ubicaciones,
        presupuestoMin: presupuestoMin ? parseFloat(presupuestoMin) : undefined,
        presupuestoMax: presupuestoMax ? parseFloat(presupuestoMax) : undefined,
        telefono: telefono.trim(),
      });

      if (!validation.success) {
        toast({
          title: "Error de validación",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let finalClienteId = clienteId;
      
      if (!finalClienteId) {
        const { data: newCliente, error: clienteError } = await supabase
          .from('clientes')
          .insert({
            user_id: user.id,
            nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
            email: user.email!,
            telefono: telefono.trim(),
            perfil: perfil,
            presupuesto_min: presupuestoMin ? parseFloat(presupuestoMin) : null,
            presupuesto_max: presupuestoMax ? parseFloat(presupuestoMax) : null,
          })
          .select('id')
          .single();

        if (clienteError) throw clienteError;
        finalClienteId = newCliente.id;
      } else {
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            telefono: telefono.trim(),
            perfil: perfil,
            presupuesto_min: presupuestoMin ? parseFloat(presupuestoMin) : null,
            presupuesto_max: presupuestoMax ? parseFloat(presupuestoMax) : null,
          })
          .eq('id', finalClienteId);

        if (updateError) throw updateError;
      }

      // Crear criterios de búsqueda exhaustivos
      if (finalClienteId) {
        const { error: criteriosError } = await supabase
          .from('criterios_busqueda')
          .insert({
            cliente_id: finalClienteId,
            ubicaciones,
            tipo_propiedad: tipoPropiedad.length > 0 ? tipoPropiedad : null,
            metros_min: metrosMin ? parseFloat(metrosMin) : null,
            metros_max: metrosMax ? parseFloat(metrosMax) : null,
            dormitorios_min: dormitoriosMin > 0 ? dormitoriosMin : null,
            condition: condicion.length > 0 ? condicion : null,
            ano_construccion_min: anoMin ? parseInt(anoMin) : null,
            tiene_ascensor: caracteristicasEsenciales.includes('ascensor') ? true : null,
            tiene_parking: caracteristicasEsenciales.includes('parking') ? true : null,
          });

        if (criteriosError) throw criteriosError;
      }

      toast({
        title: "¡Bienvenido a InmoFinder! 🎉",
        description: "Tu perfil ha sido configurado correctamente.",
      });

      navigate('/cliente/dashboard');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo completar la configuración.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 3:
        return perfil !== '' && telefono.trim() !== '';
      case 4:
        return ubicaciones.length > 0;
      case 5:
        return presupuestoMin !== '' && presupuestoMax !== '';
      case 6:
        return tipoPropiedad.length > 0;
      default:
        return true;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-elegant">
        <CardHeader className="text-center border-b">
          <div className="flex justify-center mb-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max px-4">
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
                        w-8 h-0.5 mx-1
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
                Vamos a crear tu perfil de inversor inmobiliario. Te haremos algunas preguntas para entender 
                exactamente qué tipo de propiedades buscas y poder enviarte los mejores matchings.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Search className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h4 className="font-semibold mb-1">Matchings Precisos</h4>
                  <p className="text-sm text-muted-foreground">
                    Cuanto más detallado tu perfil, mejores serán los resultados
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h4 className="font-semibold mb-1">Análisis IA</h4>
                  <p className="text-sm text-muted-foreground">
                    Evaluamos cada propiedad con tu perfil usando inteligencia artificial
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Bell className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h4 className="font-semibold mb-1">Alertas Instantáneas</h4>
                  <p className="text-sm text-muted-foreground">
                    Te avisamos cuando aparezca una propiedad perfecta
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
                        Actualiza tu plan para desbloquear alertas, análisis de reforma y más matchings.
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

          {/* Step 3: Perfil Inversor */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Tu Perfil de Inversor</h3>
                <p className="text-muted-foreground">
                  Ayúdanos a entender tu estrategia de inversión
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4" />
                    ¿Qué buscas en una propiedad?
                  </Label>
                  <RadioGroup value={perfil} onValueChange={setPerfil}>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="vivir" id="vivir" />
                        <Label htmlFor="vivir" className="flex-1 cursor-pointer">
                          <div className="font-medium">Vivienda habitual</div>
                          <div className="text-sm text-muted-foreground">Busco una casa para vivir</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="alquilar" id="alquilar" />
                        <Label htmlFor="alquilar" className="flex-1 cursor-pointer">
                          <div className="font-medium">Inversión en alquiler</div>
                          <div className="text-sm text-muted-foreground">Comprar para alquilar a largo plazo</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="reformar" id="reformar" />
                        <Label htmlFor="reformar" className="flex-1 cursor-pointer">
                          <div className="font-medium">Reformar y vender (Flipping)</div>
                          <div className="text-sm text-muted-foreground">Comprar, renovar y revender con beneficio</div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="telefono" className="text-base font-semibold flex items-center gap-2 mb-2">
                    <Bell className="h-4 w-4" />
                    Teléfono para alertas de WhatsApp
                    <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Recibirás notificaciones inmediatas cuando encontremos propiedades que coincidan con tus criterios
                  </p>
                  <Input
                    id="telefono"
                    type="tel"
                    placeholder="+34 612 345 678"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="text-base"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Usa formato internacional (ej: +34612345678)
                  </p>
                </div>

                {perfil !== 'vivir' && (
                  <>
                    <div>
                      <Label className="text-base font-semibold mb-3 block">Objetivo de inversión</Label>
                      <RadioGroup value={objetivoInversion} onValueChange={setObjetivoInversion}>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rentabilidad" id="rentabilidad" />
                            <Label htmlFor="rentabilidad">Máxima rentabilidad</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="revalorizacion" id="revalorizacion" />
                            <Label htmlFor="revalorizacion">Revalorización a medio plazo</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="equilibrado" id="equilibrado" />
                            <Label htmlFor="equilibrado">Equilibrio entre ambos</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label className="text-base font-semibold mb-3 block">Horizonte temporal</Label>
                      <RadioGroup value={horizonteTemporal} onValueChange={setHorizonteTemporal}>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="corto" id="corto" />
                            <Label htmlFor="corto">Corto plazo (&lt; 2 años)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medio" id="medio" />
                            <Label htmlFor="medio">Medio plazo (2-5 años)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="largo" id="largo" />
                            <Label htmlFor="largo">Largo plazo (&gt; 5 años)</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label className="text-base font-semibold mb-3 block">Perfil de riesgo</Label>
                      <RadioGroup value={perfilRiesgo} onValueChange={setPerfilRiesgo}>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="conservador" id="conservador" />
                            <Label htmlFor="conservador">Conservador (zonas consolidadas)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="moderado" id="moderado" />
                            <Label htmlFor="moderado">Moderado (zonas en crecimiento)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="agresivo" id="agresivo" />
                            <Label htmlFor="agresivo">Agresivo (zonas emergentes)</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Ubicación detallada */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Ubicaciones de Interés</h3>
                <p className="text-muted-foreground">
                  ¿Dónde quieres buscar propiedades?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4" />
                    Ciudades o Zonas
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Añade ciudades, provincias o barrios específicos (máx. 10)
                  </p>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: Madrid, Salamanca, Valencia Centro..."
                      value={nuevaUbicacion}
                      onChange={(e) => setNuevaUbicacion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUbicacion())}
                      disabled={ubicaciones.length >= 10}
                    />
                    <Button 
                      onClick={addUbicacion}
                      disabled={!nuevaUbicacion.trim() || ubicaciones.length >= 10}
                    >
                      Añadir
                    </Button>
                  </div>

                  {ubicaciones.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {ubicaciones.map((ubicacion, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive/10 text-sm py-1 px-3"
                          onClick={() => removeUbicacion(index)}
                        >
                          {ubicacion} ✕
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-base font-semibold mb-3 block">Tipo de zona</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'centro', label: 'Centro ciudad' },
                      { id: 'periferia', label: 'Periferia' },
                      { id: 'residencial', label: 'Zona residencial' },
                      { id: 'comercial', label: 'Zona comercial' }
                    ].map((zona) => (
                      <Button
                        key={zona.id}
                        variant={tipoZona.includes(zona.id) ? 'default' : 'outline'}
                        onClick={() => toggleTipoZona(zona.id)}
                        className="justify-start h-auto py-3"
                      >
                        {tipoZona.includes(zona.id) && (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        {zona.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold mb-3 block">Proximidad a servicios</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Metro/Transporte',
                      'Colegios',
                      'Hospitales',
                      'Comercios',
                      'Parques',
                      'Playa'
                    ].map((servicio) => (
                      <Button
                        key={servicio}
                        variant={proximidadServicios.includes(servicio) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleProximidad(servicio)}
                        className="justify-start"
                      >
                        {proximidadServicios.includes(servicio) && (
                          <CheckCircle className="h-3 w-3 mr-2" />
                        )}
                        {servicio}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Presupuesto detallado */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Presupuesto</h3>
                <p className="text-muted-foreground">
                  Define tu rango de inversión
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="presupuesto-min" className="text-base font-semibold">
                      Presupuesto mínimo
                    </Label>
                    <div className="relative mt-2">
                      <Euro className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="presupuesto-min"
                        type="number"
                        placeholder="50,000"
                        value={presupuestoMin}
                        onChange={(e) => setPresupuestoMin(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="presupuesto-max" className="text-base font-semibold">
                      Presupuesto máximo
                    </Label>
                    <div className="relative mt-2">
                      <Euro className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="presupuesto-max"
                        type="number"
                        placeholder="200,000"
                        value={presupuestoMax}
                        onChange={(e) => setPresupuestoMax(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    Flexibilidad del presupuesto: {flexibilidadPresupuesto}%
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    ¿Cuánto te puedes salir del rango si la propiedad es excepcional?
                  </p>
                  <Slider
                    value={[flexibilidadPresupuesto]}
                    onValueChange={(value) => setFlexibilidadPresupuesto(value[0])}
                    max={30}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Estricto</span>
                    <span>Flexible</span>
                  </div>
                </div>

                {presupuestoMin && presupuestoMax && (
                  <div className="p-4 bg-primary/5 rounded-lg border">
                    <p className="text-sm">
                      <strong>Rango efectivo:</strong>{' '}
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
                        parseFloat(presupuestoMin) * (1 - flexibilidadPresupuesto / 100)
                      )}
                      {' - '}
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
                        parseFloat(presupuestoMax) * (1 + flexibilidadPresupuesto / 100)
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Tipo de propiedad y metros */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Tipo de Propiedad</h3>
                <p className="text-muted-foreground">
                  ¿Qué tipo de inmueble buscas?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4" />
                    Tipos de propiedad
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'Piso', icon: Building2 },
                      { id: 'Casa', icon: Home },
                      { id: 'Chalet', icon: Home },
                      { id: 'Ático', icon: Building2 },
                      { id: 'Dúplex', icon: Building2 },
                      { id: 'Loft', icon: Building2 }
                    ].map((tipo) => {
                      const Icon = tipo.icon;
                      return (
                        <Button
                          key={tipo.id}
                          variant={tipoPropiedad.includes(tipo.id) ? 'default' : 'outline'}
                          onClick={() => toggleTipoPropiedad(tipo.id)}
                          className="justify-start h-auto py-3"
                        >
                          {tipoPropiedad.includes(tipo.id) ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <Icon className="h-4 w-4 mr-2" />
                          )}
                          {tipo.id}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Ruler className="h-4 w-4" />
                    Superficie (m²)
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="metros-min" className="text-sm text-muted-foreground">
                        Mínimo
                      </Label>
                      <Input
                        id="metros-min"
                        type="number"
                        placeholder="50"
                        value={metrosMin}
                        onChange={(e) => setMetrosMin(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="metros-max" className="text-sm text-muted-foreground">
                        Máximo
                      </Label>
                      <Input
                        id="metros-max"
                        type="number"
                        placeholder="150"
                        value={metrosMax}
                        onChange={(e) => setMetrosMax(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Características específicas */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Características</h3>
                <p className="text-muted-foreground">
                  Detalles específicos que buscas
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                      <Bed className="h-4 w-4" />
                      Dormitorios mínimos
                    </Label>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4].map((num) => (
                        <Button
                          key={num}
                          variant={dormitoriosMin === num ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDormitoriosMin(num)}
                          className="flex-1"
                        >
                          {num === 0 ? 'Cualquiera' : num === 4 ? '4+' : num}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                      <Bath className="h-4 w-4" />
                      Baños mínimos
                    </Label>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3].map((num) => (
                        <Button
                          key={num}
                          variant={banosMin === num ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBanosMin(num)}
                          className="flex-1"
                        >
                          {num === 0 ? 'Cualquiera' : num === 3 ? '3+' : num}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Wrench className="h-4 w-4" />
                    Estado de la propiedad
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'obra nueva', label: 'Obra nueva' },
                      { id: 'buen estado', label: 'Buen estado' },
                      { id: 'para reformar', label: 'Para reformar' },
                      { id: 'reformado', label: 'Recién reformado' }
                    ].map((cond) => (
                      <Button
                        key={cond.id}
                        variant={condicion.includes(cond.id) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleCondicion(cond.id)}
                        className="justify-start"
                      >
                        {condicion.includes(cond.id) && (
                          <CheckCircle className="h-3 w-3 mr-2" />
                        )}
                        {cond.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Heart className="h-4 w-4" />
                    Características esenciales
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ascensor', label: 'Ascensor', icon: Building2 },
                      { id: 'parking', label: 'Plaza de garaje', icon: Car },
                      { id: 'trastero', label: 'Trastero', icon: Home },
                      { id: 'terraza', label: 'Terraza/Balcón', icon: Home },
                      { id: 'jardin', label: 'Jardín', icon: Home },
                      { id: 'piscina', label: 'Piscina', icon: Home }
                    ].map((car) => (
                      <Button
                        key={car.id}
                        variant={caracteristicasEsenciales.includes(car.id) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleCaracteristica(car.id)}
                        className="justify-start"
                      >
                        {caracteristicasEsenciales.includes(car.id) && (
                          <CheckCircle className="h-3 w-3 mr-2" />
                        )}
                        {car.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="ano-min" className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Año de construcción mínimo (opcional)
                  </Label>
                  <Input
                    id="ano-min"
                    type="number"
                    placeholder="2000"
                    value={anoMin}
                    onChange={(e) => setAnoMin(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Finalización */}
          {currentStep === 8 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-success/10 rounded-full">
                  <CheckCircle className="h-16 w-16 text-success" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold">¡Todo Listo!</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Hemos creado tu perfil personalizado. Nuestro algoritmo de IA comenzará a buscar propiedades 
                que coincidan con tus criterios y te enviaremos notificaciones cuando encuentre oportunidades.
              </p>

              <div className="bg-muted/50 rounded-lg p-6 text-left max-w-2xl mx-auto">
                <h4 className="font-semibold mb-3">Resumen de tu perfil:</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Objetivo:</strong> {perfil === 'vivir' ? 'Vivienda habitual' : perfil === 'alquilar' ? 'Inversión en alquiler' : 'Reformar y vender'}</p>
                  <p><strong>Teléfono:</strong> {telefono}</p>
                  <p><strong>Ubicaciones:</strong> {ubicaciones.join(', ')}</p>
                  <p><strong>Presupuesto:</strong> {presupuestoMin && presupuestoMax && `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(parseFloat(presupuestoMin))} - ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(parseFloat(presupuestoMax))}`}</p>
                  {tipoPropiedad.length > 0 && <p><strong>Tipo:</strong> {tipoPropiedad.join(', ')}</p>}
                  {dormitoriosMin > 0 && <p><strong>Dormitorios mín.:</strong> {dormitoriosMin}</p>}
                  {caracteristicasEsenciales.length > 0 && (
                    <p><strong>Características:</strong> {caracteristicasEsenciales.join(', ')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto">
                <Card className="text-left">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Próximos Pasos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>• Revisaremos propiedades existentes</p>
                    <p>• Te notificaremos de nuevas propiedades</p>
                    <p>• Recibirás alertas por WhatsApp</p>
                    <p>• Podrás ver matchings en tu dashboard</p>
                    <p>• Análisis de mercado disponible</p>
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
              disabled={!canGoNext()}
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={loading || !canGoNext()}
            >
              {loading ? (
                <>Configurando...</>
              ) : (
                <>
                  Finalizar y Empezar
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
