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
    
    console.log('[Matching Service] Iniciando cálculo de matchings avanzado');

    const processMatchings = async () => {
      const startTime = Date.now();
      let matchingsCreados = 0;

      try {
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
          .limit(20);

        const { data: propiedades } = await supabase
          .from('propiedades')
          .select('*')
          .eq('activo', true)
          .eq(propiedad_id ? 'id' : 'activo', propiedad_id || true)
          .limit(100);

        if (!clientes || !propiedades) {
          console.error('[Matching Service] No se encontraron clientes o propiedades');
          return;
        }

        console.log(`[Matching Service] Procesando ${clientes.length} clientes x ${propiedades.length} propiedades`);

        // Pre-cargar métricas de mercado
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

        const BATCH_SIZE = 50;
        const matchingsToUpsert: any[] = [];

        for (const cliente of clientes) {
          const criterios = cliente.criterios_busqueda?.[0];
          
          for (const propiedad of propiedades) {
            // Nuevo algoritmo exhaustivo de scoring
            const resultado = calcularScoreExhaustivo(cliente, criterios, propiedad, metricasMap);
            
            if (resultado.score >= 60) {
              matchingsToUpsert.push({
                cliente_id: cliente.id,
                propiedad_id: propiedad.id,
                score: resultado.score,
                criterios_cumplidos: resultado.criteriosCumplidos,
                analisis_mercado: resultado.analisisMercado,
              });

              if (matchingsToUpsert.length >= BATCH_SIZE) {
                await supabase
                  .from('matchings')
                  .upsert(matchingsToUpsert, {
                    onConflict: 'cliente_id,propiedad_id',
                    ignoreDuplicates: false
                  });
                matchingsCreados += matchingsToUpsert.length;
                matchingsToUpsert.length = 0;
              }
            }
          }
        }

        if (matchingsToUpsert.length > 0) {
          await supabase
            .from('matchings')
            .upsert(matchingsToUpsert, {
              onConflict: 'cliente_id,propiedad_id',
              ignoreDuplicates: false
            });
          matchingsCreados += matchingsToUpsert.length;
        }

        const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);
        console.log(`[Matching Service] Completado: ${matchingsCreados} matchings en ${duracionSegundos}s`);
      } catch (error) {
        console.error('[Matching Service] Error:', error);
      }
    };

    // @ts-ignore
    EdgeRuntime.waitUntil(processMatchings());

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cálculo de matchings iniciado (algoritmo exhaustivo)',
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Matching Service] Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process matching'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * ALGORITMO EXHAUSTIVO DE SCORING
 * Considera todos los criterios del perfilado completo del cliente
 */
function calcularScoreExhaustivo(
  cliente: any, 
  criterios: any, 
  propiedad: any,
  metricasMap: Map<string, any>
): { score: number; criteriosCumplidos: any; analisisMercado: any } {
  
  let scoreTotal = 0;
  const pesos: any = {};
  const cumplimiento: any = {};

  // ==========================================
  // 1. PRESUPUESTO (25 puntos) - CRÍTICO
  // ==========================================
  pesos.presupuesto = 25;
  const flexibilidad = 0.10; // 10% de flexibilidad por defecto
  const presupuestoMinFlex = (cliente.presupuesto_min || 0) * (1 - flexibilidad);
  const presupuestoMaxFlex = (cliente.presupuesto_max || Infinity) * (1 + flexibilidad);

  if (propiedad.precio >= presupuestoMinFlex && propiedad.precio <= presupuestoMaxFlex) {
    const rangoTotal = presupuestoMaxFlex - presupuestoMinFlex;
    const posicion = (propiedad.precio - presupuestoMinFlex) / rangoTotal;
    
    // Mejor score cuanto más bajo en el rango
    if (posicion <= 0.20) scoreTotal += 25;
    else if (posicion <= 0.40) scoreTotal += 22;
    else if (posicion <= 0.60) scoreTotal += 18;
    else if (posicion <= 0.80) scoreTotal += 14;
    else scoreTotal += 10;
    
    cumplimiento.presupuesto = true;
  } else {
    scoreTotal += 5; // Penalización severa
    cumplimiento.presupuesto = false;
  }

  if (!criterios) {
    return {
      score: Math.round(scoreTotal),
      criteriosCumplidos: cumplimiento,
      analisisMercado: { disponible: false }
    };
  }

  // ==========================================
  // 2. UBICACIÓN (20 puntos) - MUY IMPORTANTE
  // ==========================================
  pesos.ubicacion = 20;
  if (criterios.ubicaciones && matchUbicacion(criterios.ubicaciones, propiedad.ubicacion)) {
    scoreTotal += 20;
    cumplimiento.ubicacion = true;
  } else {
    cumplimiento.ubicacion = false;
  }

  // ==========================================
  // 3. TIPO DE PROPIEDAD (15 puntos)
  // ==========================================
  pesos.tipoPropiedad = 15;
  if (criterios.tipo_propiedad?.includes(propiedad.tipo_propiedad)) {
    scoreTotal += 15;
    cumplimiento.tipoPropiedad = true;
  } else {
    cumplimiento.tipoPropiedad = false;
  }

  // ==========================================
  // 4. SUPERFICIE (12 puntos)
  // ==========================================
  pesos.superficie = 12;
  const metrosMin = criterios.metros_min || 0;
  const metrosMax = criterios.metros_max || Infinity;
  
  if (propiedad.metros >= metrosMin && propiedad.metros <= metrosMax) {
    // Score progresivo según cercanía al ideal
    const rangoMetros = metrosMax - metrosMin;
    if (rangoMetros > 0) {
      const posicionMetros = (propiedad.metros - metrosMin) / rangoMetros;
      if (posicionMetros >= 0.4 && posicionMetros <= 0.7) {
        scoreTotal += 12; // Rango ideal (centro del rango)
      } else if (posicionMetros >= 0.2 && posicionMetros <= 0.9) {
        scoreTotal += 10; // Rango bueno
      } else {
        scoreTotal += 7; // En los extremos
      }
    } else {
      scoreTotal += 10;
    }
    cumplimiento.superficie = true;
  } else {
    const desviacion = Math.min(
      Math.abs(propiedad.metros - metrosMin),
      Math.abs(propiedad.metros - metrosMax)
    );
    scoreTotal += Math.max(0, 12 - (desviacion / 10));
    cumplimiento.superficie = false;
  }

  // ==========================================
  // 5. DORMITORIOS (10 puntos)
  // ==========================================
  pesos.dormitorios = 10;
  const dormitoriosMin = criterios.dormitorios_min || 0;
  
  if (propiedad.dormitorios >= dormitoriosMin) {
    const exceso = propiedad.dormitorios - dormitoriosMin;
    if (exceso === 0 || exceso === 1) scoreTotal += 10;
    else if (exceso === 2) scoreTotal += 8;
    else scoreTotal += 6;
    cumplimiento.dormitorios = true;
  } else {
    cumplimiento.dormitorios = false;
  }

  // ==========================================
  // 6. ESTADO/CONDICIÓN (8 puntos)
  // ==========================================
  pesos.condicion = 8;
  if (!criterios.condition || criterios.condition.length === 0 || 
      criterios.condition.includes(propiedad.condition)) {
    scoreTotal += 8;
    cumplimiento.condicion = true;
  } else {
    // Penalización menor si está cercano
    const estadosOrdenados = ['para reformar', 'buen estado', 'reformado', 'obra nueva'];
    const indexProp = estadosOrdenados.indexOf(propiedad.condition);
    const indexesCriterio = criterios.condition.map((c: string) => estadosOrdenados.indexOf(c));
    
    if (indexesCriterio.some((idx: number) => Math.abs(idx - indexProp) <= 1)) {
      scoreTotal += 4; // Estado cercano al deseado
    }
    cumplimiento.condicion = false;
  }

  // ==========================================
  // 7. CARACTERÍSTICAS ESENCIALES (10 puntos total)
  // ==========================================
  pesos.caracteristicas = 10;
  let caracteristicasScore = 0;
  let caracteristicasTotal = 0;

  // Ascensor (3 puntos)
  if (criterios.tiene_ascensor === true) {
    caracteristicasTotal += 3;
    if (propiedad.tiene_ascensor) {
      caracteristicasScore += 3;
      cumplimiento.ascensor = true;
    } else {
      cumplimiento.ascensor = false;
    }
  }

  // Parking (3 puntos)
  if (criterios.tiene_parking === true) {
    caracteristicasTotal += 3;
    if (propiedad.tiene_parking) {
      caracteristicasScore += 3;
      cumplimiento.parking = true;
    } else {
      cumplimiento.parking = false;
    }
  }

  // Trastero (2 puntos)
  if (propiedad.tiene_trastero) {
    caracteristicasScore += 2;
    cumplimiento.trastero = true;
  }

  // Normalizar características a 10 puntos
  if (caracteristicasTotal > 0) {
    scoreTotal += (caracteristicasScore / caracteristicasTotal) * 10;
  } else {
    scoreTotal += caracteristicasScore;
  }

  // ==========================================
  // 8. AÑO DE CONSTRUCCIÓN (5 puntos)
  // ==========================================
  pesos.anoConstruccion = 5;
  if (criterios.ano_construccion_min) {
    if (propiedad.ano_construccion && propiedad.ano_construccion >= criterios.ano_construccion_min) {
      const antiguedad = new Date().getFullYear() - propiedad.ano_construccion;
      if (antiguedad <= 5) scoreTotal += 5; // Muy nuevo
      else if (antiguedad <= 15) scoreTotal += 4; // Relativamente nuevo
      else if (antiguedad <= 30) scoreTotal += 3; // Aceptable
      else scoreTotal += 2;
      cumplimiento.anoConstruccion = true;
    } else {
      cumplimiento.anoConstruccion = false;
    }
  } else {
    scoreTotal += 3; // No es criterio, valor neutral
  }

  // ==========================================
  // 9. ANÁLISIS DE MERCADO (hasta +15 puntos bonus)
  // ==========================================
  const analisisMercado = analizarPrecioMercado(propiedad, metricasMap);
  
  if (analisisMercado.disponible) {
    const bonusMercado = calcularBonusMercado(
      cliente.perfil,
      analisisMercado.desviacion_porcentaje,
      analisisMercado.nivel_oportunidad
    );
    scoreTotal += bonusMercado;
    cumplimiento.analisisMercado = analisisMercado;
  }

  // ==========================================
  // 10. AJUSTE POR PERFIL DE INVERSOR
  // ==========================================
  const ajustePerfil = calcularAjustePorPerfil(cliente.perfil, propiedad, analisisMercado);
  scoreTotal += ajustePerfil;

  const scoreFinal = Math.max(0, Math.min(100, Math.round(scoreTotal)));

  return {
    score: scoreFinal,
    criteriosCumplidos: cumplimiento,
    analisisMercado: analisisMercado
  };
}

/**
 * Analizar precio vs mercado
 */
function analizarPrecioMercado(propiedad: any, metricasMap: Map<string, any>): any {
  if (!propiedad.precio_m2 || !propiedad.ubicacion) {
    return { disponible: false };
  }

  const partes = propiedad.ubicacion.split(',').map((p: string) => p.trim());
  const ciudad = partes[0];
  const distrito = partes[1] || null;

  let metricasUsadas = metricasMap.get(`${ciudad}|${distrito}`);
  if (!metricasUsadas) {
    metricasUsadas = metricasMap.get(`${ciudad}|ciudad`);
  }

  if (!metricasUsadas || !metricasUsadas.precio_m2_medio) {
    return { disponible: false };
  }

  const precioM2Propiedad = propiedad.precio_m2;
  const precioM2Mercado = metricasUsadas.precio_m2_medio;
  const desviacionPorcentaje = ((precioM2Propiedad - precioM2Mercado) / precioM2Mercado) * 100;

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

/**
 * Calcular bonus por oportunidad de mercado
 */
function calcularBonusMercado(perfil: string, desviacion: number, nivel: string): number {
  switch (perfil) {
    case 'reformar':
      // Flippers necesitan chollos significativos
      if (desviacion <= -30) return 15;
      if (desviacion <= -25) return 12;
      if (desviacion <= -20) return 10;
      if (desviacion <= -15) return 7;
      if (desviacion <= -10) return 4;
      return 0;

    case 'alquilar':
      // Inversores de alquiler valoran chollos y precio justo
      if (desviacion <= -30) return 13;
      if (desviacion <= -25) return 11;
      if (desviacion <= -20) return 9;
      if (desviacion <= -15) return 7;
      if (desviacion <= -10) return 5;
      if (desviacion <= -5) return 3;
      if (Math.abs(desviacion) <= 5) return 2;
      return 0;

    case 'vivir':
    default:
      // Vivienda habitual: cualquier descuento es positivo
      if (desviacion <= -30) return 12;
      if (desviacion <= -20) return 10;
      if (desviacion <= -15) return 8;
      if (desviacion <= -10) return 6;
      if (desviacion <= -5) return 4;
      if (desviacion <= 0) return 2;
      return 0;
  }
}

/**
 * Ajuste adicional según perfil de inversor
 */
function calcularAjustePorPerfil(perfil: string, propiedad: any, analisis: any): number {
  let ajuste = 0;

  switch (perfil) {
    case 'reformar':
      // Flippers prefieren propiedades para reformar con potencial
      if (propiedad.condition === 'para reformar') ajuste += 3;
      if (analisis.disponible && analisis.es_chollo) ajuste += 2;
      break;

    case 'alquilar':
      // Inversores de alquiler prefieren propiedades en buen estado
      if (propiedad.condition === 'buen estado' || propiedad.condition === 'reformado') ajuste += 2;
      if (propiedad.tiene_ascensor) ajuste += 1;
      if (propiedad.tiene_parking) ajuste += 1;
      break;

    case 'vivir':
      // Vivienda habitual: valora comodidades
      if (propiedad.condition === 'obra nueva' || propiedad.condition === 'reformado') ajuste += 2;
      if (propiedad.tiene_ascensor) ajuste += 1;
      break;
  }

  return ajuste;
}

/**
 * Match de ubicación (mismo que antes)
 */
function matchUbicacion(ubicacionesCriterios: string[], ubicacionPropiedad: string): boolean {
  if (!ubicacionPropiedad) return false;
  
  const normalizar = (texto: string) => texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  
  const ubicacionPropNorm = normalizar(ubicacionPropiedad);
  
  return ubicacionesCriterios.some(ubicCriterio => {
    const criterioNorm = normalizar(ubicCriterio);
    
    if (ubicacionPropNorm === criterioNorm) return true;
    if (ubicacionPropNorm.includes(criterioNorm)) return true;
    if (criterioNorm.includes(ubicacionPropNorm)) return true;
    
    const partesProp = ubicacionPropNorm.split(',').map(p => p.trim());
    const partesCriterio = criterioNorm.split(',').map(p => p.trim());
    
    for (const parteProp of partesProp) {
      for (const parteCrit of partesCriterio) {
        if (parteProp === parteCrit) return true;
        if (parteProp.includes(parteCrit) || parteCrit.includes(parteProp)) return true;
      }
    }
    
    return false;
  });
}
