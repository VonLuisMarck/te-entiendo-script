import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  workspace,
  downloadJson,
  type NotificationPreferences,
} from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
export function AccountTools() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Partial<NotificationPreferences>>({
      enabled: true,
      email_enabled: false,
      frequency: "daily",
      timezone: "Europe/Madrid",
      quiet_start: 22,
      quiet_end: 8,
      paused_until: null,
    }),
    [shares, setShares] = useState<
      { id: string; expires_at: string; revoked: boolean }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await workspace
        .from("notification_preferences")
        .select("*")
        .maybeSingle();
      const s = await workspace
        .from("shared_selections")
        .select("id,expires_at,revoked")
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (p.error || s.error) {
        setError("No se pudieron cargar las preferencias.");
        return;
      }
      if (p.data) setPrefs(p.data);
      setShares(s.data ?? []);
      setError("");
    })();
    return () => {
      cancelled = true;
    };
  }, [revision]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se completó la operación");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    await action(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Inicia sesión");
      const { error } = await workspace
        .from("notification_preferences")
        .upsert({ ...prefs, user_id: user.id });
      if (error) throw new Error("Revisa la zona horaria y el horario.");
      toast.success("Preferencias guardadas");
    });
  }
  async function revoke(id: string) {
    await action(async () => {
      const r = await workspace
        .from("shared_selections")
        .update({ revoked: true })
        .eq("id", id)
        .select("id");
      if (r.error || !r.data?.length)
        throw new Error("No se pudo revocar el enlace");
      setRevision((n) => n + 1);
    });
  }
  async function remove() {
    await action(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Inicia sesión");
      const auth = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (auth.error) throw new Error("No se pudo verificar la contraseña");
      setPassword("");
      const result = await supabase.functions.invoke("account-delete", {
        body: { confirmation },
      });
      if (result.error) {
        let msg = "No se completó la eliminación";
        if (result.error.context instanceof Response) {
          const value = await result.error.context.json().catch(() => null);
          msg = value?.error ?? msg;
        }
        throw new Error(msg);
      }
      await supabase.auth.signOut({ scope: "local" });
      navigate("/auth");
    });
  }
  return (
    <div className="space-y-6 mt-6">
      {error && (
        <p role="alert" className="border rounded p-3">
          {error}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Avisos y horarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, enabled: e.target.checked }))
              }
            />
            Activar avisos nuevos
          </Label>
          <Label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, email_enabled: e.target.checked }))
              }
            />
            Recibir también por email cuando el servicio esté disponible
          </Label>
          <div>
            <Label htmlFor="notification-frequency">Frecuencia de email</Label>
            <select
              className="block border rounded bg-background w-full p-2"
              id="notification-frequency"
              value={prefs.frequency}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, frequency: e.target.value }))
              }
            >
              <option value="daily">Resumen diario</option>
              <option value="instant">Novedades, como máximo cada hora</option>
              <option value="none">Sin avisos</option>
            </select>
          </div>
          <div>
            <Label htmlFor="notification-zone">Zona horaria</Label>
            <Input
              id="notification-zone"
              value={prefs.timezone}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, timezone: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["quiet_start", "quiet_end"] as const).map((key, i) => (
              <div key={key}>
                <Label htmlFor={key}>
                  {i ? "Fin del silencio (hora)" : "Inicio del silencio (hora)"}
                </Label>
                <Input
                  id={key}
                  type="number"
                  min="0"
                  max="23"
                  value={prefs[key]}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, [key]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy}>
              Guardar avisos
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setPrefs((p) => ({
                  ...p,
                  paused_until: new Date(
                    Date.now() + 7 * 86400000,
                  ).toISOString(),
                }))
              }
            >
              Pausar 7 días
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPrefs((p) => ({ ...p, paused_until: null }))}
            >
              Quitar pausa
            </Button>
          </div>
          {prefs.paused_until && (
            <p className="text-sm">
              Pausa hasta {new Date(prefs.paused_until).toLocaleString("es-ES")}
              . Guarda para aplicar.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tus datos y enlaces compartidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const { data, error } = await workspace.rpc(
                  "export_my_workspace",
                );
                if (error)
                  throw new Error("No se pudo exportar tu información");
                downloadJson("mis-datos-findoo.json", data);
              })
            }
          >
            Exportar mi información
          </Button>
          <p className="text-sm text-muted-foreground">
            Incluye búsquedas, favoritos, notas, escenarios y avisos.
          </p>
          {shares
            .filter((s) => !s.revoked)
            .map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap justify-between gap-2 border-t pt-3"
              >
                <p className="text-sm">
                  Selección · caduca{" "}
                  {new Date(s.expires_at).toLocaleDateString("es-ES")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revoke(s.id)}
                  disabled={busy}
                >
                  Revocar enlace
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sesiones y eliminación de cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() =>
              action(async () => {
                const { error } = await supabase.auth.signOut({
                  scope: "global",
                });
                if (error)
                  throw new Error("No se pudieron cerrar las sesiones");
                navigate("/auth");
              })
            }
          >
            Cerrar todas mis sesiones
          </Button>
          <p className="text-sm text-muted-foreground">
            Se revocan las sesiones de renovación. Los accesos ya emitidos
            caducan según la configuración del servicio.
          </p>
          <p className="text-sm">
            Eliminar la cuenta borra tu espacio personal y revoca las
            selecciones compartidas. Si tienes una suscripción activa, gestiona
            primero su cancelación.
          </p>
          <Label htmlFor="delete-confirmation">Escribe ELIMINAR</Label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
          <Label htmlFor="delete-password">Confirma tu contraseña</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            variant="destructive"
            onClick={remove}
            disabled={busy || confirmation !== "ELIMINAR" || !password}
          >
            Eliminar mi cuenta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
