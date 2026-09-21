import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function PasswordRecovery() {
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-md p-6 pt-16 space-y-5">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (password !== confirmation || password.length < 12)
              throw new Error(
                "Usa al menos 12 caracteres y repite la misma contraseña.",
              );
            const r = await supabase.auth.updateUser({ password });
            if (r.error)
              throw new Error(
                "El enlace ha caducado o no es válido. Solicita otro desde el acceso.",
              );
            await supabase.auth.signOut({ scope: "global" });
            navigate("/auth");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Label htmlFor="recovery-password">Nueva contraseña</Label>
        <Input
          id="recovery-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Label htmlFor="recovery-confirmation">Repite la contraseña</Label>
        <Input
          id="recovery-confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy} type="submit">
          Guardar nueva contraseña
        </Button>
      </form>
      <Link className="underline" to="/auth">
        Volver al acceso
      </Link>
    </main>
  );
}
