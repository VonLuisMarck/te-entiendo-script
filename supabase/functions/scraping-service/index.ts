import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapingRequest {
  portal: string;
  ubicacion: string;
  tipo_propiedad?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { portal, ubicacion, tipo_propiedad } = await req.json() as ScrapingRequest;
    
    console.log(`[Scraping Service] Iniciando scraping: ${portal} - ${ubicacion}`);
    const startTime = Date.now();

    // Simulación de scraping (en producción conectarías con tu scraper Python/Scrapy)
    // Aquí podrías hacer una llamada HTTP a tu servicio de scraping Python externo
    const propiedadesMock = [
      {
        external_id: `${portal}-${Date.now()}-1`,
        portal_origen: portal,
        titulo: `Piso en ${ubicacion} - Céntrico`,
        descripcion: `Amplio piso en el centro de ${ubicacion} con todas las comodidades`,
        precio: 150000,
        ubicacion: ubicacion,
        tipo_propiedad: tipo_propiedad || 'piso',
        dormitorios: 3,
        banos: 2,
        metros: 95,
        condition: 'buen estado',
        ano_construccion: 2010,
        tiene_ascensor: true,
        tiene_parking: false,
        url: `https://${portal}.com/propiedad/ejemplo-1`,
        imagenes: [],
        activo: true,
      },
      {
        external_id: `${portal}-${Date.now()}-2`,
        portal_origen: portal,
        titulo: `Chalet en ${ubicacion} - Zona Residencial`,
        descripcion: `Hermoso chalet con jardín privado en ${ubicacion}`,
        precio: 350000,
        ubicacion: ubicacion,
        tipo_propiedad: 'chalet',
        dormitorios: 4,
        banos: 3,
        metros: 180,
        condition: 'nuevo',
        ano_construccion: 2022,
        tiene_ascensor: false,
        tiene_parking: true,
        url: `https://${portal}.com/propiedad/ejemplo-2`,
        imagenes: [],
        activo: true,
      },
    ];

    let propiedadesNuevas = 0;
    let propiedadesActualizadas = 0;
    const errores: string[] = [];

    // Insertar o actualizar propiedades
    for (const propiedad of propiedadesMock) {
      try {
        const { data: existing } = await supabase
          .from('propiedades')
          .select('id')
          .eq('external_id', propiedad.external_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('propiedades')
            .update(propiedad)
            .eq('id', existing.id);
          propiedadesActualizadas++;
        } else {
          await supabase
            .from('propiedades')
            .insert(propiedad);
          propiedadesNuevas++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errores.push(`Error procesando ${propiedad.external_id}: ${errorMsg}`);
      }
    }

    const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);

    // Registrar log del scraping
    await supabase.from('scraping_logs').insert({
      portal,
      ubicacion,
      propiedades_encontradas: propiedadesMock.length,
      propiedades_nuevas: propiedadesNuevas,
      propiedades_actualizadas: propiedadesActualizadas,
      errores: errores.length > 0 ? errores : null,
      duracion_segundos: duracionSegundos,
      status: errores.length === 0 ? 'success' : 'partial',
    });

    console.log(`[Scraping Service] Completado: ${propiedadesNuevas} nuevas, ${propiedadesActualizadas} actualizadas`);

    return new Response(
      JSON.stringify({
        success: true,
        propiedades_encontradas: propiedadesMock.length,
        propiedades_nuevas: propiedadesNuevas,
        propiedades_actualizadas: propiedadesActualizadas,
        errores,
        duracion_segundos: duracionSegundos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Scraping Service] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
