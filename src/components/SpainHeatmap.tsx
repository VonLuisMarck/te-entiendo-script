import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PropertyLocation {
  location: string;
  count: number;
  lat?: number;
  lon?: number;
}

// Coordenadas de ciudades principales de España
const cityCoordinates: Record<string, [number, number]> = {
  madrid: [40.4168, -3.7038],
  barcelona: [41.3851, 2.1734],
  valencia: [39.4699, -0.3763],
  sevilla: [37.3891, -5.9845],
  zaragoza: [41.6488, -0.8891],
  málaga: [36.7213, -4.4214],
  murcia: [37.9922, -1.1307],
  palma: [39.5696, 2.6502],
  bilbao: [43.2627, -2.9253],
  alicante: [38.3452, -0.4815],
  córdoba: [37.8882, -4.7794],
  valladolid: [41.6528, -4.7245],
  vigo: [42.2406, -8.7207],
  gijón: [43.5322, -5.6611],
  "l'hospitalet": [41.3598, 2.0989],
  coruña: [43.3623, -8.4115],
  vitoria: [42.8467, -2.6716],
  granada: [37.1773, -3.5986],
  elche: [38.2699, -0.6983],
  oviedo: [43.3614, -5.8493],
  santander: [43.4623, -3.8050],
  pamplona: [42.8125, -1.6458],
  almería: [36.8381, -2.4597],
  toledo: [39.8628, -4.0273],
  castellón: [39.9864, -0.0513],
};

export function SpainHeatmap() {
  const [locations, setLocations] = useState<PropertyLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPropertyLocations();
  }, []);

  const loadPropertyLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("propiedades")
        .select("ubicacion, activo")
        .eq("activo", true);

      if (error) throw error;

      // Agrupar por ubicación y contar
      const locationCounts: Record<string, number> = {};
      data?.forEach((prop) => {
        // Extraer ciudad de la ubicación (formato típico: "Madrid, Salamanca")
        const ubicacion = prop.ubicacion?.toLowerCase().trim() || "desconocida";
        const ciudad = ubicacion.split(",")[0].trim();
        locationCounts[ciudad] = (locationCounts[ciudad] || 0) + 1;
      });

      // Convertir a array y añadir coordenadas
      const locationsWithCoords = Object.entries(locationCounts)
        .map(([location, count]) => {
          const coords = cityCoordinates[location];
          return {
            location,
            count,
            lat: coords?.[0],
            lon: coords?.[1],
          };
        })
        .filter((loc) => loc.lat && loc.lon); // Solo ciudades con coordenadas

      setLocations(locationsWithCoords);
    } catch (error) {
      console.error("Error loading property locations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular el radio basado en la cantidad de propiedades
  const getRadius = (count: number) => {
    const maxCount = Math.max(...locations.map((l) => l.count), 1);
    return Math.max(5, Math.min(30, (count / maxCount) * 30));
  };

  // Calcular la opacidad basada en la cantidad
  const getOpacity = (count: number) => {
    const maxCount = Math.max(...locations.map((l) => l.count), 1);
    return Math.max(0.3, Math.min(0.8, (count / maxCount) * 0.8));
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || locations.length === 0) return;

    // Inicializar el mapa
    const map = L.map(mapContainerRef.current).setView([40.4168, -3.7038], 6);
    mapRef.current = map;

    // Añadir capa de tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Añadir marcadores
    locations.forEach((location) => {
      const radius = getRadius(location.count);
      const opacity = getOpacity(location.count);

      L.circleMarker([location.lat!, location.lon!], {
        radius: radius,
        fillColor: 'hsl(var(--primary))',
        color: 'hsl(var(--primary))',
        weight: 2,
        opacity: opacity,
        fillOpacity: opacity * 0.6,
      })
        .bindPopup(`
          <div style="text-align: center;">
            <strong style="font-size: 1rem; text-transform: capitalize;">${location.location}</strong>
            <p style="font-size: 0.875rem; color: #666;">
              ${location.count} ${location.count === 1 ? 'propiedad' : 'propiedades'}
            </p>
          </div>
        `)
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [locations]);

  if (loading) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <p className="text-muted-foreground">Cargando mapa...</p>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[500px] overflow-hidden">
      <div ref={mapContainerRef} className="h-full w-full" />
    </Card>
  );
}
