import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002";
test("all migrations, real PostgreSQL RLS, privileges and ingestion", async (t) => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
  for (const file of fs.readdirSync("supabase/migrations").sort())
    await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4)", [
    A,
    "a@example.test",
    B,
    "b@example.test",
  ]);
  async function asUser(uid: string, sql: string, args: unknown[] = []) {
    await db.exec("BEGIN; SET LOCAL ROLE authenticated;");
    try {
      await db.query(
        "SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",
        [uid],
      );
      const result = await db.query(sql, args);
      await db.exec("COMMIT");
      return result;
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  }
  const ca = (await asUser(A, "SELECT ensure_cliente_profile() AS id")).rows[0]
    .id as string;
  const cb = (await asUser(B, "SELECT ensure_cliente_profile() AS id")).rows[0]
    .id as string;
  await t.test(
    "confirmed profile creation is idempotent and isolated",
    async () => {
      assert.equal(
        (await asUser(A, "SELECT ensure_cliente_profile() AS id")).rows[0].id,
        ca,
      );
      assert.deepEqual(
        (await asUser(A, "SELECT id FROM clientes")).rows.map((r) => r.id),
        [ca],
      );
      assert.equal(
        (
          await asUser(
            A,
            "UPDATE clientes SET nombre='other' WHERE id=$1 RETURNING id",
            [cb],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "a customer cannot grant admin rights or paid access",
    async () => {
      await assert.rejects(
        () => asUser(A, "SELECT assign_admin_role('a@example.test')"),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          asUser(A, "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [
            A,
          ]),
        /row-level security/,
      );
      await assert.rejects(
        () =>
          asUser(
            A,
            "UPDATE clientes SET tipo_suscripcion='investor_platino' WHERE id=$1",
            [ca],
          ),
        /Only an operator/,
      );
      await assert.rejects(
        () =>
          asUser(A, "UPDATE clientes SET matchings_usados_mes=-1 WHERE id=$1", [
            ca,
          ]),
        /Only an operator/,
      );
      await assert.rejects(
        () =>
          asUser(
            A,
            "INSERT INTO stripe_customers(user_id,stripe_customer_id) VALUES($1,'cus_forged')",
            [A],
          ),
        /row-level security/,
      );
    },
  );
  await t.test(
    "ordinary customers cannot mutate raw data or read other client feedback",
    async () => {
      await assert.rejects(
        () =>
          asUser(
            A,
            "INSERT INTO propiedades_raw(external_id,portal_origen,url,raw_data) VALUES('pisos-x','pisos','https://www.pisos.com/x','{}')",
          ),
        /row-level security/,
      );
      assert.equal(
        (await asUser(A, "SELECT * FROM propiedades_raw")).rows.length,
        0,
      );
      assert.equal(
        (
          await asUser(
            A,
            "SELECT * FROM matching_feedback WHERE cliente_id=$1",
            [cb],
          )
        ).rows.length,
        0,
      );
    },
  );
  const prop = (
    await db.query(
      "INSERT INTO propiedades(external_id,portal_origen,titulo,precio,ubicacion,tipo_propiedad,url) VALUES('pisos-1','pisos','Fixture',150000,'Madrid','piso','https://www.pisos.com/1') RETURNING id",
    )
  ).rows[0].id;
  const m = (
    await db.query(
      "INSERT INTO matchings(cliente_id,propiedad_id,score) VALUES($1,$2,80) RETURNING id",
      [ca, prop],
    )
  ).rows[0].id;
  await t.test(
    "favorites work but scoring and ownership are immutable to clients",
    async () => {
      assert.equal(
        (
          await asUser(
            A,
            "UPDATE matchings SET favorito=true WHERE id=$1 RETURNING favorito",
            [m],
          )
        ).rows[0].favorito,
        true,
      );
      await assert.rejects(
        () => asUser(A, "UPDATE matchings SET score=100 WHERE id=$1", [m]),
        /Only seen/,
      );
      assert.equal((await asUser(B, "SELECT * FROM matchings")).rows.length, 0);
      await assert.rejects(
        () =>
          asUser(
            B,
            "INSERT INTO matching_feedback(matching_id,cliente_id,propiedad_id,feedback_type) VALUES($1,$2,$3,'relevante')",
            [m, cb, prop],
          ),
        /row-level security/,
      );
    },
  );
  await t.test(
    "raw ingestion is idempotent, records changed prices and invalidates stale normalized data",
    async () => {
      const ingest = (raw: object) =>
        db.query(
          "SELECT ingest_raw_property('pisos-1','pisos','https://www.pisos.com/1',$1::jsonb) AS outcome",
          [JSON.stringify(raw)],
        );
      assert.equal(
        (await ingest({ price: 150000 })).rows[0].outcome,
        "inserted",
      );
      await db.exec("UPDATE propiedades_raw SET procesado=true");
      assert.equal(
        (await ingest({ price: 150000 })).rows[0].outcome,
        "unchanged",
      );
      assert.equal(
        (await ingest({ price: 140000 })).rows[0].outcome,
        "updated",
      );
      assert.equal(
        (await db.query("SELECT activo FROM propiedades WHERE id=$1", [prop]))
          .rows[0].activo,
        false,
      );
      assert.equal(
        (await db.query("SELECT procesado FROM propiedades_raw")).rows[0]
          .procesado,
        false,
      );
      assert.equal(
        (await ingest({ price: 140000 })).rows[0].outcome,
        "unchanged",
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM propiedades_raw"))
          .rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "processing leases exclude overlap and cannot be released by another owner",
    async () => {
      const lock = (
        await db.query("SELECT acquire_processing_lock('batch') AS token")
      ).rows[0].token;
      assert.equal(
        (await db.query("SELECT acquire_processing_lock('batch') AS token"))
          .rows[0].token,
        null,
      );
      await db.query("SELECT release_processing_lock('batch',$1)", [A]);
      assert.equal(
        (await db.query("SELECT acquire_processing_lock('batch') AS token"))
          .rows[0].token,
        null,
      );
      await db.query("SELECT release_processing_lock('batch',$1)", [lock]);
      assert.ok(
        (await db.query("SELECT acquire_processing_lock('batch') AS token"))
          .rows[0].token,
      );
    },
  );
  await t.test(
    "normalization commits atomically and rejects an outdated source snapshot",
    async () => {
      await db.exec(
        "UPDATE propiedades_raw SET updated_at='2026-09-20T10:00:00Z'",
      );
      const raw = (
        await db.query(
          "SELECT id,updated_at::text AS version FROM propiedades_raw",
        )
      ).rows[0];
      const complete = (version: unknown, price: number) =>
        db.query("SELECT complete_raw_property($1,$2,$3::jsonb)", [
          raw.id,
          version,
          JSON.stringify({
            external_id: "forged-id",
            titulo: "Updated fixture",
            ubicacion: "Madrid",
            ciudad: "Madrid",
            tipo_propiedad: "piso",
            precio: price,
          }),
        ]);
      await assert.rejects(
        () => complete("2026-09-19T10:00:00Z", 140000),
        /Source changed/,
      );
      await assert.rejects(() => complete(raw.version, -1), /Invalid property/);
      assert.equal(
        (await db.query("SELECT procesado FROM propiedades_raw")).rows[0]
          .procesado,
        false,
      );
      await complete(raw.version, 140000);
      const normalized = (
        await db.query(
          "SELECT precio,activo,external_id FROM propiedades WHERE id=$1",
          [prop],
        )
      ).rows[0];
      assert.equal(Number(normalized.precio), 140000);
      assert.equal(normalized.activo, true);
      assert.equal(normalized.external_id, "pisos-1");
      assert.equal(
        (await db.query("SELECT procesado FROM propiedades_raw")).rows[0]
          .procesado,
        true,
      );
      await assert.rejects(
        () =>
          asUser(A, "SELECT complete_raw_property($1,$2,$3::jsonb)", [
            raw.id,
            raw.version,
            "{}",
          ]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "changing a search invalidates recommendations without deleting favorites",
    async () => {
      await db.query("UPDATE matchings SET score=100 WHERE id=$1", [m]);
      await asUser(
        A,
        "UPDATE clientes SET presupuesto_max=100000 WHERE id=$1",
        [ca],
      );
      assert.deepEqual(
        (
          await db.query("SELECT score,favorito FROM matchings WHERE id=$1", [
            m,
          ])
        ).rows.map((r) => [Number(r.score), r.favorito]),
        [[0, true]],
      );
      await db.query("UPDATE matchings SET score=100 WHERE id=$1", [m]);
      await asUser(
        A,
        "INSERT INTO criterios_busqueda(cliente_id,ubicaciones) VALUES($1,ARRAY['Barcelona'])",
        [ca],
      );
      assert.equal(
        Number(
          (await db.query("SELECT score FROM matchings WHERE id=$1", [m]))
            .rows[0].score,
        ),
        0,
      );
    },
  );
  await t.test(
    "billing updates are atomic, cannot be called by a customer and remove cancelled access",
    async () => {
      await db.query(
        "INSERT INTO stripe_customers(user_id,stripe_customer_id) VALUES($1,'cus_fixture')",
        [A],
      );
      await assert.rejects(
        () =>
          asUser(
            A,
            "SELECT sync_customer_subscription('cus_fixture','sub_1','active','investor',now()+interval '30 days')",
          ),
        /permission denied/,
      );
      await db.exec(
        "SELECT sync_customer_subscription('cus_fixture','sub_1','active','investor',now()+interval '30 days')",
      );
      assert.equal(
        (
          await db.query("SELECT tipo_suscripcion FROM clientes WHERE id=$1", [
            ca,
          ])
        ).rows[0].tipo_suscripcion,
        "investor",
      );
      await db.exec(
        "SELECT sync_customer_subscription('cus_fixture','sub_1','canceled','investor',now()+interval '30 days')",
      );
      assert.equal(
        (
          await db.query("SELECT tipo_suscripcion FROM clientes WHERE id=$1", [
            ca,
          ])
        ).rows[0].tipo_suscripcion,
        "free",
      );
      await db.exec(
        "SELECT sync_customer_subscription('cus_fixture','sub_1','active','investor',now()-interval '1 day')",
      );
      assert.equal(
        (
          await db.query("SELECT tipo_suscripcion FROM clientes WHERE id=$1", [
            ca,
          ])
        ).rows[0].tipo_suscripcion,
        "free",
      );
      assert.equal(
        (
          await db.query("SELECT tipo_suscripcion FROM clientes WHERE id=$1", [
            cb,
          ])
        ).rows[0].tipo_suscripcion,
        "free",
      );
    },
  );

  await t.test(
    "profile and criteria save atomically; stale tabs and invalid criteria cannot overwrite a search",
    async () => {
      const version = (
        await db.query("SELECT version FROM search_state WHERE cliente_id=$1", [
          ca,
        ])
      ).rows[0].version;
      const profile = {
        perfil: "vivir",
        presupuesto_min: 100000,
        presupuesto_max: 200000,
        tipo_suscripcion: "investor_platino",
      };
      const criteria = {
        ubicaciones: ["Madrid"],
        banos_min: 2,
        flexibilidad_presupuesto: 0,
        preferences: { tiene_parking: true },
      };
      const save = (p: object, k: object, v: unknown) =>
        asUser(A, "SELECT save_client_search($1,$2,$3) AS result", [
          JSON.stringify(p),
          JSON.stringify(k),
          v,
        ]);
      await assert.rejects(
        () =>
          save(
            profile,
            { ...criteria, metros_min: 100, metros_max: 50 },
            version,
          ),
        /commercial_area_range/,
      );
      assert.equal(
        Number(
          (
            await db.query("SELECT presupuesto_max FROM clientes WHERE id=$1", [
              ca,
            ])
          ).rows[0].presupuesto_max,
        ),
        100000,
      );
      const result = (await save(profile, criteria, version)).rows[0]
        .result as any;
      assert.ok(Number(result.version) > Number(version));
      assert.equal(
        (
          await db.query("SELECT tipo_suscripcion FROM clientes WHERE id=$1", [
            ca,
          ])
        ).rows[0].tipo_suscripcion,
        "free",
      );
      await assert.rejects(
        () => save({ ...profile, presupuesto_max: 999999 }, criteria, version),
        /another session/,
      );
      assert.equal(
        (
          await asUser(B, "SELECT * FROM search_versions WHERE cliente_id=$1", [
            ca,
          ])
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "ingestion batches are atomic and idempotent even after a lost acknowledgement",
    async () => {
      const key = "a".repeat(64),
        job = "00000000-0000-4000-8000-000000000111";
      const records = [
        {
          external_id: "pisos-batch1",
          portal_origen: "pisos",
          url: "https://www.pisos.com/batch1",
          raw_data: { price: 120000 },
        },
      ];
      const ingest = (id: string, r: any[]) =>
        db.query("SELECT ingest_listing_batch($1,$2,$3,$4) AS n", [
          id,
          job,
          "pisos",
          JSON.stringify(r),
        ]);
      assert.equal((await ingest(key, records)).rows[0].n, 1);
      assert.equal((await ingest(key, records)).rows[0].n, 1);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM ingestion_batches WHERE id=$1",
            [key],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        () => ingest(key, [{ ...records[0], raw_data: { price: 999 } }]),
        /Idempotency conflict/,
      );
      await assert.rejects(
        () =>
          ingest("b".repeat(64), [
            { ...records[0], external_id: "pisos-rolledback" },
            {
              ...records[0],
              external_id: "pisos-invalid",
              url: "https://evil.example/",
            },
          ]),
        /Invalid listing origin/,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM propiedades_raw WHERE external_id='pisos-rolledback'",
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        () =>
          asUser(A, "SELECT ingest_listing_batch($1,$2,$3,$4)", [
            key,
            job,
            "pisos",
            JSON.stringify(records),
          ]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "an older capture cannot restore an outdated price; observation versions retain evidence",
    async () => {
      const newer = {
        price: 130000,
        _evidence: {
          observed_at: "2026-01-02T10:00:00Z",
          adapter_version: "fixture-v2",
          fields: { precio: "price" },
        },
      };
      await db.query(
        "SELECT ingest_raw_property('pisos-time','pisos','https://www.pisos.com/time',$1)",
        [JSON.stringify(newer)],
      );
      const stale = await db.query(
        "SELECT ingest_raw_property('pisos-time','pisos','https://www.pisos.com/time',$1) AS result",
        [
          JSON.stringify({
            ...newer,
            price: 180000,
            _evidence: {
              ...newer._evidence,
              observed_at: "2026-01-01T10:00:00Z",
            },
          }),
        ],
      );
      assert.equal(stale.rows[0].result, "stale");
      const raw = (
        await db.query(
          "SELECT id,updated_at FROM propiedades_raw WHERE external_id='pisos-time'",
        )
      ).rows[0];
      await db.query("SELECT complete_raw_property($1,$2,$3)", [
        raw.id,
        raw.updated_at,
        JSON.stringify({
          titulo: "Fixture temporal",
          precio: 130000,
          ubicacion: "Madrid",
          ciudad: "Madrid",
          tipo_propiedad: "piso",
        }),
      ]);
      await db.query("DELETE FROM propiedades_raw WHERE id=$1", [raw.id]);
      const afterRetention = await db.query(
        "SELECT ingest_raw_property('pisos-time','pisos','https://www.pisos.com/time',$1) AS result",
        [
          JSON.stringify({
            ...newer,
            price: 180000,
            _evidence: {
              ...newer._evidence,
              observed_at: "2026-01-01T10:00:00Z",
            },
          }),
        ],
      );
      assert.equal(afterRetention.rows[0].result, "stale");
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM propiedades_raw WHERE external_id='pisos-time'",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT precio FROM propiedades WHERE external_id='pisos-time'",
            )
          ).rows[0].precio,
        ),
        130000,
      );
      await db.query("UPDATE propiedades SET precio=130000 WHERE id=$1", [
        prop,
      ]);
      const observed = (
        await db.query(
          "SELECT facts,evidence FROM listing_observations WHERE propiedad_id=$1 ORDER BY version DESC LIMIT 1",
          [prop],
        )
      ).rows[0];
      assert.equal((observed.facts as any).precio, 130000);
      assert.ok(
        (
          await db.query(
            "SELECT id FROM property_events WHERE propiedad_id=$1 AND kind='price_drop'",
            [prop],
          )
        ).rows.length,
      );
    },
  );
  await t.test(
    "matching publication rejects stale versions and preserves favorites and notifications across retries",
    async () => {
      const snapshot = async () => ({
        state: (
          await db.query(
            "SELECT version FROM search_state WHERE cliente_id=$1",
            [ca],
          )
        ).rows[0].version,
        generation: (
          await db.query(
            "SELECT generation FROM matching_queue WHERE cliente_id=$1",
            [ca],
          )
        ).rows[0].generation,
        property: (
          await db.query("SELECT data_version FROM propiedades WHERE id=$1", [
            prop,
          ])
        ).rows[0].data_version,
      });
      const input = await snapshot();
      const rows = [
        {
          propiedad_id: prop,
          property_version: input.property,
          score: 95,
          criterios_cumplidos: { presupuesto: true },
        },
      ];
      const publish = (v: unknown, g: unknown) =>
        db.query("SELECT publish_matching($1,$2,$3,$4)", [
          ca,
          v,
          g,
          JSON.stringify(rows),
        ]);
      await db.query("UPDATE propiedades SET precio=129000 WHERE id=$1", [
        prop,
      ]);
      await assert.rejects(
        () => publish(input.state, input.generation),
        /snapshot changed/,
      );
      const updated = await snapshot();
      rows[0].property_version = updated.property;
      await publish(updated.state, updated.generation);
      assert.equal(
        (await db.query("SELECT favorito FROM matchings WHERE id=$1", [m]))
          .rows[0].favorito,
        true,
      );
      const notifications = (
        await db.query(
          "SELECT count(*)::int n FROM notifications WHERE user_id=$1",
          [A],
        )
      ).rows[0].n;
      await db.query("SELECT queue_matching($1,'test')", [ca]);
      await publish(updated.state, (await snapshot()).generation);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM notifications WHERE user_id=$1",
            [A],
          )
        ).rows[0].n,
        notifications,
      );
      await assert.rejects(
        () =>
          asUser(A, "SELECT publish_matching($1,$2,$3,$4)", [
            ca,
            updated.state,
            updated.generation,
            "[]",
          ]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "notes, scenario history and notification updates are isolated per user",
    async () => {
      await asUser(
        A,
        "INSERT INTO property_decisions(user_id,propiedad_id,stage,note) VALUES($1,$2,'visit','Private note')",
        [A, prop],
      );
      assert.equal(
        (await asUser(B, "SELECT * FROM property_decisions")).rows.length,
        0,
      );
      assert.equal(
        (
          await asUser(
            B,
            "UPDATE property_decisions SET note='hacked' WHERE user_id=$1 RETURNING *",
            [A],
          )
        ).rows.length,
        0,
      );
      const scenario = (
        await asUser(
          A,
          "INSERT INTO investment_scenarios(user_id,propiedad_id,name,inputs) VALUES($1,$2,'Central',jsonb_build_object('purchase',130000)) RETURNING id",
          [A, prop],
        )
      ).rows[0].id;
      await asUser(
        A,
        "UPDATE investment_scenarios SET inputs=jsonb_build_object('purchase',120000),version=999 WHERE id=$1",
        [scenario],
      );
      assert.deepEqual(
        (
          await asUser(
            A,
            "SELECT version FROM scenario_versions WHERE scenario_id=$1 ORDER BY version",
            [scenario],
          )
        ).rows.map((r) => r.version),
        [1, 2],
      );
      assert.equal(
        (await asUser(B, "SELECT * FROM scenario_versions")).rows.length,
        0,
      );
      const n = (await asUser(A, "SELECT id FROM notifications LIMIT 1"))
        .rows[0].id;
      await asUser(A, "UPDATE notifications SET read_at=now() WHERE id=$1", [
        n,
      ]);
      await assert.rejects(
        () =>
          asUser(A, "UPDATE notifications SET title='forged' WHERE id=$1", [n]),
        /permission denied/,
      );
      assert.equal(
        (await asUser(B, "SELECT * FROM notifications")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "identity changes are explicit, reversible and audited; customers cannot merge listings",
    async () => {
      await assert.rejects(
        () =>
          asUser(A, "SELECT link_listing($1,NULL,'separate incorrect group')", [
            prop,
          ]),
        /Operator required/,
      );
      await db.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
        [B],
      );
      const old = (
        await db.query("SELECT canonical_id FROM propiedades WHERE id=$1", [
          prop,
        ])
      ).rows[0].canonical_id;
      const newId = (
        await asUser(
          B,
          "SELECT link_listing($1,NULL,'separate after reviewing evidence') AS id",
          [prop],
        )
      ).rows[0].id;
      assert.notEqual(old, newId);
      await asUser(
        B,
        "SELECT link_listing($1,$2,'restore reviewed original membership')",
        [prop, old],
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM identity_audit WHERE propiedad_id=$1",
            [prop],
          )
        ).rows[0].n,
        2,
      );
      await db.query("DELETE FROM user_roles WHERE user_id=$1", [B]);
    },
  );
  await t.test(
    "shares expose only the selected facts and become unreadable when revoked",
    async () => {
      const second = (
        await db.query(
          "INSERT INTO propiedades(external_id,portal_origen,titulo,precio,ubicacion,tipo_propiedad,url) VALUES('pisos-share','pisos','Shared',140000,'Madrid','piso','https://www.pisos.com/share') RETURNING id",
        )
      ).rows[0].id;
      await db.query(
        "INSERT INTO matchings(cliente_id,propiedad_id,score) VALUES($1,$2,90)",
        [ca, second],
      );
      const share = (
        await asUser(A, "SELECT create_shared_selection($1::uuid[]) AS data", [
          [prop, second],
        ])
      ).rows[0].data as any;
      await db.exec("BEGIN;SET LOCAL ROLE anon;");
      const payload = (
        await db.query("SELECT read_shared_selection($1) AS data", [
          share.token,
        ])
      ).rows[0].data;
      await db.exec("COMMIT");
      assert.equal((payload as any).items.length, 2);
      assert.ok(!JSON.stringify(payload).includes("Private note"));
      await asUser(A, "UPDATE shared_selections SET revoked=true WHERE id=$1", [
        share.id,
      ]);
      assert.equal(
        (
          await db.query("SELECT read_shared_selection($1) AS data", [
            share.token,
          ])
        ).rows[0].data,
        null,
      );
    },
  );
  await t.test(
    "usage reservations are idempotent, uncertain cost stays reserved, and clients cannot raise budgets",
    async () => {
      await db.query(
        "INSERT INTO usage_budgets(user_id,day,kind,limit_units) VALUES($1,(now() AT TIME ZONE 'UTC')::date,'ai_microeur',100)",
        [A],
      );
      const reserve = (key: string, n: number) =>
        db.query("SELECT reserve_usage($1,$2,'ai_microeur',$3) AS id", [
          A,
          key,
          n,
        ]);
      const id = (await reserve("first", 70)).rows[0].id;
      assert.equal((await reserve("first", 70)).rows[0].id, id);
      await db.query("SELECT settle_usage($1,'uncertain')", [id]);
      await assert.rejects(() => reserve("second", 40), /Usage limit/);
      await db.query("SELECT settle_usage($1,'charged',50)", [id]);
      await db.query("SELECT settle_usage($1,'charged',50)", [id]);
      await reserve("second", 40);
      const budget = (
        await db.query(
          "SELECT reserved_units,spent_units FROM usage_budgets WHERE user_id=$1",
          [A],
        )
      ).rows[0];
      assert.equal(Number(budget.reserved_units), 40);
      assert.equal(Number(budget.spent_units), 50);
      await assert.rejects(
        () =>
          asUser(
            A,
            "UPDATE usage_budgets SET limit_units=999999 WHERE user_id=$1",
            [A],
          ),
        /permission denied/,
      );
    },
  );
  await t.test(
    "email digest persists its payload; quiet hours and opt-out apply before delivery claims",
    async () => {
      await asUser(
        A,
        "INSERT INTO notification_preferences(user_id,email_enabled,quiet_start,quiet_end) VALUES($1,true,0,0)",
        [A],
      );
      const notification = (
        await db.query(
          "INSERT INTO notifications(user_id,propiedad_id,event_kind,event_version,title,details) VALUES($1,$2,'test',123,'Fixture notice','{}') RETURNING id",
          [A, prop],
        )
      ).rows[0].id;
      await db.query(
        "INSERT INTO notification_email_queue(notification_id) VALUES($1)",
        [notification],
      );
      assert.equal(
        (
          await db.query(
            "SELECT prepare_email_outbox('Findoo <test@example.test>','https://example.test') AS n",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            "SELECT prepare_email_outbox('Findoo <test@example.test>','https://example.test') AS n",
          )
        ).rows[0].n,
        0,
      );
      const delivery = (await db.query("SELECT * FROM claim_email_delivery()"))
        .rows[0];
      assert.equal(delivery.status, "sending");
      await db.query("SELECT finish_email_delivery($1,$2,'uncertain',NULL)", [
        delivery.id,
        delivery.attempts,
      ]);
      await asUser(
        A,
        "UPDATE notification_preferences SET enabled=false WHERE user_id=$1",
        [A],
      );
      assert.equal(
        (await db.query("SELECT * FROM claim_email_delivery()")).rows[0].id,
        null,
      );
      assert.equal(
        (
          await db.query(
            "SELECT status FROM notification_deliveries WHERE id=$1",
            [delivery.id],
          )
        ).rows[0].status,
        "suppressed",
      );
      await asUser(
        A,
        "UPDATE notification_preferences SET enabled=true,quiet_start=22,quiet_end=8 WHERE user_id=$1",
        [A],
      );
      assert.equal(
        (
          await db.query(
            "SELECT email_allowed($1,'2026-03-29T01:30:00Z') AS ok",
            [A],
          )
        ).rows[0].ok,
        false,
      );
      assert.equal(
        (
          await db.query(
            "SELECT email_allowed($1,'2026-03-29T10:00:00Z') AS ok",
            [A],
          )
        ).rows[0].ok,
        true,
      );
    },
  );
  await t.test(
    "operational metrics are private and stale observations never erase saved decisions",
    async () => {
      await assert.rejects(
        () => asUser(A, "SELECT operating_metrics()"),
        /Operator required/,
      );
      await assert.rejects(
        () =>
          asUser(
            A,
            "INSERT INTO operating_cost_entries(period_start,period_end,category,amount_eur,basis,reference) VALUES(current_date,current_date,'browser',1,'estimate','fixture')",
          ),
        /row-level security/,
      );
      await db.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
        [B],
      );
      const metrics = (await asUser(B, "SELECT operating_metrics() AS data"))
        .rows[0].data as any;
      assert.equal(typeof metrics.matching_queue, "number");
      assert.deepEqual(metrics.cost_entries, []);
      await db.query(
        "UPDATE propiedades SET last_seen=now()-interval '20 days' WHERE id=$1",
        [prop],
      );
      await db.query(
        "SELECT * FROM desactivar_propiedades_no_vistas(7,NULL,NULL)",
      );
      assert.equal(
        (
          await db.query("SELECT availability FROM propiedades WHERE id=$1", [
            prop,
          ])
        ).rows[0].availability,
        "not_seen_recently",
      );
      assert.equal(
        (
          await asUser(
            A,
            "SELECT note FROM property_decisions WHERE propiedad_id=$1",
            [prop],
          )
        ).rows[0].note,
        "Private note",
      );
      await db.query("DELETE FROM user_roles WHERE user_id=$1", [B]);
    },
  );
  await t.test(
    "export contains only the owner workspace and account deletion cascades through private tables",
    async () => {
      const exported = (await asUser(A, "SELECT export_my_workspace() AS data"))
        .rows[0].data as any;
      assert.equal(exported.profiles[0].user_id, A);
      assert.equal(exported.decisions[0].note, "Private note");
      assert.ok(exported.scenario_versions.length === 2);
      assert.ok(!JSON.stringify(exported).includes("b@example.test"));
      assert.ok(!JSON.stringify(exported).includes("token_hash"));
      await db.query("DELETE FROM auth.users WHERE id=$1", [A]);
      for (const table of [
        "property_decisions",
        "investment_scenarios",
        "notifications",
        "shared_selections",
        "usage_budgets",
      ])
        assert.equal(
          (
            await db.query(
              `SELECT count(*)::int n FROM ${table} WHERE user_id=$1`,
              [A],
            )
          ).rows[0].n,
          0,
        );
    },
  );
  await db.close();
});
