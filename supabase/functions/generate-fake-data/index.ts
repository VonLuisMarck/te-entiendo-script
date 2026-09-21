import { authorize } from "../_shared/security.ts";
import { createClient } from '@supabase/supabase-js';
import { z } from "zod";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FakeDataRequestSchema = z.object({
  cantidad: z.number().int().min(1).max(500).optional(),
  ciudades: z.array(z.string().min(2).max(50)).max(20).optional(),
});

Deno.serve(async (req) => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const requestBody = await req.json();
    const body = FakeDataRequestSchema.parse(requestBody);
    const cantidad = body.cantidad || 50;
    const ciudades = body.ciudades || [
      'Madrid',
      'Barcelona',
      'Valencia',
      'Sevilla',
      'Málaga',
      'Bilbao',
      'Zaragoza',
      'Alicante'
    ];

    console.log(`Generando ${cantidad} propiedades fake...`);

    const barrios: Record<string, string[]> = {
      Madrid: ['Salamanca', 'Chamberí', 'Retiro', 'Chamartín', 'Centro', 'Arganzuela', 'Tetuán'],
      Barcelona: ['Eixample', 'Gràcia', 'Sants', 'Sant Martí', 'Les Corts', 'Ciutat Vella'],
      Valencia: ['Ruzafa', 'El Carmen', 'Mestalla', 'Benimaclet', 'Campanar', 'Poblats Marítims'],
      Sevilla: ['Triana', 'Nervión', 'Los Remedios', 'Macarena', 'Centro', 'Sur'],
      Málaga: ['Centro', 'Pedregalejo', 'Huelin', 'Carretera de Cádiz', 'Teatinos'],
      Bilbao: ['Abando', 'Deusto', 'Indautxu', 'Rekalde', 'Basurto'],
      Zaragoza: ['Centro', 'Universidad', 'Delicias', 'Romareda', 'Actur'],
      Alicante: ['Centro', 'Playa San Juan', 'Albufereta', 'San Blas', 'Carolinas']
    };

    const tiposPropiedad = ['piso', 'chalet', 'estudio', 'dúplex', 'ático'];
    const condiciones = ['nuevo', 'buen estado', 'a reformar', 'reformado'];

    const propiedades = [];

    for (let i = 0; i < cantidad; i++) {
      const ciudad = ciudades[Math.floor(Math.random() * ciudades.length)];
      const barriosDisponibles = barrios[ciudad] || ['Centro'];
      const barrio = barriosDisponibles[Math.floor(Math.random() * barriosDisponibles.length)];
      const tipoPropiedad = tiposPropiedad[Math.floor(Math.random() * tiposPropiedad.length)];
      const condition = condiciones[Math.floor(Math.random() * condiciones.length)];

      // Generar precios realistas según tipo y ciudad
      let precioBase = 200000;
      if (ciudad === 'Madrid' || ciudad === 'Barcelona') precioBase = 350000;
      if (ciudad === 'Valencia' || ciudad === 'Málaga') precioBase = 250000;
      
      if (tipoPropiedad === 'chalet') precioBase *= 1.8;
      if (tipoPropiedad === 'ático') precioBase *= 1.3;
      if (tipoPropiedad === 'estudio') precioBase *= 0.5;

      const variacion = 0.7 + Math.random() * 0.6; // variación de ±30%
      const precio = Math.round(precioBase * variacion);

      // Metros según tipo
      let metrosBase = 80;
      if (tipoPropiedad === 'chalet') metrosBase = 180;
      if (tipoPropiedad === 'ático') metrosBase = 100;
      if (tipoPropiedad === 'estudio') metrosBase = 45;

      const metros = Math.round(metrosBase + (Math.random() * 40 - 20));
      const precio_m2 = Math.round(precio / metros);

      // Dormitorios según tipo y metros
      let dormitorios = 2;
      if (tipoPropiedad === 'estudio') dormitorios = 1;
      if (tipoPropiedad === 'chalet') dormitorios = Math.floor(Math.random() * 2) + 3; // 3-4
      if (metros > 100 && tipoPropiedad !== 'estudio') dormitorios = 3;

      const banos = Math.max(1, Math.floor(dormitorios / 2));

      const propiedad = {
        external_id: `fake_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`,
        portal_origen: 'fake_data',
        titulo: `${tipoPropiedad.charAt(0).toUpperCase() + tipoPropiedad.slice(1)} en ${barrio}, ${ciudad}`,
        descripcion: `${tipoPropiedad.charAt(0).toUpperCase() + tipoPropiedad.slice(1)} de ${metros}m² en zona ${barrio}. ${condition.charAt(0).toUpperCase() + condition.slice(1)}. ${dormitorios} dormitorios, ${banos} baño${banos > 1 ? 's' : ''}.`,
        ubicacion: `${ciudad}, ${barrio}`,
        tipo_propiedad: tipoPropiedad,
        precio,
        metros,
        precio_m2,
        dormitorios,
        banos,
        condition,
        ano_construccion: condition === 'nuevo' ? 2023 : Math.floor(Math.random() * 40) + 1980,
        tiene_ascensor: Math.random() > 0.4,
        tiene_parking: Math.random() > 0.5,
        url: `https://fake-portal.com/propiedad/${i}`,
        imagenes: [`https://placeholder.com/800x600?text=${tipoPropiedad}`],
        fecha_scraping: new Date().toISOString(),
        fecha_publicacion: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        activo: true
      };

      propiedades.push(propiedad);
    }

    console.log('Insertando propiedades en la base de datos...');

    const { data, error } = await supabase
      .from('propiedades')
      .insert(propiedades)
      .select();

    if (error) {
      console.error('Error al insertar propiedades:', error);
      throw error;
    }

    console.log(`${propiedades.length} propiedades fake creadas exitosamente`);

    // Resumen por ciudad
    const resumenCiudades = propiedades.reduce((acc, p) => {
      const ciudad = p.ubicacion.split(',')[0];
      acc[ciudad] = (acc[ciudad] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${propiedades.length} propiedades fake generadas exitosamente`,
        propiedades_creadas: propiedades.length,
        resumen_ciudades: resumenCiudades,
        precio_medio: Math.round(propiedades.reduce((sum, p) => sum + p.precio, 0) / propiedades.length),
        metros_medio: Math.round(propiedades.reduce((sum, p) => sum + p.metros, 0) / propiedades.length)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating fake data:', error.message);
    
    const status = error.message?.includes('Unauthorized') ? 403 : 
                   error.issues ? 400 : 500;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.issues ? 'Invalid request data' : 'Failed to generate fake data',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      }
    );
  }
});

