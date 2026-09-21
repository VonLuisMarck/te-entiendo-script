// Public deployment configuration; use a provider appropriate to the expected load.
export const mapTileUrl =
  import.meta.env.VITE_MAP_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const mapAttribution =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
