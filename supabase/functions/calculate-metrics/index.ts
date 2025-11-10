import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MetricsRequestSchema = z.object({
  ciudad: z.string().min(2).max(100).optional(),
  recalcular_todo: z.boolean().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    const { ciudad, recalcular_todo } = MetricsRequestSchema.parse(requestBody);
    
    console.log('[Calculate Metrics] Iniciando cálculo de métricas');
    const startTime = Date.now();

    // Obtener todas las propiedades activas
    let query = supabase
      .from('propiedades')
      .select('*')
      .eq('activo', true)
      .not('precio_m2', 'is', null)
      .not('ubicacion', 'is', null);

    if (ciudad && !recalcular_todo) {
      query = query.eq('ubicacion', ciudad);
    }

    const { data: propiedades, error } = await query;

    if (error) throw error;
    if (!propiedades || propiedades.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No hay propiedades para calcular' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agrupar por provincia, ciudad y distrito
    const grupos = agruparPorProvinciaDistrito(propiedades);
    
    let metricasActualizadas = 0;

    for (const [key, props] of Object.entries(grupos)) {
      const [provincia, ciudad, distrito] = key.split('|');
      const metricas = calcularMetricas(props as any[]);

      // Obtener métrica existente para calcular proyección
      const { data: metricaExistente } = await supabase
        .from('metricas_barrios')
        .select('id, precio_m2_medio, created_at')
        .eq('provincia', provincia || 'Desconocida')
        .eq('ciudad', ciudad || 'Sin Clasificar')
        .eq('distrito', distrito || '')
        .maybeSingle();

      let proyeccionRevalorizacion = null;
      let indiceDinamismo = null;
      let mesesDatosHistoricos = 0;

      if (metricaExistente?.id) {
        // Guardar snapshot histórico ANTES de actualizar
        await supabase.from('metricas_barrios_historico').insert({
          metrica_id: metricaExistente.id,
          provincia: provincia || 'Desconocida',
          ciudad: ciudad || 'Sin Clasificar',
          distrito: distrito || null,
          precio_medio: metricaExistente.precio_m2_medio,
          precio_m2_medio: metricaExistente.precio_m2_medio,
          total_propiedades: metricas.total_propiedades,
        });

        // Obtener histórico para calcular tendencia
        const { data: historico } = await supabase
          .from('metricas_barrios_historico')
          .select('precio_m2_medio, fecha_snapshot')
          .eq('metrica_id', metricaExistente.id)
          .order('fecha_snapshot', { ascending: false })
          .limit(6);

        if (historico && historico.length >= 3) {
          proyeccionRevalorizacion = calcularProyeccionRevalorizacion(historico);
          mesesDatosHistoricos = historico.length;
        }
      }

      // Calcular índice de dinamismo temporal
      indiceDinamismo = calcularIndiceDinamismo(props as any[]);

      // Upsert de métricas con provincia (asegurar que ciudad nunca sea NULL)
      const metricaData = {
        provincia: provincia || 'Desconocida',
        ciudad: ciudad || 'Sin Clasificar',
        distrito: distrito || null,
        ...metricas,
        proyeccion_revalorizacion_anual: proyeccionRevalorizacion,
        indice_dinamismo: indiceDinamismo,
        meses_datos_historicos: mesesDatosHistoricos,
      };

      // Buscar si ya existe (usar mismos valores defaults)
      const { data: existing } = await supabase
        .from('metricas_barrios')
        .select('id')
        .eq('provincia', provincia || 'Desconocida')
        .eq('ciudad', ciudad || 'Sin Clasificar')
        .eq('distrito', distrito || '')
        .maybeSingle();

      let error: any = null;
      if (existing) {
        // Actualizar existente
        const result = await supabase
          .from('metricas_barrios')
          .update(metricaData)
          .eq('id', existing.id);
        error = result.error;
      } else {
        // Insertar nueva
        const result = await supabase
          .from('metricas_barrios')
          .insert(metricaData);
        error = result.error;
      }

      if (error) {
        console.error(`Error actualizando métricas para ${key}:`, error);
      } else {
        metricasActualizadas++;
      }
    }

    const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);

    console.log(`[Calculate Metrics] Completado: ${metricasActualizadas} métricas actualizadas`);

    return new Response(
      JSON.stringify({
        success: true,
        metricas_actualizadas: metricasActualizadas,
        propiedades_analizadas: propiedades.length,
        duracion_segundos: duracionSegundos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Calculate Metrics] Error:', error.message);
    
    const status = error.message?.includes('Unauthorized') ? 403 : 
                   error.issues ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.issues ? 'Invalid request data' : 'Failed to calculate metrics'
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function agruparPorProvinciaDistrito(propiedades: any[]): Record<string, any[]> {
  const grupos: Record<string, any[]> = {};

  for (const prop of propiedades) {
    // IMPORTANTE: Validar que ciudad no sea NULL/vacío
    // Si no tiene ciudad normalizada, clasificar como "Sin Clasificar"
    const provincia = prop.provincia || 'Desconocida';
    const ciudad = prop.ciudad || 'Sin Clasificar';
    const distrito = prop.distrito || '';
    
    // Clave única: provincia|ciudad|distrito
    const key = `${provincia}|${ciudad}|${distrito}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(prop);
  }

  console.log(`Grupos creados: ${Object.keys(grupos).length}`);
  Object.keys(grupos).slice(0, 10).forEach(key => {
    console.log(`  ${key} -> ${grupos[key].length} propiedades`);
  });

  return grupos;
}

function calcularMetricas(propiedades: any[]) {
  // PASO 1: Filtrar outliers usando IQR (Interquartile Range)
  const preciosM2Raw = propiedades.map(p => p.precio_m2).filter(p => p > 0).sort((a, b) => a - b);
  
  // Calcular outliers ANTES de cualquier cálculo
  const preciosM2Limpios = filtrarOutliers(preciosM2Raw);
  
  console.log(`[Métricas] Propiedades: ${propiedades.length}, Outliers eliminados: ${preciosM2Raw.length - preciosM2Limpios.length}`);
  
  // Usar solo precios limpios para cálculos
  const preciosM2 = preciosM2Limpios.sort((a, b) => a - b);
  const precios = propiedades.map(p => p.precio).filter(p => p > 0);
  
  // Filtrar por tipo
  const pisos = propiedades.filter(p => p.tipo_propiedad === 'piso');
  const chalets = propiedades.filter(p => p.tipo_propiedad === 'chalet');
  const otros = propiedades.filter(p => p.tipo_propiedad !== 'piso' && p.tipo_propiedad !== 'chalet');

  // Calcular percentiles
  const percentil = (arr: number[], p: number) => {
    if (arr.length === 0) return null;
    const index = Math.ceil(arr.length * p) - 1;
    return arr[Math.max(0, index)];
  };

  return {
    // Métricas generales
    precio_medio: avg(precios),
    precio_m2_medio: avg(preciosM2),
    precio_m2_min: preciosM2[0] || null,
    precio_m2_max: preciosM2[preciosM2.length - 1] || null,
    precio_m2_percentil_25: percentil(preciosM2, 0.25),
    precio_m2_percentil_50: percentil(preciosM2, 0.50),
    precio_m2_percentil_75: percentil(preciosM2, 0.75),

    // Por tipo de propiedad (también filtrar outliers)
    metros_medio_piso: avg(pisos.map(p => p.metros)),
    metros_medio_chalet: avg(chalets.map(p => p.metros)),
    precio_medio_piso: avg(pisos.map(p => p.precio)),
    precio_medio_chalet: avg(chalets.map(p => p.precio)),
    precio_m2_medio_piso: avg(filtrarOutliers(pisos.map(p => p.precio_m2).filter(p => p > 0))),
    precio_m2_medio_chalet: avg(filtrarOutliers(chalets.map(p => p.precio_m2).filter(p => p > 0))),

    // Volumen
    total_propiedades: propiedades.length,
    total_pisos: pisos.length,
    total_chalets: chalets.length,
    total_otros: otros.length,

    // Tendencia
    tendencia: 'estable',
    variacion_mensual: null,
  };
}

// Función para filtrar outliers usando método IQR (Interquartile Range)
function filtrarOutliers(valores: number[]): number[] {
  if (valores.length < 4) return valores; // No suficientes datos para filtrar
  
  const sorted = [...valores].sort((a, b) => a - b);
  
  // Calcular cuartiles
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Definir límites (1.5 * IQR es el estándar para outliers)
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  // Filtrar valores fuera de los límites
  return valores.filter(v => v >= lowerBound && v <= upperBound);
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round(sum / arr.length);
}

function calcularProyeccionRevalorizacion(historico: any[]): number | null {
  if (historico.length < 3) return null;

  let sumaVariaciones = 0;
  let countVariaciones = 0;

  for (let i = 0; i < historico.length - 1; i++) {
    const precioActual = historico[i].precio_m2_medio;
    const precioAnterior = historico[i + 1].precio_m2_medio;
    
    if (precioActual && precioAnterior && precioAnterior > 0) {
      const variacionMensual = ((precioActual - precioAnterior) / precioAnterior) * 100;
      sumaVariaciones += variacionMensual;
      countVariaciones++;
    }
  }

  if (countVariaciones === 0) return null;

  const variacionMensualPromedio = sumaVariaciones / countVariaciones;
  const proyeccionAnual = variacionMensualPromedio * 12;

  return Math.round(proyeccionAnual * 10) / 10;
}

function calcularIndiceDinamismo(propiedades: any[]): number {
  let score = 50;

  const volumen = propiedades.length;
  if (volumen >= 50) score += 20;
  else if (volumen >= 30) score += 15;
  else if (volumen >= 15) score += 10;
  else if (volumen < 5) score -= 10;

  const ahora = new Date();
  const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const nuevasRecientes = propiedades.filter(p => {
    const fecha = new Date(p.fecha_publicacion || p.created_at);
    return fecha >= hace30Dias;
  }).length;
  
  const ratioNuevas = volumen > 0 ? (nuevasRecientes / volumen) * 100 : 0;
  if (ratioNuevas >= 50) score += 15;
  else if (ratioNuevas >= 30) score += 10;
  else if (ratioNuevas >= 15) score += 5;
  else if (ratioNuevas < 5) score -= 5;

  const tiposUnicos = new Set(propiedades.map(p => p.tipo_propiedad)).size;
  if (tiposUnicos >= 4) score += 10;
  else if (tiposUnicos >= 3) score += 5;

  const precios = propiedades.map(p => p.precio_m2).filter(p => p > 0);
  if (precios.length >= 5) {
    const precioMin = Math.min(...precios);
    const precioMax = Math.max(...precios);
    const dispersion = precioMax > 0 ? ((precioMax - precioMin) / precioMax) * 100 : 0;
    
    if (dispersion >= 40) score += 5;
    else if (dispersion >= 25) score += 3;
  }

  return Math.min(100, Math.max(0, score));
}