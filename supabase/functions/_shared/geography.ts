type Point = [number, number]; // longitude, latitude
const point = (v: unknown): v is Point =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((x) => typeof x === "number" && Number.isFinite(x)) &&
  Math.abs(v[0]) <= 180 &&
  Math.abs(v[1]) <= 90;
export function distanceKm(a: Point, b: Point) {
  if (!point(a) || !point(b)) throw new Error("Invalid coordinates");
  const rad = Math.PI / 180,
    dLat = (b[1] - a[1]) * rad,
    dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function geographicMatch(filter: any, location: any): boolean | null {
  const p: Point = [location.longitude, location.latitude];
  if (!point(p) || location.location_precision !== "exact") return null;
  if (filter?.kind === "radius") {
    if (
      !point(filter.center) ||
      typeof filter.km !== "number" ||
      !Number.isFinite(filter.km) ||
      filter.km <= 0 ||
      filter.km > 200
    )
      return null;
    return distanceKm(filter.center, p) <= filter.km;
  }
  if (filter?.kind === "polygon") {
    const vertices = filter.points;
    if (
      !Array.isArray(vertices) ||
      vertices.length < 3 ||
      vertices.length > 100 ||
      !vertices.every(point)
    )
      return null;
    // Local search polygons only; reject antimeridian-spanning geometry.
    if (
      Math.max(...vertices.map((v) => v[0])) -
        Math.min(...vertices.map((v) => v[0])) >
      180
    )
      return null;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [xi, yi] = vertices[i],
        [xj, yj] = vertices[j];
      const cross = (p[1] - yi) * (xj - xi) - (p[0] - xi) * (yj - yi);
      if (
        Math.abs(cross) < 1e-10 &&
        p[0] >= Math.min(xi, xj) &&
        p[0] <= Math.max(xi, xj) &&
        p[1] >= Math.min(yi, yj) &&
        p[1] <= Math.max(yi, yj)
      )
        return true;
      if (
        yi > p[1] !== yj > p[1] &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
      )
        inside = !inside;
    }
    return inside;
  }
  return null;
}
