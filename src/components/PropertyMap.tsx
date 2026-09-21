import { mapTileUrl, mapAttribution } from "@/lib/map-config";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Listing } from "./PropertyDetails";
import { money } from "@/lib/workspace";
export function PropertyMap({
  items,
  onSelect,
}: {
  items: Listing[];
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    [status, setStatus] = useState("");
  useEffect(() => {
    let disposed = false,
      cleanup: () => void = () => {};
    void (async () => {
      const L = await import("leaflet");
      if (disposed || !container.current) return;
      const points = items.filter(
        (p) =>
          typeof p.latitude === "number" &&
          Number.isFinite(p.latitude) &&
          Math.abs(p.latitude) <= 90 &&
          typeof p.longitude === "number" &&
          Number.isFinite(p.longitude) &&
          Math.abs(p.longitude) <= 180,
      );
      if (!points.length) {
        setStatus(
          "Estos anuncios no incluyen coordenadas verificables. Puedes seguir revisándolos en la lista.",
        );
        return;
      }
      setStatus("");
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(
        [40, -3],
        6,
      );
      const tiles = L.tileLayer(mapTileUrl, {
        maxZoom: 18,
        attribution: mapAttribution,
      }).addTo(map);
      tiles.on("tileerror", () =>
        setStatus(
          "El mapa base no está disponible. La lista conserva todos los anuncios.",
        ),
      );
      for (const p of points) {
        const marker = L.circleMarker([p.latitude!, p.longitude!], {
          radius: p.location_precision === "exact" ? 7 : 11,
          fillOpacity: 0.65,
        }).addTo(map);
        const button = document.createElement("button");
        button.textContent = `${p.titulo} · ${money(p.precio)} · ${p.location_precision === "exact" ? "ubicación declarada exacta" : "ubicación aproximada"}`;
        button.className = "text-left underline";
        button.onclick = () => onSelect(p.id);
        marker.bindPopup(button);
      }
      map.fitBounds(
        L.latLngBounds(points.map((p) => [p.latitude!, p.longitude!])),
        { padding: [24, 24], maxZoom: 14 },
      );
      cleanup = () => map.remove();
    })().catch(() => {
      if (!disposed) setStatus("No se pudo cargar el mapa.");
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [items, onSelect]);
  return (
    <section className="mb-5 space-y-2">
      <p className="text-sm text-muted-foreground">
        Mapa de los anuncios de esta página con coordenadas disponibles. Los
        círculos amplios indican ubicación aproximada.
      </p>
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
      <div
        ref={container}
        className="h-80 rounded border z-0"
        role="region"
        aria-label="Mapa de los anuncios"
      />
    </section>
  );
}
