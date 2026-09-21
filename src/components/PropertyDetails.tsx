import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { workspace, money, safeHref, type Decision } from "@/lib/workspace";
import { InvestmentCalculator } from "./InvestmentCalculator";
import type { Json } from "@/integrations/supabase/types";
export type Listing = {
  id: string;
  titulo: string;
  precio: number;
  ubicacion: string;
  metros: number | null;
  dormitorios: number | null;
  banos: number | null;
  url: string;
  imagenes: string[] | null;
  last_seen: string | null;
  portal_origen: string;
  activo: boolean;
  descripcion?: string | null;
  tiene_ascensor?: boolean | null;
  tiene_parking?: boolean | null;
  tipo_propiedad?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_precision?: string;
  availability?: string;
  evidence?: Record<string, any>;
  first_observed_at?: string;
  data_version?: number;
  canonical_id?: string;
};
export const stages: Record<string, string> = {
  new: "Nuevo",
  saved: "Guardado",
  review: "Por revisar",
  contact: "Contactar",
  visit: "Visita prevista",
  discarded: "Descartado",
  closed: "Cerrado",
};
export function PropertyDetails({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null),
    [history, setHistory] = useState<
      { version: number; observed_at: string; facts: Json }[]
    >([]),
    [decision, setDecision] = useState<Partial<Decision>>({
      stage: "review",
      note: "",
      reason: "",
      visit_at: null,
    }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [tab, setTab] = useState("facts"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setListing(null);
    setError("");
    setTab("facts");
    setDecision({ stage: "review", note: "", reason: "", visit_at: null });
    void (async () => {
      const [property, observations, saved] = await Promise.all([
        supabase.from("propiedades").select("*").eq("id", id).single(),
        workspace
          .from("listing_observations")
          .select("version,observed_at,facts")
          .eq("propiedad_id", id)
          .order("version", { ascending: false })
          .limit(100),
        workspace
          .from("property_decisions")
          .select("*")
          .eq("propiedad_id", id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (property.error || observations.error || saved.error) {
        setError("No se pudo cargar la ficha completa.");
        return;
      }
      setListing(property.data as Listing);
      setHistory(observations.data ?? []);
      if (saved.data) setDecision(saved.data);
    })().catch(() => {
      if (!cancelled) setError("No se pudo cargar la ficha.");
    });
    return () => {
      cancelled = true;
    };
  }, [id, retry]);
  async function saveDecision() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !id) throw new Error();
      const { error } = await workspace
        .from("property_decisions")
        .upsert(
          { ...decision, user_id: user.id, propiedad_id: id },
          { onConflict: "user_id,propiedad_id" },
        );
      if (error) throw error;
      toast.success("Seguimiento guardado");
    } catch {
      toast.error("No se guardaron los cambios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }
  const bool = (value: unknown) =>
    value === true ? "Sí" : value === false ? "No" : "Sin datos";
  return (
    <Dialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{listing?.titulo ?? "Ficha del inmueble"}</DialogTitle>
          <DialogDescription>
            {listing?.ubicacion ?? "Datos, historial y seguimiento personal."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <Button onClick={() => setRetry((n) => n + 1)}>Reintentar</Button>
          </div>
        ) : !listing ? (
          <p role="status">Cargando ficha…</p>
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Secciones de la ficha"
            >
              {[
                ["facts", "Datos e historial"],
                ["decision", "Mi seguimiento"],
                ["investment", "Inversión"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  variant={tab === value ? "default" : "outline"}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {tab === "facts" && (
              <div className="space-y-5">
                <p className="text-2xl font-bold">{money(listing.precio)}</p>
                {(!listing.activo ||
                  listing.availability === "not_seen_recently" ||
                  (listing.last_seen &&
                    Date.parse(listing.last_seen) <
                      Date.now() - 7 * 86400000)) && (
                  <p className="border rounded p-3">
                    Este anuncio necesita una nueva revisión. Su retirada no
                    confirma una venta.
                  </p>
                )}
                <div className="flex gap-2 overflow-x-auto">
                  {listing.imagenes
                    ?.map(safeHref)
                    .filter(Boolean)
                    .map((src, i) => (
                      <img
                        key={src}
                        src={src}
                        alt={`Foto ${i + 1} del anuncio`}
                        className="w-60 h-44 rounded object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    [
                      "Superficie",
                      listing.metros == null
                        ? "Sin datos"
                        : `${listing.metros} m²`,
                    ],
                    ["Dormitorios", listing.dormitorios ?? "Sin datos"],
                    ["Baños", listing.banos ?? "Sin datos"],
                    ["Ascensor", bool(listing.tiene_ascensor)],
                    ["Parking", bool(listing.tiene_parking)],
                    ["Fuente", listing.portal_origen],
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="whitespace-pre-line text-sm">
                  {listing.descripcion ?? "Descripción no disponible."}
                </p>
                <section className="rounded border p-4 space-y-2">
                  <h3 className="font-semibold">Procedencia de los datos</h3>
                  <p className="text-sm">
                    Observado:{" "}
                    {listing.last_seen
                      ? new Date(listing.last_seen).toLocaleString("es-ES")
                      : "sin fecha"}{" "}
                    · Publicación: no confirmada
                  </p>
                  <p className="text-sm">
                    Ubicación:{" "}
                    {listing.location_precision === "exact"
                      ? "coordenadas declaradas como exactas por la fuente"
                      : listing.location_precision === "approximate"
                        ? "aproximada"
                        : "precisión sin confirmar"}
                    . Confirma dirección y disponibilidad antes de visitar.
                  </p>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Ver evidencia por campo
                    </summary>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs mt-3">
                        <thead>
                          <tr>
                            <th className="text-left">Dato</th>
                            <th className="text-left">Campo en la fuente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            "precio",
                            "metros",
                            "dormitorios",
                            "banos",
                            "ciudad",
                          ].map((key) => (
                            <tr key={key}>
                              <td className="p-2">{key}</td>
                              <td className="p-2">
                                {String(
                                  listing.evidence?.fields?.[key] ??
                                    "No documentado en esta versión",
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs mt-2">
                      Versión de lectura:{" "}
                      {listing.evidence?.adapter_version ?? "histórica"} · Datos
                      v{listing.data_version ?? 1}
                    </p>
                  </details>
                </section>
                <section>
                  <h3 className="font-semibold mb-2">
                    Historial de observaciones
                  </h3>
                  {!history.length ? (
                    <p className="text-sm text-muted-foreground">
                      Todavía no hay historial registrado.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left p-2">Observación</th>
                            <th className="text-right p-2">Precio anunciado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.version} className="border-t">
                              <td className="p-2">
                                {new Date(h.observed_at).toLocaleString(
                                  "es-ES",
                                )}{" "}
                                · v{h.version}
                              </td>
                              <td className="text-right p-2">
                                {money((h.facts as { precio: number }).precio)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                {safeHref(listing.url) && (
                  <Button asChild variant="outline">
                    <a
                      href={safeHref(listing.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir anuncio original
                    </a>
                  </Button>
                )}
              </div>
            )}
            {tab === "decision" && (
              <section className="space-y-4">
                <h3 className="text-xl font-semibold">Mi seguimiento</h3>
                <p className="text-sm text-muted-foreground">
                  Tus notas y motivos son privados.
                </p>
                <div>
                  <Label htmlFor="decision-stage">Estado</Label>
                  <select
                    id="decision-stage"
                    className="block w-full border rounded p-2 bg-background"
                    value={decision.stage}
                    onChange={(e) =>
                      setDecision((d) => ({ ...d, stage: e.target.value }))
                    }
                  >
                    {Object.entries(stages).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="decision-note">
                    Notas y preguntas para la visita
                  </Label>
                  <Textarea
                    id="decision-note"
                    maxLength={10000}
                    value={decision.note}
                    onChange={(e) =>
                      setDecision((d) => ({ ...d, note: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="decision-reason">Motivo de la decisión</Label>
                  <Input
                    id="decision-reason"
                    maxLength={1000}
                    value={decision.reason}
                    onChange={(e) =>
                      setDecision((d) => ({ ...d, reason: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="decision-visit">Fecha y hora de visita</Label>
                  <Input
                    id="decision-visit"
                    type="datetime-local"
                    value={
                      decision.visit_at
                        ? new Date(
                            new Date(decision.visit_at).getTime() -
                              new Date(decision.visit_at).getTimezoneOffset() *
                                60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setDecision((d) => ({
                        ...d,
                        visit_at: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      }))
                    }
                  />
                </div>
                <Button onClick={saveDecision} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar seguimiento"}
                </Button>
              </section>
            )}
            {tab === "investment" && (
              <InvestmentCalculator
                key={listing.id}
                propertyId={listing.id}
                price={listing.precio}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
