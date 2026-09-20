import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
test('all migrations, real PostgreSQL RLS, privileges and ingestion', async t => {
 const db = new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
 for (const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4)', [A,'a@example.test',B,'b@example.test']);
 async function asUser(uid: string, sql: string, args: unknown[] = []) {
  await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
  try {
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[uid]);
   const result=await db.query(sql,args); await db.exec('COMMIT'); return result;
  } catch(e) { await db.exec('ROLLBACK'); throw e; }
 }
 const ca=(await asUser(A,'SELECT ensure_cliente_profile() AS id')).rows[0].id as string;
 const cb=(await asUser(B,'SELECT ensure_cliente_profile() AS id')).rows[0].id as string;
 await t.test('confirmed profile creation is idempotent and isolated',async()=>{
  assert.equal((await asUser(A,'SELECT ensure_cliente_profile() AS id')).rows[0].id,ca);
  assert.deepEqual((await asUser(A,'SELECT id FROM clientes')).rows.map(r=>r.id),[ca]);
  assert.equal((await asUser(A,"UPDATE clientes SET nombre='other' WHERE id=$1 RETURNING id",[cb])).rows.length,0);
 });
 await t.test('a customer cannot grant admin rights or paid access',async()=>{
  await assert.rejects(()=>asUser(A,"SELECT assign_admin_role('a@example.test')"),/permission denied/);
  await assert.rejects(()=>asUser(A,"INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[A]),/row-level security/);
  await assert.rejects(()=>asUser(A,"UPDATE clientes SET tipo_suscripcion='investor_platino' WHERE id=$1",[ca]),/Only an operator/);
  await assert.rejects(()=>asUser(A,"UPDATE clientes SET matchings_usados_mes=-1 WHERE id=$1",[ca]),/Only an operator/);
  await assert.rejects(()=>asUser(A,"INSERT INTO stripe_customers(user_id,stripe_customer_id) VALUES($1,'cus_forged')",[A]),/row-level security/);
 });
 await t.test('ordinary customers cannot mutate raw data or read other client feedback',async()=>{
  await assert.rejects(()=>asUser(A,"INSERT INTO propiedades_raw(external_id,portal_origen,url,raw_data) VALUES('pisos-x','pisos','https://www.pisos.com/x','{}')"),/row-level security/);
  assert.equal((await asUser(A,'SELECT * FROM propiedades_raw')).rows.length,0);
  assert.equal((await asUser(A,'SELECT * FROM matching_feedback WHERE cliente_id=$1',[cb])).rows.length,0);
 });
 const prop=(await db.query("INSERT INTO propiedades(external_id,portal_origen,titulo,precio,ubicacion,tipo_propiedad,url) VALUES('pisos-1','pisos','Fixture',150000,'Madrid','piso','https://www.pisos.com/1') RETURNING id")).rows[0].id;
 const m=(await db.query('INSERT INTO matchings(cliente_id,propiedad_id,score) VALUES($1,$2,80) RETURNING id',[ca,prop])).rows[0].id;
 await t.test('favorites work but scoring and ownership are immutable to clients',async()=>{
  assert.equal((await asUser(A,'UPDATE matchings SET favorito=true WHERE id=$1 RETURNING favorito',[m])).rows[0].favorito,true);
  await assert.rejects(()=>asUser(A,'UPDATE matchings SET score=100 WHERE id=$1',[m]),/Only seen/);
  assert.equal((await asUser(B,'SELECT * FROM matchings')).rows.length,0);
  await assert.rejects(()=>asUser(B,"INSERT INTO matching_feedback(matching_id,cliente_id,propiedad_id,feedback_type) VALUES($1,$2,$3,'relevante')",[m,cb,prop]),/row-level security/);
 });
 await t.test('raw ingestion is idempotent, records changed prices and invalidates stale normalized data',async()=>{
  const ingest=(raw: object)=>db.query("SELECT ingest_raw_property('pisos-1','pisos','https://www.pisos.com/1',$1::jsonb) AS outcome",[JSON.stringify(raw)]);
  assert.equal((await ingest({price:150000})).rows[0].outcome,'inserted');
  await db.exec("UPDATE propiedades_raw SET procesado=true");
  assert.equal((await ingest({price:150000})).rows[0].outcome,'unchanged');
  assert.equal((await ingest({price:140000})).rows[0].outcome,'updated');
  assert.equal((await db.query('SELECT activo FROM propiedades WHERE id=$1',[prop])).rows[0].activo,false);
  assert.equal((await db.query('SELECT procesado FROM propiedades_raw')).rows[0].procesado,false);
  assert.equal((await ingest({price:140000})).rows[0].outcome,'unchanged');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM propiedades_raw')).rows[0].n,1);
 });
 await t.test('processing leases exclude overlap and cannot be released by another owner',async()=>{
  const lock=(await db.query("SELECT acquire_processing_lock('batch') AS token")).rows[0].token;
  assert.equal((await db.query("SELECT acquire_processing_lock('batch') AS token")).rows[0].token,null);
  await db.query("SELECT release_processing_lock('batch',$1)",[A]);
  assert.equal((await db.query("SELECT acquire_processing_lock('batch') AS token")).rows[0].token,null);
  await db.query("SELECT release_processing_lock('batch',$1)",[lock]);
  assert.ok((await db.query("SELECT acquire_processing_lock('batch') AS token")).rows[0].token);
 });
 await t.test('normalization commits atomically and rejects an outdated source snapshot',async()=>{
  await db.exec("UPDATE propiedades_raw SET updated_at='2026-09-20T10:00:00Z'");
  const raw=(await db.query('SELECT id,updated_at::text AS version FROM propiedades_raw')).rows[0];
  const complete=(version: unknown,price: number)=>db.query('SELECT complete_raw_property($1,$2,$3::jsonb)',[raw.id,version,JSON.stringify({external_id:'forged-id',titulo:'Updated fixture',ubicacion:'Madrid',ciudad:'Madrid',tipo_propiedad:'piso',precio:price})]);
  await assert.rejects(()=>complete('2026-09-19T10:00:00Z',140000),/Source changed/);
  await assert.rejects(()=>complete(raw.version,-1),/Invalid property/);
  assert.equal((await db.query('SELECT procesado FROM propiedades_raw')).rows[0].procesado,false);
  await complete(raw.version,140000);
  const normalized=(await db.query('SELECT precio,activo,external_id FROM propiedades WHERE id=$1',[prop])).rows[0];
  assert.equal(Number(normalized.precio),140000);
  assert.equal(normalized.activo,true);
  assert.equal(normalized.external_id,'pisos-1');
  assert.equal((await db.query('SELECT procesado FROM propiedades_raw')).rows[0].procesado,true);
  await assert.rejects(()=>asUser(A,'SELECT complete_raw_property($1,$2,$3::jsonb)',[raw.id,raw.version,'{}']),/permission denied/);
 });
 await t.test('changing a search invalidates recommendations without deleting favorites',async()=>{
  await db.query('UPDATE matchings SET score=100 WHERE id=$1',[m]);
  await asUser(A,'UPDATE clientes SET presupuesto_max=100000 WHERE id=$1',[ca]);
  assert.deepEqual((await db.query('SELECT score,favorito FROM matchings WHERE id=$1',[m])).rows.map(r=>[Number(r.score),r.favorito]),[[0,true]]);
  await db.query('UPDATE matchings SET score=100 WHERE id=$1',[m]);
  await asUser(A,"INSERT INTO criterios_busqueda(cliente_id,ubicaciones) VALUES($1,ARRAY['Barcelona'])",[ca]);
  assert.equal(Number((await db.query('SELECT score FROM matchings WHERE id=$1',[m])).rows[0].score),0);
 });
 await t.test('billing updates are atomic, cannot be called by a customer and remove cancelled access',async()=>{
  await db.query("INSERT INTO stripe_customers(user_id,stripe_customer_id) VALUES($1,'cus_fixture')",[A]);
  await assert.rejects(()=>asUser(A,"SELECT sync_customer_subscription('cus_fixture','sub_1','active','investor',now()+interval '30 days')"),/permission denied/);
  await db.exec("SELECT sync_customer_subscription('cus_fixture','sub_1','active','investor',now()+interval '30 days')");
  assert.equal((await db.query('SELECT tipo_suscripcion FROM clientes WHERE id=$1',[ca])).rows[0].tipo_suscripcion,'investor');
  await db.exec("SELECT sync_customer_subscription('cus_fixture','sub_1','canceled','investor',now()+interval '30 days')");
  assert.equal((await db.query('SELECT tipo_suscripcion FROM clientes WHERE id=$1',[ca])).rows[0].tipo_suscripcion,'free');
  await db.exec("SELECT sync_customer_subscription('cus_fixture','sub_1','active','investor',now()-interval '1 day')");
  assert.equal((await db.query('SELECT tipo_suscripcion FROM clientes WHERE id=$1',[ca])).rows[0].tipo_suscripcion,'free');
  assert.equal((await db.query('SELECT tipo_suscripcion FROM clientes WHERE id=$1',[cb])).rows[0].tipo_suscripcion,'free');
 });
 await db.close();
});
