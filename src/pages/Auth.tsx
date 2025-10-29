import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email demasiado largo"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100, "Contraseña demasiado larga"),
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100, "Nombre demasiado largo").regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, "El nombre solo puede contener letras y espacios"),
});

const ERROR_MESSAGES: Record<string, string> = {
  'User already registered': 'Esta dirección de correo ya está en uso',
  'Invalid login credentials': 'Credenciales incorrectas',
  'Email rate limit exceeded': 'Demasiados intentos. Inténtalo más tarde',
  'Invalid email or password': 'Credenciales incorrectas',
  'Email not confirmed': 'Por favor confirma tu email',
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const validationData = isLogin 
        ? { email, password, nombre: "placeholder" }
        : { email, password, nombre };
      
      const validated = authSchema.parse(validationData);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password: validated.password,
        });

        if (error) throw error;
        toast.success("¡Bienvenido de vuelta!");
        navigate("/cliente/dashboard");
      } else {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            emailRedirectTo: `${window.location.origin}/cliente/dashboard`,
            data: {
              nombre: validated.nombre,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          const { error: clienteError } = await supabase
            .from("clientes")
            .insert({
              user_id: authData.user.id,
              nombre: validated.nombre,
              email: validated.email,
            });

          if (clienteError) throw clienteError;

          toast.success("¡Cuenta creada exitosamente!");
          navigate("/cliente/dashboard");
        }
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const userFriendlyError = ERROR_MESSAGES[error.message] || "Error en la autenticación. Por favor intenta de nuevo.";
        toast.error(userFriendlyError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Portal de Clientes</CardTitle>
          <CardDescription>
            {isLogin ? "Inicia sesión en tu cuenta de cliente" : "Crea tu cuenta de cliente"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Procesando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline block w-full"
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
            <div className="text-muted-foreground">
              ¿Eres empleado? <a href="/admin/auth" className="text-primary hover:underline">Accede al panel de administración</a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
