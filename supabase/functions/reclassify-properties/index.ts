import { authorize } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Reclasificar] Iniciando reclasificación de propiedades...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Cargar el JSON de ubicaciones
    const { data: ubicacionesData, error: ubicacionesError } = await supabase
      .from('ubicaciones_config')
      .select('contenido')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (ubicacionesError || !ubicacionesData) {
      throw new Error('No se pudo cargar el JSON de ubicaciones');
    }

    const ubicaciones = ubicacionesData.contenido;
    console.log('[Reclasificar] JSON de ubicaciones cargado');

    // 2. Crear un mapa de barrio → distrito para búsqueda rápida
    const barrioToDistrito: Record<string, { distrito: string, ciudad: string, provincia: string }> = {};
    
    for (const [provinciaKey, provinciaData] of Object.entries(ubicaciones) as [string, any][]) {
      const provincia = provinciaData.provincia;
      
      for (const [ciudad, distritosData] of Object.entries(provinciaData.ciudades) as [string, any][]) {
        // Si es un objeto (tiene distritos)
        if (typeof distritosData === 'object' && !Array.isArray(distritosData)) {
          for (const [distrito, barrios] of Object.entries(distritosData) as [string, string[]][]) {
            // Guardar el distrito mismo
            barrioToDistrito[distrito.toLowerCase()] = { distrito, ciudad, provincia };
            
            // Guardar todos los barrios de este distrito
            if (Array.isArray(barrios)) {
              for (const barrio of barrios) {
                barrioToDistrito[barrio.toLowerCase()] = { distrito, ciudad, provincia };
              }
            }
          }
        }
      }
    }

    console.log(`[Reclasificar] Mapa creado con ${Object.keys(barrioToDistrito).length} ubicaciones`);

    // 3. Obtener todas las propiedades con distrito no nulo
    const { data: propiedades, error: propiedadesError } = await supabase
      .from('propiedades')
      .select('id, distrito, ciudad, provincia, ubicacion')
      .not('distrito', 'is', null);

    if (propiedadesError) {
      throw new Error(`Error obteniendo propiedades: ${propiedadesError.message}`);
    }

    console.log(`[Reclasificar] ${propiedades?.length || 0} propiedades con distrito encontradas`);

    let corregidas = 0;
    let noCorregidas = 0;
    const updates: Array<{ id: string, distrito: string, cambio: string }> = [];

    // 4. Procesar cada propiedad
    for (const prop of propiedades || []) {
      if (!prop.distrito) continue;

      const distritoActual = prop.distrito.trim();
      const distritoActualLower = distritoActual.toLowerCase();

      // Buscar si es un barrio que necesita corrección
      const ubicacionCorrecta = barrioToDistrito[distritoActualLower];

      if (ubicacionCorrecta) {
        // Verificar si el distrito actual es diferente al distrito padre
        if (ubicacionCorrecta.distrito !== distritoActual) {
          // Es un barrio, necesita corrección
          updates.push({
            id: prop.id,
            distrito: ubicacionCorrecta.distrito,
            cambio: `"${distritoActual}" → "${ubicacionCorrecta.distrito}"`
          });
          corregidas++;
        } else {
          // Ya está correcto (es un distrito de primer nivel)
          noCorregidas++;
        }
      } else {
        // No se encontró en el mapa, podría ser un distrito incorrecto o ciudad sin distritos
        console.log(`[Reclasificar] No encontrado: "${distritoActual}" (${prop.ciudad})`);
        noCorregidas++;
      }
    }

    console.log(`[Reclasificar] Propiedades a corregir: ${corregidas}`);
    console.log(`[Reclasificar] Propiedades ya correctas: ${noCorregidas}`);

    // 5. Realizar las actualizaciones en lotes
    if (updates.length > 0) {
      const BATCH_SIZE = 100;
      let procesadas = 0;

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        for (const update of batch) {
          const { error: updateError } = await supabase
            .from('propiedades')
            .update({ distrito: update.distrito })
            .eq('id', update.id);

          if (updateError) {
            console.error(`[Reclasificar] Error actualizando ${update.id}:`, updateError);
          } else {
            procesadas++;
          }
        }

        console.log(`[Reclasificar] Procesadas ${Math.min(i + BATCH_SIZE, updates.length)} de ${updates.length}`);
      }

      console.log(`[Reclasificar] ✅ Actualizadas ${procesadas} propiedades`);
    }

    // 6. Log de cambios significativos (primeros 20)
    const ejemplosCambios = updates.slice(0, 20).map(u => u.cambio);

    return new Response(
      JSON.stringify({
        success: true,
        total_propiedades: propiedades?.length || 0,
        corregidas: corregidas,
        ya_correctas: noCorregidas,
        actualizadas: updates.length,
        ejemplos_cambios: ejemplosCambios,
        message: `Reclasificación completada: ${updates.length} propiedades actualizadas`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[Reclasificar] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Error en reclasificación',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
