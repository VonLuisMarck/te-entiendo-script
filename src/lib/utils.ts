import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea la ubicación de una propiedad de forma legible
 * Prioriza distrito > ciudad > provincia y maneja JSON strings
 */
export function formatearUbicacion(ubicacion: {
  ubicacion?: string;
  distrito?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
}): string {
  // Intentar con los campos normalizados primero
  if (ubicacion.distrito) {
    return ubicacion.distrito;
  }
  if (ubicacion.ciudad) {
    return ubicacion.ciudad;
  }
  if (ubicacion.provincia) {
    return ubicacion.provincia;
  }
  
  // Si solo tenemos el campo ubicacion
  if (ubicacion.ubicacion) {
    // Si ubicacion es un JSON string, intentar parsearlo
    try {
      if (typeof ubicacion.ubicacion === 'string' && ubicacion.ubicacion.includes('{')) {
        const parsed = JSON.parse(ubicacion.ubicacion);
        return parsed.distrito || parsed.ciudad || parsed.provincia || 'Ubicación no especificada';
      } else {
        return ubicacion.ubicacion;
      }
    } catch (e) {
      // Si no se puede parsear, usar el string tal cual
      return ubicacion.ubicacion;
    }
  }
  
  return 'Ubicación no especificada';
}
