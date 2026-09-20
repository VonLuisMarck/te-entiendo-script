import type { RecordData } from './matching.ts';
function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null;
}
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const bool = (v: unknown): boolean | null => typeof v === 'boolean' ? v : null;
function type(value: unknown) {
  const types: Record<string,string> = { '1':'chalet','2':'piso','3':'ático','4':'dúplex','5':'estudio',
    apartment:'piso',house:'chalet',singlefamilyresidence:'chalet',penthouse:'ático',duplex:'dúplex',studio:'estudio',
    piso:'piso',apartamento:'apartamento',casa:'casa',chalet:'chalet','ático':'ático','dúplex':'dúplex',estudio:'estudio' };
  return types[String(value).toLowerCase()] ?? null;
}
// Price, location, dimensions and photos come from the source, never an LLM.
// An unsupported source shape remains pending/error instead of inventing a home.
export function normalizeListing(row: RecordData) {
  const raw = row.raw_data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Formato raw inválido');
  const precio = number(raw.precio ?? raw.price ?? raw.transaction?.price);
  if (!precio || precio > 100000000) throw new Error('Precio verificable ausente o inválido');
  const metros = number(raw.metros ?? raw.size_m2 ?? raw.surface);
  const ciudad = text(raw.ciudad ?? raw.municipality ?? raw.location?.level5Name)?.replace(/ capital$/i, '') ?? null;
  const distrito = text(raw.distrito ?? raw.neighborhood ?? raw.location?.level8Name ?? raw.zone);
  const provincia = text(raw.provincia ?? raw.province ?? raw.location?.level2Name);
  const ubicacion = text(raw.ubicacion) ?? (ciudad ? [distrito, ciudad].filter(Boolean).join(', ') : null);
  const tipo = type(raw.tipo_propiedad ?? raw.property_type ?? raw.propertyType);
  if (!ubicacion || !tipo) throw new Error('Ubicación o tipo no verificables; requiere revisión');
  const images = raw.imagenes ?? raw.image_urls ?? (Array.isArray(raw.multimedia) ? raw.multimedia.filter((m: any) => String(m.type) === '2').map((m: any) => m.url) : []);
  const imagenes = Array.isArray(images) ? [...new Set(images.filter((v: unknown) => {
    try { return typeof v === 'string' && new URL(v).protocol === 'https:'; } catch { return false; }
  }))].slice(0,10) : [];
  const features = Array.isArray(raw.features) ? raw.features.map((f: any) => typeof f === 'object' ? String(f.id) : '') : [];
  return { external_id: row.external_id, portal_origen: row.portal_origen, url: row.url,
    titulo: (text(raw.titulo ?? raw.title) ?? `${tipo} en ${ubicacion}`).slice(0,500),
    descripcion: text(raw.descripcion ?? raw.description)?.slice(0,10000) ?? null,
    precio, metros: metros && metros <= 100000 ? metros : null,
    precio_m2: metros && metros > 0 ? Math.round(precio / metros * 100) / 100 : null,
    ubicacion, ciudad, distrito, provincia, tipo_propiedad: tipo,
    dormitorios: number(raw.dormitorios ?? raw.rooms), banos: number(raw.banos ?? raw.bathrooms),
    ano_construccion: number(raw.ano_construccion ?? raw.year_built),
    condition: text(raw.condition ?? raw.extras?.condition),
    tiene_ascensor: bool(raw.tiene_ascensor ?? raw.has_lift) ?? (features.includes('17') ? true : null),
    tiene_parking: bool(raw.tiene_parking ?? raw.has_parking) ?? (features.includes('2') ? true : null),
    tiene_trastero: bool(raw.tiene_trastero), imagenes,
  };
}
