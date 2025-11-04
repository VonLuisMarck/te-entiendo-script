import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";

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

  if (loading) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <p className="text-muted-foreground">Cargando mapa...</p>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[500px] overflow-hidden">
      <MapContainer
        center={[40.4168, -3.7038]} // Centro en Madrid
        zoom={6}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((location, idx) => (
          <CircleMarker
            key={idx}
            center={[location.lat!, location.lon!]}
            radius={getRadius(location.count)}
            pathOptions={{
              fillColor: "hsl(var(--primary))",
              color: "hsl(var(--primary))",
              weight: 2,
              opacity: getOpacity(location.count),
              fillOpacity: getOpacity(location.count) * 0.6,
            }}
          >
            <Popup>
              <div className="text-center">
                <strong className="text-base capitalize">{location.location}</strong>
                <p className="text-sm text-muted-foreground">
                  {location.count} {location.count === 1 ? "propiedad" : "propiedades"}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </Card>
  );
}
