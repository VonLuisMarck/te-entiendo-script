import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOTOCASA_API = "https://web.gw.fotocasa.es/v2/propertysearch/search?portal=www-fotocasa-es";

interface ScrapingRequest {
  portal: string;
  ubicacion: string;
  tipo_propiedad?: string;
  max_pages?: number;
}

interface FotocasaPayload {
  filter: {
    isNewConstruction: null;
    isDevelopment: null;
    hasMultimedia: null;
    sortType: string;
    maxItems: number;
    pageNumber: number;
    path: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { portal, ubicacion, tipo_propiedad, max_pages = 5 } = await req.json() as ScrapingRequest;
    
    console.log(`[Scraping Service] Iniciando scraping: ${portal} - ${ubicacion}`);
    const startTime = Date.now();

    if (portal !== 'fotocasa') {
      throw new Error(`Portal ${portal} no soportado. Solo 'fotocasa' está disponible.`);
    }

    // Construir el search_path basado en ubicación
    // Ejemplo: "/es/comprar/viviendas/murcia-capital/todas-las-zonas"
    const searchPath = `/es/comprar/viviendas/${ubicacion.toLowerCase().replace(/\s+/g, '-')}/todas-las-zonas`;

    let propiedadesNuevas = 0;
    let propiedadesActualizadas = 0;
    const errores: string[] = [];
    let totalPropiedades = 0;

    // Paginar resultados
    for (let page = 1; page <= max_pages; page++) {
      console.log(`[Scraping] Procesando página ${page}...`);

      const payload: FotocasaPayload = {
        filter: {
          isNewConstruction: null,
          isDevelopment: null,
          hasMultimedia: null,
          sortType: "relevance",
          maxItems: 36,
          pageNumber: page,
          path: searchPath,
        }
      };

      try {
        const response = await fetch(FOTOCASA_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://www.fotocasa.es',
            'Referer': 'https://www.fotocasa.es/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          body: JSON.stringify(payload),
        });

        console.log(`[Scraping] Response status: ${response.status}`);
        console.log(`[Scraping] Response headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Scraping] Error response body:`, errorText);
          errores.push(`Error en página ${page}: HTTP ${response.status} - ${errorText}`);
          console.error(`[Scraping] Error HTTP en página ${page}:`, response.status);
          
          // Si es 405, intenta con ScraperAPI o Apify como alternativa
          if (response.status === 405) {
            console.error('[Scraping] Fotocasa está bloqueando el acceso directo. Se requiere proxy/servicio externo.');
            errores.push('Fotocasa bloquea el acceso directo desde servidores. Considera usar Python + Scrapy localmente o un servicio como ScraperAPI/Apify.');
          }
          break;
        }

        const data = await response.json();
        const records = data.list || data.realEstates || [];

        if (!Array.isArray(records) || records.length === 0) {
          console.log(`[Scraping] No hay más resultados en página ${page}`);
          break;
        }

        console.log(`[Scraping] Encontrados ${records.length} resultados en página ${page}`);
        totalPropiedades += records.length;

        // Procesar cada propiedad
        for (const rec of records) {
          try {
            const adId = String(rec.id || rec.propertyId || '');
            if (!adId) {
              errores.push('Propiedad sin ID, omitida');
              continue;
            }

            const propiedad = {
              external_id: `fotocasa-${adId}`,
              portal_origen: 'fotocasa',
              titulo: rec.title || rec.description || 'Sin título',
              descripcion: rec.description || null,
              precio: rec.price?.amount || rec.transactionPrice || 0,
              ubicacion: rec.address?.location || rec.location || ubicacion,
              tipo_propiedad: rec.typology || tipo_propiedad || 'piso',
              dormitorios: rec.features?.bedrooms || rec.rooms || null,
              banos: rec.features?.bathrooms || rec.bathrooms || null,
              metros: rec.surface || rec.size || null,
              condition: rec.features?.condition || rec.condition || null,
              ano_construccion: rec.features?.builtYear || null,
              tiene_ascensor: rec.features?.hasLift || rec.hasLift || false,
              tiene_parking: rec.features?.parking || rec.hasParking || false,
              url: rec.url || rec.link || `https://www.fotocasa.es/vivienda/${adId}`,
              imagenes: rec.images || rec.multimedia || [],
              activo: true,
            };

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
            errores.push(`Error procesando propiedad: ${errorMsg}`);
            console.error('[Scraping] Error procesando propiedad:', error);
          }
        }

        // Rate limiting entre páginas
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errores.push(`Error en página ${page}: ${errorMsg}`);
        console.error(`[Scraping] Error en página ${page}:`, error);
        break;
      }
    }

    const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);

    // Registrar log del scraping
    await supabase.from('scraping_logs').insert({
      portal,
      ubicacion,
      propiedades_encontradas: totalPropiedades,
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
        propiedades_encontradas: totalPropiedades,
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
