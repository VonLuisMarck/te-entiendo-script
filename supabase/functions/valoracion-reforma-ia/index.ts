import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValoracionRequest {
  clienteId: string;
  propiedadId: string;
  imagenesBase64: string[]; // Array de imágenes en base64
  datosPropiedad: {
    metros: number;
    precio: number;
    ubicacion: string;
    tipo: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY no configurada');
    }

    const requestData: ValoracionRequest = await req.json();
    console.log('[Valoración IA] Procesando solicitud:', {
      clienteId: requestData.clienteId,
      propiedadId: requestData.propiedadId,
      numImagenes: requestData.imagenesBase64.length,
    });

    // Obtener datos del cliente y propiedad
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre, email, telefono')
      .eq('id', requestData.clienteId)
      .single();

    const { data: propiedad } = await supabase
      .from('propiedades')
      .select('*')
      .eq('id', requestData.propiedadId)
      .single();

    if (!cliente || !propiedad) {
      throw new Error('Cliente o propiedad no encontrados');
    }

    // Construir prompt especializado de arquitectura
    const prompt = `
Eres un arquitecto experto en reformas integrales de viviendas en España. 
Analiza estas ${requestData.imagenesBase64.length} fotos de un piso y estima el coste de reforma integral.

DATOS DEL PISO:
- Superficie: ${requestData.datosPropiedad.metros}m²
- Ubicación: ${requestData.datosPropiedad.ubicacion}
- Tipo: ${requestData.datosPropiedad.tipo}
- Precio compra: ${requestData.datosPropiedad.precio.toLocaleString('es-ES')}€

CRITERIOS DE VALORACIÓN (precios mercado Madrid 2024):

1. COCINA COMPLETA:
   - Muebles bajos y altos nuevos: €3,000-5,000
   - Electrodomésticos (vitro, horno, campana, frigo, lava): €2,500-4,000
   - Encimera (granito/silestone): €800-1,500
   - Alicatado completo: €1,200-2,000
   - Fontanería y electricidad: €800-1,200
   → TOTAL COCINA: €8,000-12,000

2. BAÑOS:
   - Baño completo (sanitarios + mampara + alicatado + fontanería): €6,000-8,000
   - Dos baños: €12,000-16,000
   - Incluye: Inodoro, lavabo, ducha/bañera, mampara, grifería, alicatado suelo+paredes

3. SUELOS:
   - Tarima flotante AC4 (${requestData.datosPropiedad.metros}m²): €25-35/m² instalado
   - Porcelánico imitación madera (${requestData.datosPropiedad.metros}m²): €30-45/m²
   → TOTAL SUELOS: €2,000-3,500 (tarima) o €2,400-3,600 (porcelánico)

4. PINTURA COMPLETA:
   - Plástica lisa paredes + techos (${requestData.datosPropiedad.metros}m²): €15-20/m²
   - Incluye lijado, imprimación, 2 manos
   → TOTAL PINTURA: €2,500-3,500

5. INSTALACIONES:
   - Electricidad (revisar cuadro + puntos luz + enchufes): €2,000-3,000
   - Fontanería (tuberías, llaves paso): €1,000-2,000
   - Calefacción (si necesaria): €1,500-3,000

6. CARPINTERÍA:
   - Puertas interiores (6-8 puertas × €150-250): €900-2,000
   - Armarios empotrados (si necesarios): €800-1,500/m lineal

7. EXTRAS:
   - Licencias y permisos: €500-1,000
   - Gestión de residuos: €800-1,200
   - Imprevistos (10% del total): Siempre incluir

IMPORTANTE:
- Analiza el ESTADO ACTUAL visible en las fotos
- Si cocina/baños están MUY antiguos → Estima hacia límite superior
- Si solo necesitan actualización → Estima hacia límite inferior
- Identifica elementos que NO hay que tocar (ahorro)

DEVUELVE SOLO UN JSON CON ESTA ESTRUCTURA EXACTA (sin markdown, sin backticks):

{
  "coste_estimado_min": 25000,
  "coste_estimado_max": 35000,
  "confianza_estimacion": "alta|media|baja",
  "desglose": {
    "cocina": {
      "coste": 10000,
      "necesario": true,
      "descripcion": "Cocina muy antigua, requiere reforma completa"
    },
    "banos": {
      "coste": 14000,
      "necesario": true,
      "descripcion": "2 baños completos a reformar"
    },
    "suelos": {
      "coste": 3000,
      "necesario": true,
      "descripcion": "Tarima flotante en toda la vivienda"
    },
    "pintura": {
      "coste": 3000,
      "necesario": true,
      "descripcion": "Pintura completa paredes y techos"
    },
    "instalaciones": {
      "coste": 4000,
      "necesario": true,
      "descripcion": "Revisión electricidad y fontanería"
    },
    "otros": {
      "coste": 2000,
      "necesario": false,
      "descripcion": "Puertas interiores + licencias"
    }
  },
  "nivel_urgencia": "alto|medio|bajo",
  "observaciones": [
    "Cocina muy antigua, electrodomésticos de hace 20 años",
    "Baños funcionales pero anticuados",
    "Suelos en buen estado (parquet), considerar solo acuchillar",
    "Instalación eléctrica parece antigua, revisar cuadro"
  ],
  "elementos_conservar": [
    "Parquet del salón (solo acuchillar)",
    "Carpintería exterior (ventanas aluminio recientes)"
  ],
  "valor_post_reforma_estimado": 280000,
  "roi_cliente_estimado": 15.5
}`;

    // Llamar a OpenAI GPT-5 con visión
    console.log('[Valoración IA] Llamando a GPT-5 Vision...');
    
    const messages: any = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          ...requestData.imagenesBase64.map((img) => ({
            type: 'image_url',
            image_url: {
              url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
            },
          })),
        ],
      },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages,
        max_completion_tokens: 2000,
        // No incluir temperature para GPT-5
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Valoración IA] Error OpenAI:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('[Valoración IA] Respuesta recibida de GPT-5');

    // Parsear respuesta JSON
    let valoracion;
    try {
      const content = aiResponse.choices[0].message.content;
      // Limpiar markdown si lo incluye
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      valoracion = JSON.parse(jsonString);
    } catch (e) {
      console.error('[Valoración IA] Error parseando JSON:', e);
      throw new Error('Error procesando respuesta de IA');
    }

    // Calcular rentabilidad interna (para decidir si ofertar)
    const costeReal = valoracion.coste_estimado_min * 0.7; // 70% del precio al cliente
    const precioCliente = valoracion.coste_estimado_max;
    const margenEstudio = precioCliente - costeReal;
    const margenPorcentaje = (margenEstudio / costeReal) * 100;

    const inversionCliente = requestData.datosPropiedad.precio + precioCliente;
    const valorPostReforma = valoracion.valor_post_reforma_estimado;
    const roiCliente = ((valorPostReforma - inversionCliente) / inversionCliente) * 100;

    // Decisión automática: ¿Ofertar reforma?
    const ofertar = margenEstudio >= 8000 && roiCliente >= 12;

    console.log('[Valoración IA] Análisis rentabilidad:', {
      margenEstudio: `€${margenEstudio.toFixed(0)}`,
      margenPorcentaje: `${margenPorcentaje.toFixed(1)}%`,
      roiCliente: `${roiCliente.toFixed(1)}%`,
      ofertar,
    });

    // Guardar valoración en base de datos
    const { data: valoracionGuardada, error: errorGuardar } = await supabase
      .from('valoraciones_reforma')
      .insert({
        cliente_id: requestData.clienteId,
        propiedad_id: requestData.propiedadId,
        valoracion_ia: valoracion,
        coste_min: valoracion.coste_estimado_min,
        coste_max: valoracion.coste_estimado_max,
        margen_estudio: margenEstudio,
        roi_cliente: roiCliente,
        ofertar: ofertar,
        estado: ofertar ? 'pendiente_contacto' : 'descartada',
      })
      .select()
      .single();

    if (errorGuardar) {
      console.error('[Valoración IA] Error guardando valoración:', errorGuardar);
      // No fallar la request, solo loguear
    }

    // Si no es rentable, devolver respuesta educada
    if (!ofertar) {
      return new Response(
        JSON.stringify({
          success: true,
          ofertar: false,
          mensaje: 'Valoración completada. En este momento, dado el estado actual de la propiedad y el mercado, no recomendamos una reforma integral. Te sugerimos esperar o considerar una actualización parcial.',
          valoracion_parcial: {
            rango: `€${valoracion.coste_estimado_min.toLocaleString('es-ES')} - €${valoracion.coste_estimado_max.toLocaleString('es-ES')}`,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Si es rentable, devolver valoración completa
    return new Response(
      JSON.stringify({
        success: true,
        ofertar: true,
        valoracion: {
          ...valoracion,
          id_valoracion: valoracionGuardada?.id,
        },
        analisis_financiero: {
          coste_reforma: `€${valoracion.coste_estimado_min.toLocaleString('es-ES')} - €${valoracion.coste_estimado_max.toLocaleString('es-ES')}`,
          inversion_total: `€${inversionCliente.toLocaleString('es-ES')}`,
          valor_post_reforma: `€${valorPostReforma.toLocaleString('es-ES')}`,
          roi_estimado: `${roiCliente.toFixed(1)}%`,
        },
        siguiente_paso: 'Te contactaremos en 24-48h para agendar visita presencial y presupuesto definitivo.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Valoración IA] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
