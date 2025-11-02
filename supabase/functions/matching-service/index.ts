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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
            const key = `${metrica.ciudad}|${metrica.distrito || 'ciudad'}`;
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
            
            if (score >= 60) {
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
  let penalizaciones = 0;

  // Presupuesto (peso: 25 puntos base - CRÍTICO)
  maxScore += 25;
  if (propiedad.precio >= (cliente.presupuesto_min || 0) && 
      propiedad.precio <= (cliente.presupuesto_max || Infinity)) {
    
    // Estar dentro del presupuesto ya no da el máximo automáticamente
    // Depende de qué tan cerca del límite inferior estés (más bajo = mejor)
    const presupuestoMax = cliente.presupuesto_max || propiedad.precio;
    const presupuestoMin = cliente.presupuesto_min || 0;
    const rangoPresupuesto = presupuestoMax - presupuestoMin;
    
    if (rangoPresupuesto > 0) {
      // Cuanto más cerca del mínimo, mejor score (escala mucho más exigente)
      const posicionEnRango = (propiedad.precio - presupuestoMin) / rangoPresupuesto;
      
      if (posicionEnRango <= 0.15) {
        score += 25; // Solo el 15% más bajo obtiene puntuación perfecta
      } else if (posicionEnRango <= 0.30) {
        score += 21; // Hasta el 30% más bajo
      } else if (posicionEnRango <= 0.50) {
        score += 17; // Hasta la mitad del rango
      } else if (posicionEnRango <= 0.70) {
        score += 12; // Rango medio-alto
      } else if (posicionEnRango <= 0.85) {
        score += 8; // Cerca del límite superior
      } else {
        score += 4; // Muy cerca del máximo (casi penalización)
      }
    } else {
      score += 15; // Sin rango definido, puntuación media-baja
    }
  } else {
    // Fuera del presupuesto: penalización significativa
    const desviacion = Math.min(
      Math.abs(propiedad.precio - (cliente.presupuesto_min || 0)),
      Math.abs(propiedad.precio - (cliente.presupuesto_max || Infinity))
    );
    const penalizacion = Math.min(25, (desviacion / 5000) * 5);
    score += Math.max(0, 25 - penalizacion);
    penalizaciones += 15; // Penalización adicional por estar fuera
  }

  if (!criterios) return Math.max(0, (score / maxScore) * 100 - penalizaciones);

  // Ubicación (peso: 25 puntos) - MUY IMPORTANTE
  maxScore += 25;
  if (criterios.ubicaciones && matchUbicacion(criterios.ubicaciones, propiedad.ubicacion)) {
    score += 25;
  } else {
    penalizaciones += 20; // No estar en la ubicación deseada es muy grave
  }

  // Tipo de propiedad (peso: 15 puntos)
  maxScore += 15;
  if (criterios.tipo_propiedad?.includes(propiedad.tipo_propiedad)) {
    score += 15;
  } else {
    penalizaciones += 10; // Tipo incorrecto es importante
  }

  // Dormitorios (peso: 12 puntos)
  maxScore += 12;
  if (!criterios.dormitorios_min || propiedad.dormitorios >= criterios.dormitorios_min) {
    // Ajustar puntos según qué tan por encima está
    const exceso = propiedad.dormitorios - (criterios.dormitorios_min || 0);
    if (exceso === 0 || exceso === 1) {
      score += 12; // Perfecto o 1 más
    } else if (exceso === 2) {
      score += 10; // 2 dormitorios extra puede ser excesivo
    } else if (exceso > 2) {
      score += 7; // Demasiados dormitorios no siempre es bueno
    }
  } else {
    penalizaciones += 8; // Menos dormitorios de lo necesario
  }

  // Metros (peso: 12 puntos)
  maxScore += 12;
  if ((!criterios.metros_min || propiedad.metros >= criterios.metros_min) &&
      (!criterios.metros_max || propiedad.metros <= criterios.metros_max)) {
    score += 12;
  } else {
    // Penalización por desviación de metros
    const desviacionMetros = criterios.metros_min && propiedad.metros < criterios.metros_min
      ? criterios.metros_min - propiedad.metros
      : criterios.metros_max && propiedad.metros > criterios.metros_max
      ? propiedad.metros - criterios.metros_max
      : 0;
    
    const penalizacionMetros = Math.min(8, (desviacionMetros / 10) * 2);
    penalizaciones += penalizacionMetros;
    score += Math.max(4, 12 - penalizacionMetros);
  }

  // Estado (peso: 6 puntos) - Más importante de lo que era
  maxScore += 6;
  if (!criterios.condition || criterios.condition.includes(propiedad.condition)) {
    score += 6;
  } else {
    penalizaciones += 4; // Estado incorrecto puede ser problemático
  }

  // Extras (peso: 5 puntos) - Menos importante pero suma
  maxScore += 5;
  let extrasScore = 0;
  if (!criterios.tiene_ascensor || criterios.tiene_ascensor === propiedad.tiene_ascensor) {
    extrasScore += 2.5;
  } else {
    penalizaciones += 2;
  }
  
  if (!criterios.tiene_parking || criterios.tiene_parking === propiedad.tiene_parking) {
    extrasScore += 2.5;
  } else {
    penalizaciones += 2;
  }
  score += extrasScore;

  // Calcular score final con penalizaciones
  const scoreBase = Math.round((score / maxScore) * 100);
  const scoreFinal = Math.max(0, Math.min(100, scoreBase - penalizaciones));
  
  return scoreFinal;
}

function matchUbicacion(ubicacionesCriterios: string[], ubicacionPropiedad: string): boolean {
  if (!ubicacionPropiedad) return false;
  
  // Normalizar función auxiliar
  const normalizar = (texto: string) => texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  
  const ubicacionPropNorm = normalizar(ubicacionPropiedad);
  
  return ubicacionesCriterios.some(ubicCriterio => {
    const criterioNorm = normalizar(ubicCriterio);
    
    // Match exacto
    if (ubicacionPropNorm === criterioNorm) return true;
    
    // Si la ubicación de la propiedad contiene el criterio
    // Ej: "Centro, Murcia" contiene "Murcia"
    if (ubicacionPropNorm.includes(criterioNorm)) return true;
    
    // Si el criterio contiene la ubicación de la propiedad
    // Ej: criterio "Murcia capital" y propiedad "Murcia"
    if (criterioNorm.includes(ubicacionPropNorm)) return true;
    
    // Comparar por partes (ciudad, barrio)
    const partesProp = ubicacionPropNorm.split(',').map(p => p.trim());
    const partesCriterio = criterioNorm.split(',').map(p => p.trim());
    
    // Si alguna parte coincide
    for (const parteProp of partesProp) {
      for (const parteCrit of partesCriterio) {
        if (parteProp === parteCrit) return true;
        if (parteProp.includes(parteCrit) || parteCrit.includes(parteProp)) return true;
      }
    }
    
    return false;
  });
}

function evaluarCriterios(cliente: any, criterios: any, propiedad: any): any {
  return {
    presupuesto: propiedad.precio >= (cliente.presupuesto_min || 0) && 
                 propiedad.precio <= (cliente.presupuesto_max || Infinity),
    ubicacion: criterios?.ubicaciones ? matchUbicacion(criterios.ubicaciones, propiedad.ubicacion) : false,
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

  // Extraer ciudad y distrito
  const partes = propiedad.ubicacion.split(',').map((p: string) => p.trim());
  const ciudad = partes[0];
  const distrito = partes[1] || null;

  // Buscar en el Map primero por distrito, luego por ciudad
  let metricasUsadas = metricasMap.get(`${ciudad}|${distrito}`);
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
    metricas_usadas: distrito ? 'distrito' : 'ciudad',
    total_propiedades_comparadas: metricasUsadas.total_propiedades,
  };
}

function calcularBonusPerfil(perfil: string, analisisMercado: any): number {
  if (!analisisMercado.disponible) return 0;

  const desviacion = analisisMercado.desviacion_porcentaje;

  // AJUSTADO: Bonus más realista (max 15 puntos vs 20 previos)
  // Solo para oportunidades reales
  switch (perfil) {
    case 'reformar':
      // Flippers: Solo interesa si es chollo MUY significativo
      if (desviacion <= -30) return 15; // Súper chollazo excepcional
      if (desviacion <= -25) return 12;
      if (desviacion <= -20) return 10;
      if (desviacion <= -15) return 7;
      if (desviacion <= -10) return 4;
      return 0; // Si no es chollo claro, no suma

    case 'alquilar':
      // Landlords: Valoran chollos pero también aceptan precio justo
      if (desviacion <= -30) return 13;
      if (desviacion <= -25) return 11;
      if (desviacion <= -20) return 9;
      if (desviacion <= -15) return 7;
      if (desviacion <= -10) return 5;
      if (desviacion <= -5) return 3;
      if (Math.abs(desviacion) <= 5) return 2; // Precio justo vale poco
      return 0;

    case 'vivir':
    default:
      // End users: Menos exigentes pero valoran descuentos
      if (desviacion <= -30) return 12;
      if (desviacion <= -25) return 10;
      if (desviacion <= -20) return 8;
      if (desviacion <= -15) return 6;
      if (desviacion <= -10) return 5;
      if (desviacion <= -5) return 3;
      if (desviacion <= 0) return 1; // Cualquier descuento mínimo
      return 0;
  }
}
