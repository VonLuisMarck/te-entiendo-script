import { mapTileUrl, mapAttribution } from "@/lib/map-config";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Circle, Polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export type SearchGeography =
  | { kind: "radius"; center: [number, number]; km: number }
  | { kind: "polygon"; points: [number, number][] }
  | null;
export function GeoSearchEditor({
  value,
  onChange,
}: {
  value: SearchGeography;
  onChange: (value: SearchGeography) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    current = useRef(value),
    changed = useRef(onChange),
    mapRef = useRef<LeafletMap | null>(null),
    shape = useRef<Circle | Polygon | null>(null),
    [error, setError] = useState("");
  current.current = value;
  changed.current = onChange;
  useEffect(() => {
    if (!value) return;
    let disposed = false;
    setError("");
    void (async () => {
      const L = await import("leaflet");
      if (disposed || !container.current) return;
      const g = current.current!;
      const center = g.kind === "radius" ? g.center : g.points[0];
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(
        [center[1], center[0]],
        11,
      );
      mapRef.current = map;
      L.tileLayer(mapTileUrl, { maxZoom: 18, attribution: mapAttribution })
        .addTo(map)
        .on("tileerror", () =>
          setError(
            "No se pudo cargar el mapa base. Puedes ajustar las coordenadas.",
          ),
        );
      shape.current =
        g.kind === "radius"
          ? L.circle([g.center[1], g.center[0]], { radius: g.km * 1000 }).addTo(
              map,
            )
          : L.polygon(g.points.map(([lon, lat]) => [lat, lon])).addTo(map);
      map.on("click", (e) => {
        if (current.current?.kind !== "radius") return;
        const lat = Math.max(-90, Math.min(90, e.latlng.lat)),
          lon = ((((e.latlng.lng + 180) % 360) + 360) % 360) - 180;
        changed.current({ ...current.current, center: [lon, lat] });
      });
    })().catch(() => {
      if (!disposed) setError("El mapa no está disponible.");
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      shape.current = null;
    };
  }, [value?.kind]);
  useEffect(() => {
    if (
      value?.kind === "radius" &&
      shape.current &&
      "setRadius" in shape.current &&
      value.center.every(Number.isFinite) &&
      Math.abs(value.center[0]) <= 180 &&
      Math.abs(value.center[1]) <= 90
    ) {
      shape.current
        .setLatLng([value.center[1], value.center[0]])
        .setRadius(Math.max(0.1, value.km) * 1000);
    }
  }, [value]);
  return (
    <div className="space-y-3">
      <Label className="flex gap-2 items-center">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { kind: "radius", center: [-3.7038, 40.4168], km: 5 }
                : null,
            )
          }
        />
        {value?.kind === "polygon"
          ? "Zona personalizada obligatoria"
          : "Añadir un radio obligatorio"}
      </Label>
      {value && (
        <>
          <p className="text-sm text-muted-foreground">
            {value.kind === "radius"
              ? "Selecciona el centro pulsando en el mapa. Es una distancia geográfica: solo pasarán anuncios con coordenadas declaradas exactas."
              : "Tu zona personalizada se conservará. Para sustituirla por un radio, desactiva este filtro y vuelve a activarlo."}
          </p>
          <div
            ref={container}
            className="h-64 rounded border z-0"
            aria-label="Elegir centro de búsqueda"
          />
          {error && (
            <p role="status" className="text-sm">
              {error}
            </p>
          )}
          {value.kind === "radius" && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="geo-lat">Latitud del centro</Label>
                <Input
                  id="geo-lat"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  value={value.center[1]}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      center: [value.center[0], Number(e.target.value)],
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="geo-lon">Longitud del centro</Label>
                <Input
                  id="geo-lon"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  value={value.center[0]}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      center: [Number(e.target.value), value.center[1]],
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="geo-radius">Radio en km</Label>
                <Input
                  id="geo-radius"
                  type="number"
                  min="0.1"
                  max="200"
                  step="0.1"
                  value={value.km}
                  onChange={(e) =>
                    onChange({ ...value, km: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
