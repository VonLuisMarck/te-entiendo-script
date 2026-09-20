export type RecordData = Record<string, any>;
const normalize = (s: unknown) => typeof s === 'string'
  ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ') : '';
const numeric = (x: unknown): number | null => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null;

// Explainable compatibility only. No claims about future returns or ML training.
export function scoreProperty(cliente: RecordData, criteria: RecordData | undefined, property: RecordData) {
  const checks: Record<string, boolean | null> = {};
  const reasons: string[] = [];
  let possible = 0, earned = 0;
  const check = (name: string, ok: boolean | null, weight: number, required = true) => {
    checks[name] = ok; possible += weight;
    if (ok === true) earned += weight;
    if (required && ok !== true) reasons.push(ok === null ? `${name}: sin datos` : `${name}: no cumple`);
  };
  if (!criteria || !criteria.ubicaciones?.length) return { score: 0, eligible: false, checks, reasons: ['Faltan criterios de ubicación'] };
  const price = numeric(property.precio), low = numeric(cliente.presupuesto_min), high = numeric(cliente.presupuesto_max);
  const flexibility = Math.max(0, Math.min(30, numeric(criteria.flexibilidad_presupuesto) ?? 10)) / 100;
  check('presupuesto', price === null || price <= 0 ? null :
    (low === null || price >= low) && (high === null || price <= high * (1 + flexibility)), 30);
  const locations = [property.ciudad, property.distrito, property.provincia,
    ...(typeof property.ubicacion === 'string' ? property.ubicacion.split(',') : [])].map(normalize).filter(Boolean);
  check('ubicacion', locations.length ? criteria.ubicaciones.some((u: string) => locations.includes(normalize(u))) : null, 25);
  if (criteria.tipo_propiedad?.length) check('tipoPropiedad', property.tipo_propiedad
    ? criteria.tipo_propiedad.map(normalize).includes(normalize(property.tipo_propiedad)) : null, 15);
  const bounds = [
    ['superficie', property.metros, criteria.metros_min, criteria.metros_max, 10],
    ['dormitorios', property.dormitorios, criteria.dormitorios_min, null, 5],
    ['banos', property.banos, criteria.banos_min, null, 5],
    ['anoConstruccion', property.ano_construccion, criteria.ano_construccion_min, null, 3],
    ['precio_m2', property.precio_m2, null, criteria.precio_m2_max, 5],
  ];
  for (const [key, value, min, max, weight] of bounds) {
    if (numeric(min) === null && numeric(max) === null) continue;
    const n = numeric(value);
    check(String(key), n === null ? null : (numeric(min) === null || n >= Number(min)) && (numeric(max) === null || n <= Number(max)), Number(weight));
  }
  if (criteria.condition?.length) check('condicion', property.condition
    ? criteria.condition.map(normalize).includes(normalize(property.condition)) : null, 5);
  for (const [key, label] of [['tiene_ascensor','ascensor'], ['tiene_parking','parking']]) {
    if (criteria[key] === true) check(label, typeof property[key] === 'boolean' ? property[key] : null, 5);
  }
  return { score: reasons.length ? 0 : Math.round(100 * earned / possible), eligible: reasons.length === 0, checks, reasons };
}

// Keyset pagination does not stop at PostgREST's per-request cap. A safety cap
// fails explicitly before any writes instead of silently omitting customers.
export async function readAll(fetchPage: (after: string | null) => Promise<RecordData[]>, max = 10000) {
  const rows: RecordData[] = [];
  let after: string | null = null;
  while (true) {
    const page = await fetchPage(after);
    if (!page.length) return rows;
    if (rows.length + page.length > max) throw new Error('Demasiados registros: ejecuta por cliente o ubicación');
    const next = page[page.length - 1].id;
    if (typeof next !== 'string' || next === after) throw new Error('La paginación no avanza');
    rows.push(...page); after = next;
  }
}
