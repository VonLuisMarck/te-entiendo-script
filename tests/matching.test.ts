import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreProperty, readAll } from '../supabase/functions/_shared/matching.ts';
const client = { presupuesto_min: 100000, presupuesto_max: 200000 };
const criteria = { ubicaciones: ['Chamberí'], tipo_propiedad: ['piso'], dormitorios_min: 2, tiene_ascensor: true, flexibilidad_presupuesto: 0 };
const property = { precio: 150000, ubicacion: 'Chamberi, Madrid', tipo_propiedad: 'piso', dormitorios: 2, tiene_ascensor: true };
test('matching respects explicit criteria and accents', () => {
 assert.equal(scoreProperty(client, criteria, property).eligible, true);
 assert.equal(scoreProperty(client, criteria, property).score, 100);
});
test('overbudget/wrong city/missing essential evidence cannot be compensated by other features', () => {
 for (const change of [{ precio: 210000 }, { ubicacion: 'Murcia' }, { tiene_ascensor: null }, { dormitorios: 1 }]) {
  const result = scoreProperty(client, criteria, { ...property, ...change });
  assert.equal(result.eligible, false); assert.equal(result.score, 0);
 }
});
test('saved flexibility is applied and absent budgets do not produce NaN', () => {
 assert.equal(scoreProperty(client, { ...criteria, flexibilidad_presupuesto: 10 }, { ...property, precio: 210000 }).eligible, true);
 assert.equal(scoreProperty(client, { ...criteria, flexibilidad_presupuesto: 10 }, { ...property, precio: 95000 }).eligible, false);
 assert.equal(Number.isFinite(scoreProperty({}, criteria, property).score), true);
 assert.equal(scoreProperty(client, { ...criteria, banos_min: 2 }, { ...property, banos: null }).eligible, false);
 assert.equal(scoreProperty(client, { ...criteria, ubicaciones: ['Rio'] }, { ...property, ubicacion: 'Rioseco' }).eligible, false);
});
test('pagination reads beyond 100 rows and smaller server caps; an overflow fails explicitly', async () => {
 const rows = Array.from({ length: 1234 }, (_, i) => ({ id: String(i).padStart(6, '0') }));
 const page = async (after: string | null) => rows.filter(r => !after || r.id > after).slice(0, 73);
 assert.equal((await readAll(page)).length, 1234);
 await assert.rejects(() => readAll(page, 100), /Demasiados registros/);
});
