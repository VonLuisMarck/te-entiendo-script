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
      .not('precio_m2', 'is', null) // Solo con precio_m2 calculado
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

    // Agrupar por ciudad y barrio
    const grupos = agruparPorCiudadBarrio(propiedades);
    
    let metricasActualizadas = 0;

    for (const [key, props] of Object.entries(grupos)) {
      const [ciudad, barrio] = key.split('|');
      const metricas = calcularMetricas(props);

      // Obtener métrica existente para calcular proyección
      const { data: metricaExistente } = await supabase
        .from('metricas_barrios')
        .select('id, precio_m2_medio, created_at')
        .eq('ciudad', ciudad)
        .eq('barrio', barrio || null)
        .maybeSingle();

      let proyeccionRevalorizacion = null;
      let indiceDinamismo = null;
      let mesesDatosHistoricos = 0;

      if (metricaExistente?.id) {
        // Guardar snapshot histórico ANTES de actualizar
        await supabase.from('metricas_barrios_historico').insert({
          metrica_id: metricaExistente.id,
          ciudad,
          barrio: barrio || null,
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
          .limit(6); // Últimos 6 meses

        if (historico && historico.length >= 3) {
          // Calcular proyección real con datos históricos
          proyeccionRevalorizacion = calcularProyeccionRevalorizacion(historico);
          mesesDatosHistoricos = historico.length;
        }
      }

      // Calcular índice de dinamismo temporal (siempre)
      indiceDinamismo = calcularIndiceDinamismo(props);

      // Upsert de métricas con proyección
      const { error: upsertError } = await supabase
        .from('metricas_barrios')
        .upsert({
          ciudad,
          barrio: barrio || null,
          ...metricas,
          proyeccion_revalorizacion_anual: proyeccionRevalorizacion,
          indice_dinamismo: indiceDinamismo,
          meses_datos_historicos: mesesDatosHistoricos,
        }, {
          onConflict: 'ciudad,barrio'
        });

      if (upsertError) {
        console.error(`Error actualizando métricas para ${key}:`, upsertError);
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

function agruparPorCiudadBarrio(propiedades: any[]): Record<string, any[]> {
  const grupos: Record<string, any[]> = {};

  for (const prop of propiedades) {
    // Formato normalizado esperado: "Barrio, Ciudad" o solo "Ciudad"
    const ubicacion = prop.ubicacion || '';
    
    let ciudad = 'Desconocida';
    let barrio = null;
    
    // Separar por coma - FORMATO: "Barrio, Ciudad"
    if (ubicacion.includes(',')) {
      const partes = ubicacion.split(',').map((p: string) => p.trim());
      barrio = partes[0] || null;      // Primera parte = Barrio
      ciudad = partes[1] || 'Desconocida'; // Segunda parte = Ciudad
      console.log(`Ubicación: "${ubicacion}" -> Ciudad: "${ciudad}", Barrio: "${barrio}"`);
    }
    // Si no hay separador, toda la ubicación es la ciudad
    else {
      ciudad = ubicacion.trim() || 'Desconocida';
      barrio = null;
      console.log(`Ubicación sin separador: "${ubicacion}" -> Ciudad: "${ciudad}"`);
    }

    // Agrupar por ciudad+barrio específico
    if (barrio) {
      const key = `${ciudad}|${barrio}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(prop);
    }

    // Agrupar por ciudad (agregado total) - siempre
    const keyCiudad = `${ciudad}|`;
    if (!grupos[keyCiudad]) grupos[keyCiudad] = [];
    grupos[keyCiudad].push(prop);
  }

  console.log(`Grupos creados: ${Object.keys(grupos).length}`);
  Object.keys(grupos).slice(0, 5).forEach(key => {
    console.log(`  ${key} -> ${grupos[key].length} propiedades`);
  });

  return grupos;
}

function calcularMetricas(propiedades: any[]) {
  const preciosM2 = propiedades.map(p => p.precio_m2).filter(p => p > 0).sort((a, b) => a - b);
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

    // Por tipo de propiedad
    metros_medio_piso: avg(pisos.map(p => p.metros)),
    metros_medio_chalet: avg(chalets.map(p => p.metros)),
    precio_medio_piso: avg(pisos.map(p => p.precio)),
    precio_medio_chalet: avg(chalets.map(p => p.precio)),
    precio_m2_medio_piso: avg(pisos.map(p => p.precio_m2).filter(p => p > 0)),
    precio_m2_medio_chalet: avg(chalets.map(p => p.precio_m2).filter(p => p > 0)),

    // Volumen
    total_propiedades: propiedades.length,
    total_pisos: pisos.length,
    total_chalets: chalets.length,
    total_otros: otros.length,

    // Tendencia (por ahora estable, se puede mejorar comparando con datos históricos)
    tendencia: 'estable',
    variacion_mensual: null,
  };
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round(sum / arr.length);
}

// Calcula proyección de revalorización anual en % basada en datos históricos
function calcularProyeccionRevalorizacion(historico: any[]): number | null {
  if (historico.length < 3) return null;

  // Calcular tasa de crecimiento mensual promedio
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

  // Promedio de variación mensual → Proyección anual
  const variacionMensualPromedio = sumaVariaciones / countVariaciones;
  const proyeccionAnual = variacionMensualPromedio * 12;

  return Math.round(proyeccionAnual * 10) / 10; // Redondear a 1 decimal
}

// Calcula índice de dinamismo 0-100 basado en actividad del mercado
function calcularIndiceDinamismo(propiedades: any[]): number {
  let score = 50; // Base neutral

  // Factor 1: Volumen de propiedades (más = más dinámico)
  const volumen = propiedades.length;
  if (volumen >= 50) score += 20;
  else if (volumen >= 30) score += 15;
  else if (volumen >= 15) score += 10;
  else if (volumen < 5) score -= 10;

  // Factor 2: Propiedades nuevas recientes (últimos 30 días)
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

  // Factor 3: Diversidad de tipos de propiedad (más = más dinámico)
  const tiposUnicos = new Set(propiedades.map(p => p.tipo_propiedad)).size;
  if (tiposUnicos >= 4) score += 10;
  else if (tiposUnicos >= 3) score += 5;

  // Factor 4: Dispersión de precios (más variedad = más dinámico)
  const precios = propiedades.map(p => p.precio_m2).filter(p => p > 0);
  if (precios.length >= 5) {
    const precioMin = Math.min(...precios);
    const precioMax = Math.max(...precios);
    const dispersion = precioMax > 0 ? ((precioMax - precioMin) / precioMax) * 100 : 0;
    
    if (dispersion >= 40) score += 5;
    else if (dispersion >= 25) score += 3;
  }

  return Math.min(100, Math.max(0, score)); // Limitar 0-100
}
