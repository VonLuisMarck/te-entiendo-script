import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar que se proporcione una clave de inicialización
    const { initKey } = await req.json().catch(() => ({}));
    
    // Clave de inicialización simple para esta función one-time
    if (initKey !== "initialize-first-admin-2024") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Clave de inicialización inválida" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verificar si ya existe un admin
    const { data: existingAdmin, error: checkError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existingAdmin && existingAdmin.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Ya existe un usuario administrador. Esta función solo puede ejecutarse una vez." 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    // Crear usuario admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: "admin@admin.com",
      password: "adminadmin",
      email_confirm: true,
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error("No se pudo crear el usuario");
    }

    // Asignar rol de admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "admin",
      });

    if (roleError) {
      // Si falla la asignación de rol, eliminar el usuario creado
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Usuario administrador creado exitosamente",
        email: "admin@admin.com",
        user_id: authData.user.id
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Error al inicializar admin:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
