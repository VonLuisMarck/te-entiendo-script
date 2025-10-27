import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MatchingRequestSchema = z.object({
  cliente_id: z.string().uuid().optional(),
  propiedad_id: z.string().uuid().optional(),
  recalcular_todos: z.boolean().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const requestBody = await req.json();
    const { cliente_id, propiedad_id, recalcular_todos } = MatchingRequestSchema.parse(requestBody);
    
    console.log('[Matching Service] Iniciando cálculo de matchings en background');

    // Definir la tarea de procesamiento en background
    const processMatchings = async () => {
      const startTime = Date.now();
      let matchingsCreados = 0;
      let matchingsActualizados = 0;

      try {
        // Obtener clientes y propiedades según los filtros (con límite razonable)
        const { data: clientes } = await supabase
          .from('clientes')
          .select(`
            id,
            perfil,
            presupuesto_min,
            presupuesto_max,
            criterios_busqueda (*)
          `)
          .eq('activo', true)
          .eq(cliente_id ? 'id' : 'activo', cliente_id || true)
          .limit(20); // Limitar a 20 clientes máximo

        const { data: propiedades } = await supabase
          .from('propiedades')
          .select('*')
          .eq('activo', true)
          .eq(propiedad_id ? 'id' : 'activo', propiedad_id || true)
          .limit(100); // Limitar a 100 propiedades máximo

        if (!clientes || !propiedades) {
          console.error('[Matching Service] No se encontraron clientes o propiedades');
          return;
        }

        console.log(`[Matching Service] Procesando ${clientes.length} clientes x ${propiedades.length} propiedades`);

        // Pre-cargar TODAS las métricas en memoria para evitar queries repetidas
        const { data: todasMetricas } = await supabase
          .from('metricas_barrios')
          .select('*');

        const metricasMap = new Map();
        if (todasMetricas) {
          todasMetricas.forEach((metrica: any) => {
            const key = `${metrica.ciudad}|${metrica.barrio || 'ciudad'}`;
            metricasMap.set(key, metrica);
          });
        }

        // Procesar en lotes de 50 para evitar timeout
        const BATCH_SIZE = 50;
        const matchingsToUpsert: any[] = [];

        for (const cliente of clientes) {
          const criterios = cliente.criterios_busqueda?.[0];
          
          for (const propiedad of propiedades) {
            // Calcular score base
            const scoreBase = calcularScore(cliente, criterios, propiedad);
            
            // Analizar precio vs mercado usando cache en memoria
            const analisisMercado = analizarPrecioMercadoEnMemoria(propiedad, metricasMap);
            
            // Calcular bonus por oportunidad de mercado según perfil
            const bonusMercado = calcularBonusPerfil(cliente.perfil, analisisMercado);
            
            // Score final
            const score = Math.min(100, scoreBase + bonusMercado);
            
            if (score >= 50) {
              const criteriosCumplidos = evaluarCriterios(cliente, criterios, propiedad);
              
              matchingsToUpsert.push({
                cliente_id: cliente.id,
                propiedad_id: propiedad.id,
                score,
                criterios_cumplidos: criteriosCumplidos,
                analisis_mercado: analisisMercado,
              });

              // Cuando alcanzamos el tamaño del lote, hacemos upsert
              if (matchingsToUpsert.length >= BATCH_SIZE) {
                const { error } = await supabase
                  .from('matchings')
                  .upsert(matchingsToUpsert, {
                    onConflict: 'cliente_id,propiedad_id',
                    ignoreDuplicates: false
                  });

                if (!error) {
                  matchingsCreados += matchingsToUpsert.length;
                }
                matchingsToUpsert.length = 0; // Limpiar array
              }
            }
          }
        }

        // Procesar los matchings restantes
        if (matchingsToUpsert.length > 0) {
          const { error } = await supabase
            .from('matchings')
            .upsert(matchingsToUpsert, {
              onConflict: 'cliente_id,propiedad_id',
              ignoreDuplicates: false
            });

          if (!error) {
            matchingsCreados += matchingsToUpsert.length;
          }
        }

        const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);
        console.log(`[Matching Service] Completado: ${matchingsCreados} matchings procesados en ${duracionSegundos}s`);
      } catch (error) {
        console.error('[Matching Service] Error en background:', error);
      }
    };

    // Iniciar procesamiento en background
    // @ts-ignore - EdgeRuntime está disponible en Supabase Edge Functions
    EdgeRuntime.waitUntil(processMatchings());

    // Devolver respuesta inmediata
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cálculo de matchings iniciado en background',
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Matching Service] Error:', error.message);
    
    const status = error.message?.includes('Unauthorized') ? 403 : 
                   error.issues ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.issues ? 'Invalid request data' : 'Failed to process matching'
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function calcularScore(cliente: any, criterios: any, propiedad: any): number {
  let score = 0;
  let maxScore = 0;

  // Presupuesto (peso: 25 puntos, reducido para dar espacio al análisis de mercado)
  maxScore += 25;
  if (propiedad.precio >= (cliente.presupuesto_min || 0) && 
      propiedad.precio <= (cliente.presupuesto_max || Infinity)) {
    score += 25;
  } else {
    const desviacion = Math.min(
      Math.abs(propiedad.precio - (cliente.presupuesto_min || 0)),
      Math.abs(propiedad.precio - (cliente.presupuesto_max || Infinity))
    );
    const penalizacion = Math.min(25, (desviacion / 10000) * 5);
    score += Math.max(0, 25 - penalizacion);
  }

  if (!criterios) return (score / maxScore) * 100;

  // Ubicación (peso: 20 puntos)
  maxScore += 20;
  if (criterios.ubicaciones?.includes(propiedad.ubicacion)) {
    score += 20;
  }

  // Tipo de propiedad (peso: 15 puntos)
  maxScore += 15;
  if (criterios.tipo_propiedad?.includes(propiedad.tipo_propiedad)) {
    score += 15;
  }

  // Dormitorios (peso: 10 puntos)
  maxScore += 10;
  if (!criterios.dormitorios_min || propiedad.dormitorios >= criterios.dormitorios_min) {
    score += 10;
  }

  // Metros (peso: 10 puntos)
  maxScore += 10;
  if ((!criterios.metros_min || propiedad.metros >= criterios.metros_min) &&
      (!criterios.metros_max || propiedad.metros <= criterios.metros_max)) {
    score += 10;
  }

  // Estado (peso: 5 puntos)
  maxScore += 5;
  if (!criterios.condition || criterios.condition.includes(propiedad.condition)) {
    score += 5;
  }

  // Extras (peso: 5 puntos)
  maxScore += 5;
  let extrasScore = 0;
  if (criterios.tiene_ascensor === propiedad.tiene_ascensor) extrasScore += 2.5;
  if (criterios.tiene_parking === propiedad.tiene_parking) extrasScore += 2.5;
  score += extrasScore;

  return Math.round((score / maxScore) * 100);
}

function evaluarCriterios(cliente: any, criterios: any, propiedad: any): any {
  return {
    presupuesto: propiedad.precio >= (cliente.presupuesto_min || 0) && 
                 propiedad.precio <= (cliente.presupuesto_max || Infinity),
    ubicacion: criterios?.ubicaciones?.includes(propiedad.ubicacion),
    tipo_propiedad: criterios?.tipo_propiedad?.includes(propiedad.tipo_propiedad),
    dormitorios: !criterios?.dormitorios_min || propiedad.dormitorios >= criterios.dormitorios_min,
    metros: (!criterios?.metros_min || propiedad.metros >= criterios.metros_min) &&
            (!criterios?.metros_max || propiedad.metros <= criterios.metros_max),
    condition: !criterios?.condition || criterios.condition.includes(propiedad.condition),
    ascensor: criterios?.tiene_ascensor === propiedad.tiene_ascensor,
    parking: criterios?.tiene_parking === propiedad.tiene_parking,
  };
}

// Versión optimizada que usa cache en memoria
function analizarPrecioMercadoEnMemoria(propiedad: any, metricasMap: Map<string, any>): any {
  if (!propiedad.precio_m2 || !propiedad.ubicacion) {
    return { disponible: false };
  }

  // Extraer ciudad y barrio
  const partes = propiedad.ubicacion.split(',').map((p: string) => p.trim());
  const ciudad = partes[0];
  const barrio = partes[1] || null;

  // Buscar en el Map primero por barrio, luego por ciudad
  let metricasUsadas = metricasMap.get(`${ciudad}|${barrio}`);
  if (!metricasUsadas) {
    metricasUsadas = metricasMap.get(`${ciudad}|ciudad`);
  }

  if (!metricasUsadas || !metricasUsadas.precio_m2_medio) {
    return { disponible: false };
  }

  // Calcular desviación porcentual
  const precioM2Propiedad = propiedad.precio_m2;
  const precioM2Mercado = metricasUsadas.precio_m2_medio;
  const desviacionPorcentaje = ((precioM2Propiedad - precioM2Mercado) / precioM2Mercado) * 100;

  // Determinar nivel de oportunidad
  let nivelOportunidad = 'normal';
  let esChollo = false;

  if (desviacionPorcentaje <= -20) {
    nivelOportunidad = 'chollazo';
    esChollo = true;
  } else if (desviacionPorcentaje <= -10) {
    nivelOportunidad = 'buena_oportunidad';
    esChollo = true;
  } else if (desviacionPorcentaje <= -5) {
    nivelOportunidad = 'oportunidad';
  } else if (desviacionPorcentaje >= 20) {
    nivelOportunidad = 'sobrevalorado';
  } else if (desviacionPorcentaje >= 10) {
    nivelOportunidad = 'caro';
  }

  return {
    disponible: true,
    precio_m2_propiedad: precioM2Propiedad,
    precio_m2_mercado: precioM2Mercado,
    desviacion_porcentaje: Math.round(desviacionPorcentaje * 10) / 10,
    nivel_oportunidad: nivelOportunidad,
    es_chollo: esChollo,
    metricas_usadas: barrio ? 'barrio' : 'ciudad',
    total_propiedades_comparadas: metricasUsadas.total_propiedades,
  };
}

function calcularBonusPerfil(perfil: string, analisisMercado: any): number {
  if (!analisisMercado.disponible) return 0;

  const desviacion = analisisMercado.desviacion_porcentaje;

  switch (perfil) {
    case 'reformar':
      // Flippers: Solo interesa si es chollo significativo
      if (desviacion <= -20) return 15; // Chollazo: bonus grande
      if (desviacion <= -15) return 10;
      if (desviacion <= -10) return 5;
      return 0;

    case 'alquilar':
      // Landlords: Precio medio está bien, pero valoran chollos moderados
      if (desviacion <= -15) return 10; // Buen chollo
      if (desviacion <= -10) return 7;
      if (desviacion <= -5) return 3;
      if (Math.abs(desviacion) <= 5) return 2; // Precio justo también vale
      return 0;

    case 'vivir':
    default:
      // End users: Valoran chollos pero también aceptan precio justo
      if (desviacion <= -15) return 8;
      if (desviacion <= -10) return 5;
      if (desviacion <= -5) return 3;
      if (desviacion <= 0) return 1; // Cualquier descuento mínimo vale
      return 0;
  }
}
