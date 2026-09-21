import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { workspace, money, downloadJson } from "@/lib/workspace";
import {
  calculateInvestment,
  investmentFields,
  investmentSensitivity,
  type InvestmentInputs,
} from "../../supabase/functions/_shared/investment";
import type { Json } from "@/integrations/supabase/types";

export function InvestmentCalculator({
  propertyId,
  price,
}: {
  propertyId: string;
  price: number;
}) {
  const [values, setValues] = useState<Record<string, string>>({
      purchase: String(price),
    }),
    [name, setName] = useState("Mi escenario"),
    [saving, setSaving] = useState(false),
    [savedId, setSavedId] = useState<string | null>(null),
    [version, setVersion] = useState<number | null>(null);
  const [error, setError] = useState("");
  const complete = Object.keys(investmentFields).every((key) =>
    values[key]?.trim(),
  );
  const inputs = Object.fromEntries(
    Object.keys(investmentFields).map((key) => [key, Number(values[key])]),
  ) as InvestmentInputs;
  let result: ReturnType<typeof calculateInvestment> | null = null,
    calculationError = "";
  if (complete)
    try {
      result = calculateInvestment(inputs);
    } catch (e) {
      calculationError = (e as Error).message;
    }
  async function save() {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Inicia sesión");
      const payload = {
        name: name.trim(),
        user_id: user.id,
        propiedad_id: propertyId,
        inputs: {
          ...inputs,
          _provenance: {
            purchase: values.purchase === String(price) ? "listing" : "user",
            other_fields: "user",
          },
          _formula_version: result.version,
        } as Json,
      };
      const q = savedId
        ? workspace
            .from("investment_scenarios")
            .update(payload)
            .eq("id", savedId)
            .eq("version", version!)
        : workspace.from("investment_scenarios").insert(payload);
      const { data, error } = await q.select("id,version").single();
      if (error || !data)
        throw new Error("No se guardó. Comprueba si cambió en otra sesión.");
      setSavedId(data.id);
      setVersion(data.version);
      toast.success(`Escenario guardado · versión ${data.version}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function restore() {
    const { data, error } = await workspace
      .from("investment_scenarios")
      .select("*")
      .eq("propiedad_id", propertyId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setError("No se pudo recuperar el escenario");
      return;
    }
    if (!data) {
      toast("Aún no hay un escenario guardado");
      return;
    }
    const x = data.inputs as Record<string, Json>;
    setValues(
      Object.fromEntries(
        Object.keys(investmentFields).map((k) => [
          k,
          x[k] == null ? "" : String(x[k]),
        ]),
      ),
    );
    setSavedId(data.id);
    setVersion(data.version);
    setName(data.name);
  }
  return (
    <section className="space-y-4" aria-labelledby="investment-title">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="text-xl font-semibold" id="investment-title">
          Escenario de inversión
        </h3>
        <Button variant="outline" onClick={restore}>
          Recuperar guardado
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        El precio procede del anuncio. Completa el resto con tus supuestos;
        escribe 0 donde no haya coste. La renta no es una estimación de mercado.
        Incluye impuestos y gastos de tu caso en adquisición.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {Object.entries(investmentFields).map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`inv-${key}`}>{label}</Label>
            <Input
              id={`inv-${key}`}
              type="number"
              min="0"
              step="any"
              value={values[key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      {!complete && (
        <p className="text-sm">
          Completa las entradas para calcular. Los campos vacíos son
          desconocidos.
        </p>
      )}
      {calculationError && <p role="alert">{calculationError}</p>}
      {result && (
        <>
          <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4">
            {[
              ["Inversión total", money(result.totalInvestment)],
              ["Capital propio", money(result.equity)],
              ["Cuota mensual", money(result.monthlyDebt)],
              [
                "Flujo anual antes de impuestos personales",
                money(result.cashflow),
              ],
              [
                "Bruta sobre precio",
                `${result.grossYieldOnPrice.toFixed(2)} %`,
              ],
              [
                "Neta operativa sobre coste total",
                `${result.netYieldOnTotalCost.toFixed(2)} %`,
              ],
              [
                "Flujo sobre capital propio",
                result.cashOnCash === null
                  ? "No definido"
                  : `${result.cashOnCash.toFixed(2)} %`,
              ],
              [
                "Renta mensual de equilibrio",
                money(result.breakEvenMonthlyRent),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            La cuota supone amortización mensual constante. El resultado
            operativo descuenta vacancia, impago y gastos; el flujo también
            descuenta deuda y reposiciones. No incluye fiscalidad personal ni
            venta futura.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left font-semibold mb-2">
                Sensibilidad: una variable cada vez
              </caption>
              <thead>
                <tr>
                  <th className="text-left p-2">Supuesto</th>
                  <th className="text-right p-2">Flujo anual</th>
                </tr>
              </thead>
              <tbody>
                {investmentSensitivity(inputs).map((s) => (
                  <tr key={s.label} className="border-t">
                    <td className="p-2">{s.label}</td>
                    <td className="text-right p-2">
                      {money(s.result.cashflow)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Label htmlFor="scenario-name">Nombre del escenario</Label>
          <Input
            id="scenario-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving
                ? "Guardando…"
                : `Guardar escenario${version ? ` · v${version + 1}` : ""}`}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadJson("escenario-inversion.json", {
                  name,
                  inputs,
                  result,
                  sensitivity: investmentSensitivity(inputs),
                  generated_at: new Date().toISOString(),
                })
              }
            >
              Exportar cálculos
            </Button>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
