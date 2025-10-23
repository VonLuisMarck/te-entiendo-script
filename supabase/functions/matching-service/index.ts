import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchingRequest {
  cliente_id?: string;
  propiedad_id?: string;
  recalcular_todos?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { cliente_id, propiedad_id, recalcular_todos } = await req.json() as MatchingRequest;
    
    console.log('[Matching Service] Iniciando cálculo de matchings');
    const startTime = Date.now();

    let matchingsCreados = 0;

    // Obtener clientes y propiedades según los filtros
    const { data: clientes } = await supabase
      .from('clientes')
      .select(`
        id,
        presupuesto_min,
        presupuesto_max,
        criterios_busqueda (*)
      `)
      .eq('activo', true)
      .eq(cliente_id ? 'id' : 'activo', cliente_id || true);

    const { data: propiedades } = await supabase
      .from('propiedades')
      .select('*')
      .eq('activo', true)
      .eq(propiedad_id ? 'id' : 'activo', propiedad_id || true);

    if (!clientes || !propiedades) {
      throw new Error('No se encontraron clientes o propiedades');
    }

    // Calcular matchings
    for (const cliente of clientes) {
      const criterios = cliente.criterios_busqueda?.[0];
      
      for (const propiedad of propiedades) {
        const score = calcularScore(cliente, criterios, propiedad);
        
        if (score >= 50) { // Solo guardar matchings con score >= 50
          const criteriosCumplidos = evaluarCriterios(cliente, criterios, propiedad);
          
          // Verificar si ya existe el matching
          const { data: existing } = await supabase
            .from('matchings')
            .select('id')
            .eq('cliente_id', cliente.id)
            .eq('propiedad_id', propiedad.id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('matchings')
              .update({
                score,
                criterios_cumplidos: criteriosCumplidos,
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('matchings')
              .insert({
                cliente_id: cliente.id,
                propiedad_id: propiedad.id,
                score,
                criterios_cumplidos: criteriosCumplidos,
              });
            matchingsCreados++;
          }
        }
      }
    }

    const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);

    console.log(`[Matching Service] Completado: ${matchingsCreados} matchings creados en ${duracionSegundos}s`);

    return new Response(
      JSON.stringify({
        success: true,
        matchings_creados: matchingsCreados,
        clientes_procesados: clientes.length,
        propiedades_procesadas: propiedades.length,
        duracion_segundos: duracionSegundos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Matching Service] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function calcularScore(cliente: any, criterios: any, propiedad: any): number {
  let score = 0;
  let maxScore = 0;

  // Presupuesto (peso: 30 puntos)
  maxScore += 30;
  if (propiedad.precio >= (cliente.presupuesto_min || 0) && 
      propiedad.precio <= (cliente.presupuesto_max || Infinity)) {
    score += 30;
  } else {
    const desviacion = Math.min(
      Math.abs(propiedad.precio - (cliente.presupuesto_min || 0)),
      Math.abs(propiedad.precio - (cliente.presupuesto_max || Infinity))
    );
    const penalizacion = Math.min(30, (desviacion / 10000) * 5);
    score += Math.max(0, 30 - penalizacion);
  }

  if (!criterios) return (score / maxScore) * 100;

  // Ubicación (peso: 25 puntos)
  maxScore += 25;
  if (criterios.ubicaciones?.includes(propiedad.ubicacion)) {
    score += 25;
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
