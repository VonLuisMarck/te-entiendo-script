import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspace, money } from "@/lib/workspace";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface Metrics {
  matching_queue: number;
  raw_pending: number;
  raw_review: number;
  active_searches: number;
  weekly_relevant_opportunities: number;
  weekly_observed_listings: number;
  email_outcomes: Record<string, number>;
  cost_entries: {
    id: string;
    period_start: string;
    period_end: string;
    category: string;
    amount_eur: number;
    basis: string;
    reference: string;
  }[];
}
export function OperatingMetrics() {
  const cache = useQueryClient(),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const metrics = useQuery({
    queryKey: ["operating-metrics"],
    queryFn: async () => {
      const r = await workspace.rpc("operating_metrics");
      if (r.error) throw r.error;
      return r.data as unknown as Metrics;
    },
    refetchInterval: 30000,
    retry: false,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos, valor y costes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.isPending ? (
          <p role="status">Cargando métricas…</p>
        ) : metrics.error ? (
          <p role="alert">No se pudieron cargar las métricas de operación.</p>
        ) : (
          metrics.data && (
            <>
              <dl className="grid sm:grid-cols-3 gap-4">
                {[
                  ["Búsquedas activas", metrics.data.active_searches],
                  ["Recalculos pendientes", metrics.data.matching_queue],
                  ["Anuncios por normalizar", metrics.data.raw_pending],
                  ["Anuncios en revisión", metrics.data.raw_review],
                  [
                    "Candidatos valorados útiles esta semana",
                    metrics.data.weekly_relevant_opportunities,
                  ],
                  [
                    "Anuncios observados esta semana",
                    metrics.data.weekly_observed_listings,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                “Útiles” recoge la última valoración del usuario en los últimos
                7 días. Búsquedas activas significa perfiles habilitados con
                criterios; no mide visitas a la aplicación.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="text-left font-semibold my-2">
                    Costes registrados
                  </caption>
                  <thead>
                    <tr>
                      <th className="p-2 text-left">Periodo</th>
                      <th className="p-2 text-left">Concepto</th>
                      <th className="p-2 text-left">Base</th>
                      <th className="p-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.data.cost_entries.map((c) => (
                      <tr className="border-t" key={c.id}>
                        <td className="p-2">
                          {c.period_start} / {c.period_end}
                        </td>
                        <td className="p-2">
                          {c.category} · {c.reference}
                        </td>
                        <td className="p-2">
                          {c.basis === "invoice"
                            ? "Factura"
                            : c.basis === "measured"
                              ? "Medido"
                              : "Estimado"}
                        </td>
                        <td className="p-2 text-right">
                          {money(c.amount_eur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!metrics.data.cost_entries.length && (
                  <p className="text-sm text-muted-foreground">
                    Sin costes registrados. No se presupone coste cero.
                  </p>
                )}
              </div>
            </>
          )
        )}
        <details>
          <summary className="cursor-pointer font-medium">
            Registrar un coste
          </summary>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              const form = e.currentTarget,
                values = new FormData(form);
              try {
                const { error } = await workspace
                  .from("operating_cost_entries")
                  .insert({
                    period_start: String(values.get("start")),
                    period_end: String(values.get("end")),
                    category: String(values.get("category")),
                    basis: String(values.get("basis")),
                    amount_eur: Number(values.get("amount")),
                    reference: String(values.get("reference")),
                  });
                if (error) throw error;
                form.reset();
                await cache.invalidateQueries({
                  queryKey: ["operating-metrics"],
                });
              } catch {
                setError("No se guardó el coste. Revisa fechas e importe.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cost-start">Desde</Label>
                <Input id="cost-start" type="date" name="start" required />
              </div>
              <div>
                <Label htmlFor="cost-end">Hasta</Label>
                <Input id="cost-end" type="date" name="end" required />
              </div>
              <div>
                <Label htmlFor="cost-category">Categoría</Label>
                <select
                  id="cost-category"
                  name="category"
                  className="w-full border rounded p-2 bg-background"
                >
                  {[
                    "infrastructure",
                    "browser",
                    "database",
                    "email",
                    "ai",
                    "support",
                    "other",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cost-basis">Tipo de dato</Label>
                <select
                  id="cost-basis"
                  name="basis"
                  className="w-full border rounded p-2 bg-background"
                >
                  <option value="invoice">Factura</option>
                  <option value="measured">Medido</option>
                  <option value="estimate">Estimado</option>
                </select>
              </div>
              <div>
                <Label htmlFor="cost-amount">Importe (€)</Label>
                <Input
                  id="cost-amount"
                  name="amount"
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cost-reference">
                  Referencia de la evidencia
                </Label>
                <Input
                  id="cost-reference"
                  name="reference"
                  maxLength={500}
                  required
                />
              </div>
            </div>
            <Button disabled={saving}>Guardar coste</Button>
            {error && <p role="alert">{error}</p>}
          </form>
        </details>
      </CardContent>
    </Card>
  );
}
