import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache para ubicaciones
let ubicacionesCache: any = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

async function getUbicaciones() {
  const now = Date.now();
  
  // Usar cache si está vigente
  if (ubicacionesCache && (now - cacheTime) < CACHE_DURATION) {
    return ubicacionesCache;
  }
  
  // Cargar desde Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const { data, error } = await supabase
    .from('ubicaciones_config')
    .select('contenido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    console.error('Error cargando ubicaciones:', error);
    throw new Error('No se pudieron cargar las ubicaciones de la base de datos');
  }
  
  ubicacionesCache = data.contenido;
  cacheTime = now;
  return data.contenido;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { raw_data, portal_origen, url_propiedad } = requestBody;
    
    // Validar que venga el raw data
    if (!raw_data || typeof raw_data !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Se requiere raw_data (HTML o JSON de la propiedad)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!portal_origen) {
      return new Response(
        JSON.stringify({ error: 'Se requiere portal_origen (fotocasa, pisos.com, etc.)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!url_propiedad) {
      return new Response(
        JSON.stringify({ error: 'Se requiere url_propiedad (URL de la propiedad)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY no configurada');
      return new Response(
        JSON.stringify({ error: 'API key no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener ubicaciones desde la base de datos
    const ubicacionesData = await getUbicaciones();

    const systemPrompt = `Eres un experto en extracción de datos de propiedades inmobiliarias de diferentes portales web españoles (Fotocasa, Pisos.com, Idealista, etc).

Tu tarea es extraer TODA la información estructurada de una propiedad a partir del HTML/JSON raw de la página del portal.

UBICACIONES VÁLIDAS EN ESPAÑA:
${JSON.stringify(ubicacionesData, null, 2)}

⚠️ **JERARQUÍA DEL JSON**: Provincia → Ciudad → Distrito (primer nivel) → Barrios (segundo nivel, NO uses)

REGLAS CRÍTICAS - UBICACIÓN (LA MÁS IMPORTANTE):

🔴 **JERARQUÍA OBLIGATORIA**:
   El JSON tiene 3 niveles que DEBES respetar:
   1. **Provincia**: Ej: "Madrid", "Barcelona", "Valencia"
   2. **Ciudad**: Ej: "Madrid", "Barcelona", "Valencia", "Murcia"  
   3. **Distrito**: PRIMER nivel del JSON de cada ciudad (ej: "Salamanca", "Chamberí", "Centro")
   4. **Barrios**: SEGUNDO nivel (ignóralos, NO los uses como distrito)

🔴 **REGLAS PARA CLASIFICAR DISTRITO**:
   - **distrito**: SOLO el PRIMER nivel del JSON de esa ciudad
     * Si mencionan "Castellana" (barrio de Salamanca) → distrito: "Salamanca" (busca el distrito padre)
     * Si mencionan "Gaztambide" (barrio de Chamberí) → distrito: "Chamberí" (busca el distrito padre)
     * Si mencionan "Chamberí" directamente → distrito: "Chamberí"
     * Si mencionan "Barrio del Pilar" (barrio de Fuencarral-El Pardo) → distrito: "Fuencarral-El Pardo"
   
   - Si mencionan un BARRIO (segundo nivel), encuentra su DISTRITO padre (primer nivel)
   - Si ciudad NO tiene distritos en JSON → distrito: null
   - Si ciudad <300k habitantes → distrito: null

🔴 **EJEMPLOS CORRECTOS**:
   - "Castellana, Madrid" → ciudad: "Madrid", distrito: "Salamanca", provincia: "Madrid"
   - "Gaztambide" → ciudad: "Madrid", distrito: "Chamberí", provincia: "Madrid"
   - "Barrio del Pilar, Madrid" → ciudad: "Madrid", distrito: "Fuencarral-El Pardo", provincia: "Madrid"
   - "Getafe" → ciudad: "Getafe", distrito: null, provincia: "Madrid"
   - "Centro, Murcia" → ciudad: "Murcia", distrito: "Centro", provincia: "Murcia"

1. **UBICACIÓN**: SOLO usa el PRIMER nivel de distritos del JSON. Si mencionan un barrio, busca a qué distrito pertenece.

2. **TIPO DE PROPIEDAD**: Normaliza a uno de estos valores:
   - "Piso" (apartamentos, pisos, estudios)
   - "Chalet" (casas, chalets, villas, adosados)
   - "Ático" 
   - "Dúplex"
   - "Local Comercial"
   - "Oficina"
   - "Garaje"
   - "Terreno"
   - "Otro"

3. **CONDICIÓN**: Normaliza a:
   - "Obra nueva"
   - "Segunda mano - buen estado"
   - "Segunda mano - a reformar"
   - "En construcción"
   - null (si no hay información)

4. **NÚMEROS**: Extrae valores numéricos limpios (sin símbolos, sin texto)
   - Precio: en euros (ejemplo: 350000)
   - Metros: en m² (ejemplo: 85.5)
   - Dormitorios/Baños: números enteros
   - Año construcción: año de 4 dígitos

5. **BOOLEANOS**: 
   - tiene_ascensor: true/false/null
   - tiene_parking: true/false/null

6. **TEXTOS**:
   - Título: extraer el título principal de la propiedad
   - Descripción: la descripción completa (máximo 2000 caracteres)
   - URL: la URL completa de la propiedad
   - Imágenes: array de URLs de imágenes (máximo 10)

7. **CÁLCULOS AUTOMÁTICOS**:
   - Si tienes precio y metros, calcula precio_m2 = precio / metros
   - Si falta algún dato, devuelve null (NO inventes valores)

8. **EXTERNAL_ID**: Extrae el ID único de la propiedad del portal
   - En Fotocasa: número en la URL tipo "/inmueble/12345678-piso-madrid"
   - En Pisos.com: número de referencia tipo "ref123456" o en URL
   - Es el identificador único que usa el portal (CRÍTICO para evitar duplicados)

9. **FECHA_PUBLICACION**: Intenta extraer la fecha de publicación del anuncio
   - Formatos comunes: "Publicado hace X días", "Fecha: DD/MM/YYYY"
   - Devuelve en formato ISO (YYYY-MM-DD) o null si no la encuentras`;

    const userPrompt = `Portal origen: ${portal_origen}

Extrae TODOS los datos de esta propiedad del HTML/JSON raw:

${raw_data.substring(0, 15000)}`; // Limitar a 15k caracteres para no exceder tokens

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Modelo más barato
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_property_data',
              description: 'Extrae todos los datos estructurados de una propiedad inmobiliaria',
              parameters: {
                type: 'object',
                properties: {
                  // Ubicación
                  provincia: { type: 'string', description: 'Provincia (de la lista válida)' },
                  ciudad: { type: 'string', description: 'Ciudad o municipio (de la lista válida)' },
                  distrito: { type: 'string', description: 'Distrito (de la lista válida, vacío si no aplica)' },
                  ubicacion: { type: 'string', description: 'Ubicación completa como texto legible (ej: "Madrid, Centro")' },
                  
                  // Información básica
                  titulo: { type: 'string', description: 'Título de la propiedad' },
                  descripcion: { type: 'string', description: 'Descripción completa (max 2000 chars)' },
                  tipo_propiedad: { type: 'string', description: 'Tipo normalizado (Piso, Chalet, Ático, etc.)' },
                  condition: { type: 'string', description: 'Estado: Obra nueva, Segunda mano - buen estado, etc.' },
                  
                  // Datos numéricos
                  precio: { type: 'number', description: 'Precio en euros (número limpio)' },
                  metros: { type: 'number', description: 'Metros cuadrados' },
                  precio_m2: { type: 'number', description: 'Precio por m2 (calcular si tienes precio y metros)' },
                  dormitorios: { type: 'integer', description: 'Número de dormitorios' },
                  banos: { type: 'integer', description: 'Número de baños' },
                  ano_construccion: { type: 'integer', description: 'Año de construcción (4 dígitos)' },
                  
                  // Características
                  tiene_ascensor: { type: 'boolean', description: 'true/false/null' },
                  tiene_parking: { type: 'boolean', description: 'true/false/null' },
                  
                  // URLs y medios
                  url: { type: 'string', description: 'URL completa de la propiedad' },
                  imagenes: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Array de URLs de imágenes (máximo 10)' 
                  },
                  
                  // Identificadores
                  external_id: { type: 'string', description: 'ID único de la propiedad en el portal (número de referencia)' },
                  fecha_publicacion: { type: 'string', description: 'Fecha de publicación en formato ISO (YYYY-MM-DD) o null' }
                },
                required: ['titulo', 'precio', 'ubicacion', 'tipo_propiedad', 'provincia', 'ciudad', 'url', 'external_id'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_property_data' } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido, intenta más tarde' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos agotados, añade fondos a tu workspace' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Error al clasificar ubicación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No se recibió tool call de la IA');
      return new Response(
        JSON.stringify({ error: 'Respuesta inesperada de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const propertyData = JSON.parse(toolCall.function.arguments);
    
    // Limpiar y normalizar textos
    const cleanText = (text: string) => text?.normalize('NFC').trim().replace(/[^\w\sáéíóúñÁÉÍÓÚÑüÜ,.-]/g, '') || '';
    
    // Calcular precio_m2 si no viene y tenemos datos
    let precio_m2 = propertyData.precio_m2;
    if (!precio_m2 && propertyData.precio && propertyData.metros && propertyData.metros > 0) {
      precio_m2 = Math.round((propertyData.precio / propertyData.metros) * 100) / 100;
    }
    
    // Construir el external_id: si la IA no lo extrae, intentar sacarlo de la URL
    let external_id = cleanText(propertyData.external_id) || '';
    if (!external_id) {
      // Fallback: extraer de la URL
      const urlMatch = url_propiedad.match(/\/(\d+)[-_]/) || url_propiedad.match(/ref[=:]?(\w+)/i);
      external_id = urlMatch ? urlMatch[1] : `${portal_origen}_${Date.now()}`;
    }
    
    const result = {
      // === CAMPOS REQUERIDOS POR LA TABLA propiedades ===
      
      // Identificadores (REQUIRED)
      external_id: external_id,
      portal_origen: portal_origen,
      
      // Básicos (REQUIRED)
      titulo: cleanText(propertyData.titulo) || 'Sin título',
      ubicacion: cleanText(propertyData.ubicacion) || `${propertyData.ciudad}, ${propertyData.provincia}`,
      tipo_propiedad: cleanText(propertyData.tipo_propiedad) || 'Otro',
      url: propertyData.url || url_propiedad,
      precio: propertyData.precio || 0,
      
      // Opcionales
      descripcion: propertyData.descripcion?.substring(0, 2000) || null,
      condition: cleanText(propertyData.condition) || null,
      metros: propertyData.metros || null,
      precio_m2: precio_m2 || null,
      dormitorios: propertyData.dormitorios || null,
      banos: propertyData.banos || null,
      ano_construccion: propertyData.ano_construccion || null,
      tiene_ascensor: propertyData.tiene_ascensor ?? null,
      tiene_parking: propertyData.tiene_parking ?? null,
      imagenes: Array.isArray(propertyData.imagenes) 
        ? propertyData.imagenes.slice(0, 10) 
        : [],
      fecha_publicacion: propertyData.fecha_publicacion || null,
      
      // === CAMPOS EXTRA PARA CLASIFICACIÓN (no en tabla) ===
      provincia: cleanText(propertyData.provincia) || 'Desconocida',
      ciudad: cleanText(propertyData.ciudad) || 'Desconocida',
      distrito: cleanText(propertyData.distrito) || ''
    };
    
    console.log('Propiedad extraída:', {
      titulo: result.titulo,
      ubicacion: `${result.provincia} > ${result.ciudad} > ${result.distrito}`,
      precio: result.precio,
      tipo: result.tipo_propiedad
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );

  } catch (error) {
    console.error('Error en classify-location:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
