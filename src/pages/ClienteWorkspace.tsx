import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { workspace, money, type Decision } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PropertyDetails,
  stages,
  type Listing,
} from "@/components/PropertyDetails";
export default function ClienteWorkspace() {
  const [rows, setRows] = useState<
      { decision: Decision; listing: Listing | null }[]
    >([]),
    [stage, setStage] = useState("all"),
    [id, setId] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      const d = await workspace
        .from("property_decisions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(501);
      if (d.error) throw d.error;
      if (d.data.length > 500)
        throw new Error(
          "El seguimiento supera el límite de esta vista. Exporta tu cuenta para consultar todos los registros.",
        );
      const p = d.data.length
        ? await supabase
            .from("propiedades")
            .select("*")
            .in(
              "id",
              d.data.map((x) => x.propiedad_id),
            )
        : { data: [], error: null };
      if (p.error) throw p.error;
      if (!cancelled)
        setRows(
          d.data.map((decision) => ({
            decision,
            listing:
              (p.data?.find(
                (x) => x.id === decision.propiedad_id,
              ) as Listing) ?? null,
          })),
        );
    })()
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar tu seguimiento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8 space-y-6">
      <Button variant="outline" asChild>
        <Link to="/cliente/dashboard">Volver a mis inmuebles</Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold">Mi seguimiento</h1>
        <p className="text-muted-foreground">
          Candidatos, notas y próximas visitas.
        </p>
      </div>
      <div
        className="flex gap-2 flex-wrap"
        role="group"
        aria-label="Filtrar por estado"
      >
        {[["all", "Todos"], ...Object.entries(stages)].map(([key, label]) => (
          <Button
            key={key}
            variant={stage === key ? "default" : "outline"}
            aria-pressed={stage === key}
            onClick={() => setStage(key)}
          >
            {label} (
            {
              rows.filter((r) => key === "all" || r.decision.stage === key)
                .length
            }
            )
          </Button>
        ))}
      </div>
      {loading ? (
        <p role="status">Cargando seguimiento…</p>
      ) : error ? (
        <div role="alert">
          {error}
          <Button onClick={() => setRevision((n) => n + 1)}>Reintentar</Button>
        </div>
      ) : !rows.length ? (
        <p>Abre la ficha de un inmueble y guarda su estado para empezar.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows
            .filter((r) => stage === "all" || r.decision.stage === stage)
            .map(({ decision: d, listing: p }) => (
              <Card key={d.propiedad_id}>
                <CardContent className="p-5 space-y-3">
                  <span className="text-xs font-medium">{stages[d.stage]}</span>
                  <h2 className="font-semibold">
                    {p?.titulo ?? "Anuncio no disponible"}
                  </h2>
                  <p>{money(p?.precio)}</p>
                  {d.visit_at && (
                    <p className="text-sm">
                      Visita: {new Date(d.visit_at).toLocaleString("es-ES")}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-line line-clamp-4">
                    {d.note}
                  </p>
                  {d.reason && (
                    <p className="text-sm text-muted-foreground">
                      Motivo: {d.reason}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    disabled={!p}
                    onClick={() => setId(d.propiedad_id)}
                  >
                    Abrir seguimiento
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
      <PropertyDetails
        id={id}
        onClose={() => {
          setId(null);
          setRevision((n) => n + 1);
        }}
      />
    </main>
  );
}
