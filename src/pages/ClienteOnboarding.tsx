import {
  GeoSearchEditor,
  type SearchGeography,
} from "@/components/GeoSearchEditor";
import { geographicMatch } from "../../supabase/functions/_shared/geography";
import { workspace } from "@/lib/workspace";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensureClientProfile } from "@/lib/client-profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search } from "lucide-react";

const propertyTypes = [
  "Piso",
  "Casa",
  "Chalet",
  "Ático",
  "Dúplex",
  "Estudio",
  "Apartamento",
];
const conditions = ["obra nueva", "buen estado", "para reformar", "reformado"];
const initialForm = {
  perfil: "vivir",
  telefono: "",
  ubicaciones: "",
  presupuestoMin: "",
  presupuestoMax: "",
  flexibilidad: "0",
  metrosMin: "",
  metrosMax: "",
  dormitorios: "",
  banos: "",
  ano: "",
  tipos: [] as string[],
  estados: [] as string[],
  ascensor: false,
  parking: false,
  preferAscensor: false,
  preferParking: false,
  preferMetros: "",
  preferDormitorios: "",
};

function numberOrNull(
  value: string,
  label: string,
  max = 100_000_000,
  integer = false,
) {
  if (!value.trim()) return null;
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    n > max ||
    (integer && !Number.isInteger(n))
  ) {
    throw new Error(`Revisa el campo «${label}».`);
  }
  return n;
}

export default function ClienteOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const savedSearch = useRef("");
  const [clientId, setClientId] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [geography, setGeography] = useState<SearchGeography>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [criteriaId, setCriteriaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof initialForm>(
    key: K,
    value: (typeof initialForm)[K],
  ) => setForm((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const id = await ensureClientProfile();
        const [customer, criteria, version] = await Promise.all([
          supabase
            .from("clientes")
            .select("perfil,telefono,presupuesto_min,presupuesto_max")
            .eq("id", id)
            .single(),
          supabase
            .from("criterios_busqueda")
            .select("*")
            .eq("cliente_id", id)
            .order("updated_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          workspace
            .from("search_state")
            .select("version")
            .eq("cliente_id", id)
            .maybeSingle(),
        ]);
        if (customer.error) throw customer.error;
        if (criteria.error) throw criteria.error;
        if (version.error) throw version.error;
        if (cancelled) return;
        const c = criteria.data,
          p = customer.data;
        const preferences =
          (c as unknown as { preferences?: Record<string, unknown> })
            ?.preferences ?? {};
        setSearchVersion(version.data?.version ?? 0);
        setGeography(
          (c as unknown as { geography?: SearchGeography })?.geography ?? null,
        );
        setClientId(id);
        setCriteriaId(c?.id ?? null);
        const savedForm = {
          perfil: p.perfil || "vivir",
          telefono: p.telefono || "",
          ubicaciones: c?.ubicaciones?.join(", ") || "",
          presupuestoMin: String(p.presupuesto_min ?? ""),
          presupuestoMax: String(p.presupuesto_max ?? ""),
          flexibilidad: String(c?.flexibilidad_presupuesto ?? 0),
          metrosMin: String(c?.metros_min ?? ""),
          metrosMax: String(c?.metros_max ?? ""),
          dormitorios: String(c?.dormitorios_min ?? ""),
          banos: String(c?.banos_min ?? ""),
          ano: String(c?.ano_construccion_min ?? ""),
          tipos: c?.tipo_propiedad ?? [],
          estados: c?.condition ?? [],
          ascensor: c?.tiene_ascensor === true,
          parking: c?.tiene_parking === true,
          preferAscensor: preferences.tiene_ascensor === true,
          preferParking: preferences.tiene_parking === true,
          preferMetros: String(preferences.metros_min ?? ""),
          preferDormitorios: String(preferences.dormitorios_min ?? ""),
        };
        setForm(savedForm);
        savedSearch.current = JSON.stringify({
          form: savedForm,
          geography:
            (c as unknown as { geography?: SearchGeography })?.geography ??
            null,
        });
        try {
          const draft = JSON.parse(
            sessionStorage.getItem(`findoo-search-draft:${id}`) ?? "null",
          );
          const age = Date.now() - draft?.saved_at;
          const validGeography =
            draft?.geography == null ||
            geographicMatch(draft.geography, {
              longitude: 0,
              latitude: 0,
              location_precision: "exact",
            }) !== null;
          if (
            draft?.version === (version.data?.version ?? 0) &&
            Number.isFinite(age) &&
            age >= 0 &&
            age < 7 * 86400000 &&
            validGeography &&
            Object.entries(initialForm).every(([key, value]) =>
              Array.isArray(value)
                ? Array.isArray(draft.form?.[key]) &&
                  draft.form[key].every((v: unknown) => typeof v === "string")
                : typeof draft.form?.[key] === typeof value,
            )
          ) {
            setForm(draft.form);
            setGeography(draft.geography ?? null);
            setDraftRestored(true);
          }
        } catch {
          /* A damaged draft never replaces the server search. */
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [retry]);

  useEffect(() => {
    if (loading || loadError || !clientId) return;
    try {
      const key = `findoo-search-draft:${clientId}`;
      if (JSON.stringify({ form, geography }) === savedSearch.current)
        sessionStorage.removeItem(key);
      else
        sessionStorage.setItem(
          key,
          JSON.stringify({
            form,
            geography,
            version: searchVersion,
            saved_at: Date.now(),
          }),
        );
    } catch {
      /* Storage may be disabled. Server save remains available. */
    }
  }, [form, geography, loading, loadError, clientId, searchVersion]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const ubicaciones = [
        ...new Set(
          form.ubicaciones
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      if (
        !ubicaciones.length ||
        ubicaciones.length > 10 ||
        ubicaciones.some((s) => s.length > 100)
      ) {
        throw new Error(
          "Indica entre 1 y 10 ciudades, barrios o provincias, separados por comas.",
        );
      }
      const telefono = form.telefono.trim();
      if (telefono && !/^\+[1-9]\d{8,14}$/.test(telefono))
        throw new Error(
          "Usa el formato internacional para el teléfono, por ejemplo +34612345678.",
        );
      const min = numberOrNull(form.presupuestoMin, "Presupuesto mínimo");
      const max = numberOrNull(form.presupuestoMax, "Presupuesto máximo");
      const areaMin = numberOrNull(form.metrosMin, "Superficie mínima", 10000);
      const areaMax = numberOrNull(form.metrosMax, "Superficie máxima", 10000);
      const flexibility = Number(form.flexibilidad);
      if (!Number.isFinite(flexibility) || flexibility < 0 || flexibility > 30)
        throw new Error("El margen de presupuesto debe estar entre 0 y 30 %.");
      if (min !== null && max !== null && min > max)
        throw new Error("El presupuesto mínimo no puede superar al máximo.");
      if (areaMin !== null && areaMax !== null && areaMin > areaMax)
        throw new Error("La superficie mínima no puede superar a la máxima.");
      if (
        geography?.kind === "radius" &&
        (!Number.isFinite(geography.km) ||
          geography.km <= 0 ||
          geography.km > 200 ||
          Math.abs(geography.center[0]) > 180 ||
          Math.abs(geography.center[1]) > 90)
      )
        throw new Error("Revisa el centro y radio de búsqueda.");
      const criteria = {
        geography,
        cliente_id: clientId,
        ubicaciones,
        tipo_propiedad: form.tipos.length ? form.tipos : null,
        metros_min: areaMin,
        metros_max: areaMax,
        dormitorios_min: numberOrNull(
          form.dormitorios,
          "Dormitorios",
          30,
          true,
        ),
        banos_min: numberOrNull(form.banos, "Baños", 30, true),
        ano_construccion_min: numberOrNull(
          form.ano,
          "Año de construcción",
          new Date().getFullYear(),
          true,
        ),
        flexibilidad_presupuesto: flexibility,
        condition: form.estados.length ? form.estados : null,
        tiene_ascensor: form.ascensor ? true : null,
        tiene_parking: form.parking ? true : null,
        preferences: {
          tiene_ascensor: form.preferAscensor,
          tiene_parking: form.preferParking,
          metros_min: numberOrNull(
            form.preferMetros,
            "Superficie deseada",
            10000,
          ),
          dormitorios_min: numberOrNull(
            form.preferDormitorios,
            "Dormitorios deseados",
            30,
            true,
          ),
        },
      };
      const saved = await workspace.rpc("save_client_search", {
        p_profile: {
          perfil: form.perfil,
          telefono: telefono || null,
          presupuesto_min: min,
          presupuesto_max: max,
        },
        p_criteria: criteria,
        p_expected_version: searchVersion,
      });
      if (saved.error)
        throw new Error(
          saved.error.code === "40001"
            ? "La búsqueda cambió en otra sesión. Recarga antes de guardar."
            : "No se pudo guardar la búsqueda completa. Inténtalo de nuevo.",
        );
      const data = saved.data as { id: string; version: number };
      setCriteriaId(data.id);
      setSearchVersion(data.version);
      savedSearch.current = JSON.stringify({ form, geography });
      try {
        sessionStorage.removeItem(`findoo-search-draft:${clientId}`);
      } catch {
        /* Saving on the server does not require browser storage. */
      }
      toast({
        title: "Búsqueda guardada",
        description: "Hemos solicitado la actualización de tus resultados.",
      });
      navigate("/cliente/dashboard");
    } catch (error) {
      toast({
        title: "No se ha guardado la búsqueda",
        description:
          error instanceof Error ? error.message : "Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p role="status" className="p-10 text-center">
        Cargando tu búsqueda…
      </p>
    );
  if (loadError)
    return (
      <div className="p-10 text-center space-y-4">
        <p role="alert">No hemos podido cargar tu búsqueda.</p>
        <Button onClick={() => setRetry((n) => n + 1)}>Reintentar</Button>
      </div>
    );

  const numericField = (
    key:
      | "presupuestoMin"
      | "presupuestoMax"
      | "metrosMin"
      | "metrosMax"
      | "dormitorios"
      | "banos"
      | "ano"
      | "preferMetros"
      | "preferDormitorios",
    label: string,
    placeholder = "Sin preferencia",
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min="1"
        step="any"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );
  const choices = (key: "tipos" | "estados", values: string[]) => (
    <div className="flex flex-wrap gap-2">
      {[...new Set([...values, ...form[key]])].map((value) => (
        <Button
          key={value}
          type="button"
          variant={form[key].includes(value) ? "default" : "outline"}
          aria-pressed={form[key].includes(value)}
          onClick={() =>
            set(
              key,
              form[key].includes(value)
                ? form[key].filter((v) => v !== value)
                : [...form[key], value],
            )
          }
        >
          {value}
        </Button>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" onClick={() => navigate("/cliente/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a mis inmuebles
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            Tu próxima vivienda empieza aquí
          </h1>
          <p className="mt-2 text-muted-foreground">
            Define lo que necesitas. Puedes cambiar tu búsqueda cuando quieras.
          </p>
        </div>
        {draftRestored && (
          <p role="status" className="rounded border p-3 text-sm">
            Hemos recuperado tus cambios pendientes de esta pestaña. Guarda la
            búsqueda para aplicarlos.
          </p>
        )}
        <form onSubmit={save} className="space-y-6">
          <fieldset disabled={saving} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Dónde y para qué</CardTitle>
                <CardDescription>
                  Las zonas se comparan con los datos publicados en cada
                  anuncio.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ubicaciones">
                    Ciudades, barrios o provincias *
                  </Label>
                  <Input
                    id="ubicaciones"
                    required
                    placeholder="Madrid, Chamberí, Alcobendas"
                    value={form.ubicaciones}
                    onChange={(e) => set("ubicaciones", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Separa las zonas con comas. Puedes indicar hasta 10.
                  </p>
                </div>
                <GeoSearchEditor value={geography} onChange={setGeography} />
                <div className="space-y-2">
                  <Label htmlFor="perfil">Quiero comprar para</Label>
                  <select
                    id="perfil"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.perfil}
                    onChange={(e) => set("perfil", e.target.value)}
                  >
                    <option value="vivir">Vivir</option>
                    <option value="alquilar">Alquilar</option>
                    <option value="vender">Reformar y vender</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">
                    Teléfono de contacto (opcional)
                  </Label>
                  <Input
                    id="telefono"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+34612345678"
                    value={form.telefono}
                    onChange={(e) => set("telefono", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>2. Tu presupuesto</CardTitle>
                <CardDescription>
                  Deja vacío cualquier límite que no quieras aplicar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {numericField("presupuestoMin", "Desde (€)")}
                  {numericField("presupuestoMax", "Hasta (€)")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flexibilidad">
                    Margen sobre tu presupuesto máximo (%)
                  </Label>
                  <Input
                    id="flexibilidad"
                    type="number"
                    min="0"
                    max="30"
                    required
                    value={form.flexibilidad}
                    onChange={(e) => set("flexibilidad", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Con 0 % respetamos el máximo exacto. Con 10 %, un máximo de
                    200.000 € permite anuncios hasta 220.000 €.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>3. Lo que debe tener</CardTitle>
                <CardDescription>
                  Los requisitos seleccionados son obligatorios. Si el anuncio
                  no confirma un dato, no lo daremos por cumplido.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Tipo de vivienda (cualquiera si no seleccionas ninguno)
                  </p>
                  {choices("tipos", propertyTypes)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {numericField("metrosMin", "Superficie mínima (m²)")}
                  {numericField("metrosMax", "Superficie máxima (m²)")}
                  {numericField("dormitorios", "Dormitorios mínimos")}
                  {numericField("banos", "Baños mínimos")}
                  {numericField("ano", "Construida a partir del año")}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Estado (cualquiera si no seleccionas ninguno)
                  </p>
                  {choices("estados", conditions)}
                </div>
                <div className="flex flex-wrap gap-6">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.ascensor}
                      onChange={(e) => set("ascensor", e.target.checked)}
                    />
                    Ascensor imprescindible
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.parking}
                      onChange={(e) => set("parking", e.target.checked)}
                    />
                    Parking imprescindible
                  </Label>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>4. Lo que te gustaría</CardTitle>
                <CardDescription>
                  Estas preferencias ordenan las viviendas compatibles. No
                  sustituyen a tus requisitos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-5">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.preferAscensor}
                      onChange={(e) => set("preferAscensor", e.target.checked)}
                    />
                    Me gustaría ascensor
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.preferParking}
                      onChange={(e) => set("preferParking", e.target.checked)}
                    />
                    Me gustaría parking
                  </Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {numericField("preferMetros", "Superficie deseada (m²)")}
                  {numericField("preferDormitorios", "Dormitorios deseados")}
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Piloto: el equipo revisa y actualiza las recomendaciones.
              </p>
              <Button type="submit" disabled={saving || !clientId}>
                <Search className="mr-2 h-4 w-4" />
                {saving ? "Guardando…" : "Guardar mi búsqueda"}
              </Button>
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
