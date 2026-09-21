import { PropertyMap } from "./PropertyMap";
import { PropertyDetails, type Listing } from "./PropertyDetails";
import { PropertyComparison } from "./PropertyComparison";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensureClientProfile } from "@/lib/client-profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, ExternalLink, RefreshCw, Home } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  favorito: boolean;
  score: number;
  criterios_cumplidos: Record<string, unknown>;
  propiedad: {
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
  };
}
const PAGE_SIZE = 12;
const labels: Record<string, string> = {
  presupuesto: "Presupuesto",
  ubicacion: "Zona",
  tipoPropiedad: "Tipo",
  superficie: "Superficie",
  dormitorios: "Dormitorios",
  banos: "Baños",
  ascensor: "Ascensor",
  parking: "Parking",
  condicion: "Estado",
};
const safeUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};

export function ClientProperties() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [showMap, setShowMap] = useState(false);
  const [selected, setSelected] = useState<Listing[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const clientId = await ensureClientProfile();
        let query = supabase
          .from("matchings")
          .select(
            "id,favorito,score,criterios_cumplidos,propiedad:propiedades!inner(id,titulo,precio,ubicacion,metros,dormitorios,banos,url,imagenes,last_seen,portal_origen,activo,latitude,longitude,location_precision)",
          )
          .eq("cliente_id", clientId)
          .order("score", { ascending: false })
          .order("id")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        if (favorites) query = query.eq("favorito", true);
        else
          query = query
            .gte("score", 60)
            .eq("propiedad.activo", true)
            .gte(
              "propiedad.last_seen",
              new Date(Date.now() - 7 * 86400000).toISOString(),
            );
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        if (!cancelled) {
          setMore(data.length > PAGE_SIZE);
          setItems(data.slice(0, PAGE_SIZE) as unknown as Recommendation[]);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, favorites, refresh]);

  async function toggleFavorite(item: Recommendation) {
    setSaving(item.id);
    const { error, data } = await supabase
      .from("matchings")
      .update({ favorito: !item.favorito })
      .eq("id", item.id)
      .select("id");
    if (error || !data?.length) toast.error("No se pudo guardar el favorito");
    else setRefresh((n) => n + 1);
    setSaving(null);
  }
  async function rate(
    item: Recommendation,
    value: "relevante" | "irrelevante",
  ) {
    setSaving(item.id);
    try {
      const client = await ensureClientProfile();
      const { error } = await supabase
        .from("matching_feedback")
        .insert({
          cliente_id: client,
          matching_id: item.id,
          propiedad_id: item.propiedad.id,
          feedback_type: value,
        });
      if (error) throw error;
      setFeedback((rows) => ({ ...rows, [item.id]: value }));
      toast.success("Gracias. Hemos guardado tu valoración.");
    } catch {
      toast.error("No se pudo guardar tu valoración");
    } finally {
      setSaving(null);
    }
  }
  return (
    <section className="mb-10" aria-labelledby="recommendations-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 id="recommendations-title" className="text-2xl font-bold">
            Tus inmuebles
          </h2>
          <p className="text-muted-foreground text-sm">
            Anuncios observados en los últimos 7 días. Confirma su
            disponibilidad con el anunciante.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              setFavorites((v) => !v);
              setPage(0);
            }}
            aria-pressed={favorites}
          >
            <Heart className="w-4 h-4 mr-2" />
            {favorites ? "Ver todos" : "Favoritos"}
          </Button>
          <Button
            variant="outline"
            aria-pressed={showMap}
            onClick={() => setShowMap((v) => !v)}
          >
            {showMap ? "Ocultar mapa" : "Ver mapa"}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/cliente/onboarding")}
          >
            Editar búsqueda
          </Button>
          <Button
            variant="ghost"
            aria-label="Actualizar inmuebles"
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <PropertyComparison
        items={selected}
        onRemove={(id) =>
          setSelected((rows) => rows.filter((p) => p.id !== id))
        }
      />
      <PropertyDetails id={detail} onClose={() => setDetail(null)} />
      {showMap && !loading && (
        <PropertyMap
          items={items.map((i) => i.propiedad)}
          onSelect={setDetail}
        />
      )}
      {loading ? (
        <p role="status" className="py-10">
          Cargando tus recomendaciones…
        </p>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <p role="alert">No hemos podido cargar los inmuebles.</p>
            <Button className="mt-3" onClick={() => setRefresh((n) => n + 1)}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : !items.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Home className="mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold">
              {favorites
                ? "Todavía no hay favoritos"
                : "Aún no hay recomendaciones para tu búsqueda"}
            </h3>
            <p className="text-muted-foreground mt-2">
              {favorites
                ? "Guarda los anuncios que te interesen para encontrarlos aquí."
                : "Revisa tus criterios. Los resultados aparecerán cuando se actualicen y comparen los anuncios."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map((item) => {
            const p = item.propiedad,
              link = safeUrl(p.url),
              image = p.imagenes?.map(safeUrl).find(Boolean);
            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="h-44 bg-muted flex items-center justify-center">
                  {image ? (
                    <img
                      src={image}
                      alt={p.titulo}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Home className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-5 space-y-3">
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold line-clamp-2">{p.titulo}</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={saving === item.id}
                      aria-label={
                        item.favorito
                          ? "Quitar de favoritos"
                          : "Guardar favorito"
                      }
                      aria-pressed={item.favorito}
                      onClick={() => toggleFavorite(item)}
                    >
                      <Heart
                        className={
                          item.favorito ? "fill-primary text-primary" : ""
                        }
                      />
                    </Button>
                  </div>
                  <p className="text-xl font-bold">
                    {new Intl.NumberFormat("es-ES", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(p.precio)}
                  </p>
                  <p className="text-sm">{p.ubicacion}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.metros ?? "—"} m² · {p.dormitorios ?? "—"} hab. ·{" "}
                    {p.banos ?? "—"} baños
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(item.criterios_cumplidos ?? {})
                      .filter(([key, value]) => labels[key] && value === true)
                      .map(([key]) => (
                        <Badge key={key} variant="secondary">
                          {labels[key]}
                        </Badge>
                      ))}
                  </div>
                  {typeof item.criterios_cumplidos?.completeness ===
                    "number" && (
                    <p className="text-xs text-muted-foreground">
                      Datos conocidos: {item.criterios_cumplidos.completeness}{" "}
                      %. El orden combina tus preferencias entre viviendas
                      compatibles.
                    </p>
                  )}
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label={`Valorar ${p.titulo}`}
                  >
                    <Button
                      size="sm"
                      variant={
                        feedback[item.id] === "relevante" ? "default" : "ghost"
                      }
                      disabled={saving === item.id}
                      onClick={() => rate(item, "relevante")}
                    >
                      Me sirve
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        feedback[item.id] === "irrelevante"
                          ? "default"
                          : "ghost"
                      }
                      disabled={saving === item.id}
                      onClick={() => rate(item, "irrelevante")}
                    >
                      No encaja
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.portal_origen} · Última observación:{" "}
                    {p.last_seen
                      ? new Date(p.last_seen).toLocaleDateString("es-ES")
                      : "sin fecha"}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setDetail(p.id)}>
                      Ver ficha
                    </Button>
                    <Button
                      variant="outline"
                      aria-pressed={selected.some((x) => x.id === p.id)}
                      disabled={
                        selected.length >= 4 &&
                        !selected.some((x) => x.id === p.id)
                      }
                      onClick={() =>
                        setSelected((rows) =>
                          rows.some((x) => x.id === p.id)
                            ? rows.filter((x) => x.id !== p.id)
                            : [...rows, p],
                        )
                      }
                    >
                      {selected.some((x) => x.id === p.id)
                        ? "Quitar comparación"
                        : "Comparar"}
                    </Button>
                  </div>
                  {link && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        Ver anuncio original
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {!loading && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">Página {page + 1}</span>
          <Button
            variant="outline"
            disabled={!more || error}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </section>
  );
}
