import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricsRequest {
  ciudad?: string;
  recalcular_todo?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ciudad, recalcular_todo } = await req.json() as MetricsRequest;
    
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

      // Upsert de métricas
      const { error: upsertError } = await supabase
        .from('metricas_barrios')
        .upsert({
          ciudad,
          barrio: barrio || null,
          ...metricas,
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
  } catch (error) {
    console.error('[Calculate Metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function agruparPorCiudadBarrio(propiedades: any[]): Record<string, any[]> {
  const grupos: Record<string, any[]> = {};

  for (const prop of propiedades) {
    // Intentar extraer ciudad y barrio de la ubicación
    // Formatos esperados: "Ciudad, Barrio" o "Ciudad - Barrio" o solo "Ciudad"
    const ubicacion = prop.ubicacion || '';
    
    let ciudad = 'Desconocida';
    let barrio = null;
    
    // Intentar separar por coma primero
    if (ubicacion.includes(',')) {
      const partes = ubicacion.split(',').map((p: string) => p.trim());
      ciudad = partes[0] || 'Desconocida';
      barrio = partes[1] || null;
    }
    // Luego intentar por guión
    else if (ubicacion.includes('-')) {
      const partes = ubicacion.split('-').map((p: string) => p.trim());
      ciudad = partes[0] || 'Desconocida';
      barrio = partes[1] || null;
    }
    // Si no hay separador, toda la ubicación es la ciudad
    else {
      ciudad = ubicacion.trim() || 'Desconocida';
      barrio = null;
    }

    // Agrupar por ciudad+barrio
    const key = `${ciudad}|${barrio || ''}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(prop);

    // También agrupar solo por ciudad (agregado total)
    const keyCiudad = `${ciudad}|`;
    if (!grupos[keyCiudad]) grupos[keyCiudad] = [];
    grupos[keyCiudad].push(prop);
  }

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
