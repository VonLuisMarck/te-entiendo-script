import { useEffect, useState } from "react";
import { workspace, type Notification } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PropertyDetails } from "./PropertyDetails";
export function NotificationInbox() {
  const [items, setItems] = useState<Notification[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [propertyId, setPropertyId] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void workspace
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) setError("No se pudieron cargar los avisos.");
        else {
          setItems(data ?? []);
          setError("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  async function open(n: Notification) {
    if (!n.read_at) {
      const { error } = await workspace
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
      if (error) {
        setError("No se pudo marcar el aviso como leído.");
        return;
      }
      setRevision((x) => x + 1);
    }
    setPropertyId(n.propiedad_id);
  }
  return (
    <section className="mb-6" aria-labelledby="inbox-title">
      <div className="flex justify-between gap-3 items-center mb-3">
        <h2 id="inbox-title" className="text-xl font-bold">
          Novedades de tu búsqueda
        </h2>
        <Button variant="ghost" onClick={() => setRevision((x) => x + 1)}>
          Actualizar avisos
        </Button>
      </div>
      {loading ? (
        <p role="status">Cargando avisos…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !items.length ? (
        <p className="text-sm text-muted-foreground">
          Aquí aparecerán candidatos nuevos y cambios relevantes cuando se
          actualicen tus resultados.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((n) => (
            <Card key={n.id}>
              <CardContent className="p-4">
                <button
                  className="w-full text-left space-y-1"
                  onClick={() => open(n)}
                >
                  <p className={n.read_at ? "font-medium" : "font-bold"}>
                    {!n.read_at && "● "}
                    {n.title}
                  </p>
                  <p className="text-sm">
                    {String(
                      (n.details as Record<string, unknown>)?.titulo ??
                        "Inmueble de tu búsqueda",
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("es-ES")}
                  </p>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PropertyDetails id={propertyId} onClose={() => setPropertyId(null)} />
    </section>
  );
}
