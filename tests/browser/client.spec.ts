import { test, expect, type Page } from "@playwright/test";

const uid = "00000000-0000-4000-8000-000000000001";
const cid = "00000000-0000-4000-8000-000000000010";
const mid = "00000000-0000-4000-8000-000000000020";
const user = {
  id: uid,
  email: "cliente@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { nombre: "Cliente" },
  created_at: new Date().toISOString(),
};

async function fixture(page: Page, signedIn = true, count = 1) {
  const unexpected: string[] = [],
    writes: { path: string; method: string; body: any }[] = [];
  let favorite = false,
    profileCalls = 0;
  let decision: any = null,
    scenario: any = null,
    revoked = false;
  const properties = Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-00000000004${i}`,
    titulo: i ? "Casa de prueba en Madrid" : "Piso de prueba en Madrid",
    precio: i ? 210000 : 190000,
    ubicacion: "Madrid",
    metros: i ? null : 90,
    dormitorios: 2,
    banos: 2,
    url: "https://www.pisos.com/fixture",
    imagenes: [],
    activo: true,
    portal_origen: "pisos",
    last_seen: new Date().toISOString(),
    data_version: 1,
    evidence: { adapter_version: "fixture-v1", fields: { precio: "price" } },
  }));
  const customer = {
    id: cid,
    perfil: "vivir",
    telefono: "+34612345678",
    presupuesto_min: 100000,
    presupuesto_max: 220000,
  };
  const criteria = {
    id: "00000000-0000-4000-8000-000000000030",
    cliente_id: cid,
    ubicaciones: ["Madrid"],
    flexibilidad_presupuesto: 0,
    banos_min: 2,
    dormitorios_min: 2,
    tiene_ascensor: true,
    tipo_propiedad: ["Piso"],
  };
  if (signedIn) {
    const token = [
      Buffer.from('{"alg":"HS256"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url"),
      "fixture",
    ].join(".");
    await page.addInitScript(
      (session) =>
        localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)),
      {
        access_token: token,
        token_type: "bearer",
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      },
    );
  }
  await page.route("https://fixture.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    const reply = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (method === "OPTIONS") return reply({});
    if (path === "/auth/v1/user") return reply(user);
    if (path === "/auth/v1/recover") {
      writes.push({ path, method, body: req.postDataJSON() });
      return reply({});
    }
    if (path === "/auth/v1/logout") return reply({});
    if (path === "/rest/v1/search_state") return reply({ version: 1 });
    if (path === "/rest/v1/rpc/operating_metrics")
      return reply({
        matching_queue: 0,
        raw_pending: 0,
        raw_review: 0,
        active_searches: 1,
        weekly_relevant_opportunities: 0,
        weekly_observed_listings: 1,
        email_outcomes: {},
        cost_entries: [],
      });
    if (path === "/rest/v1/notifications") return reply([]);
    if (path === "/rest/v1/notification_preferences")
      return reply(method === "GET" ? null : {});
    if (path === "/rest/v1/shared_selections") {
      if (method === "PATCH") revoked = true;
      return reply([]);
    }
    if (path === "/rest/v1/rpc/create_shared_selection")
      return reply({
        id: "00000000-0000-4000-8000-000000000060",
        token: "a".repeat(64),
      });
    if (path === "/rest/v1/rpc/read_shared_selection")
      return reply(revoked ? null : { items: properties });
    if (path === "/rest/v1/rpc/save_client_search") {
      const body = req.postDataJSON();
      writes.push({ path, method, body });
      Object.assign(customer, body.p_profile);
      Object.assign(criteria, body.p_criteria);
      return reply({ id: criteria.id, version: 2, cliente_id: cid });
    }
    if (path === "/rest/v1/propiedades")
      return reply(
        req.headers()["accept"]?.includes("object+json")
          ? properties.find((p) => `eq.${p.id}` === url.searchParams.get("id"))
          : properties,
      );
    if (path === "/rest/v1/listing_observations")
      return reply([
        {
          version: 1,
          observed_at: new Date().toISOString(),
          facts: { precio: 190000 },
        },
      ]);
    if (path === "/rest/v1/property_decisions") {
      if (method === "POST") {
        decision = req.postDataJSON();
        writes.push({ path, method, body: decision });
        return reply(null);
      }
      return reply(
        req.headers()["accept"]?.includes("object+json")
          ? decision
          : decision
            ? [decision]
            : [],
      );
    }
    if (path === "/rest/v1/investment_scenarios") {
      if (method !== "GET") {
        scenario = {
          ...req.postDataJSON(),
          id: "00000000-0000-4000-8000-000000000080",
          version: scenario ? scenario.version + 1 : 1,
        };
        writes.push({ path, method, body: req.postDataJSON() });
      }
      return reply(scenario);
    }
    if (path === "/auth/v1/signup")
      return reply({ ...user, confirmation_sent_at: new Date().toISOString() });
    if (path === "/functions/v1/check-subscription")
      return reply({ subscribed: false, tier: "free", billing_enabled: false });
    if (path === "/rest/v1/rpc/ensure_cliente_profile") {
      profileCalls++;
      return reply(cid);
    }
    if (
      path === "/rest/v1/clientes" ||
      path === "/rest/v1/criterios_busqueda"
    ) {
      const value = path.endsWith("clientes") ? customer : criteria;
      if (method === "PATCH" || method === "POST") {
        const body = req.postDataJSON();
        writes.push({ path, method, body });
        Object.assign(value, body);
      }
      return reply(
        req.headers()["accept"]?.includes("object+json") ? value : [value],
      );
    }
    if (path === "/rest/v1/matchings") {
      if (method === "PATCH") {
        favorite = req.postDataJSON().favorito;
        writes.push({ path, method, body: req.postDataJSON() });
        return reply([{ id: mid }]);
      }
      expect(url.searchParams.get("cliente_id")).toBe(`eq.${cid}`);
      if (!url.searchParams.get("favorito")) {
        expect(url.searchParams.get("propiedad.activo")).toBe("eq.true");
        expect(url.searchParams.get("propiedad.last_seen")).toMatch(/^gte\./);
      }
      return reply(
        url.searchParams.get("favorito") && !favorite
          ? []
          : properties.map((p, i) => ({
              id: i ? "00000000-0000-4000-8000-000000000021" : mid,
              favorito: favorite,
              score: 100,
              criterios_cumplidos: { presupuesto: true, ubicacion: true },
              propiedad: p,
            })),
      );
    }
    unexpected.push(`${method} ${path}`);
    return reply({ error: "Unexpected request in fixture" }, 500);
  });
  return { writes, unexpected, profileCalls: () => profileCalls };
}

test("signup requiring confirmation does not insert a customer before a session exists", async ({
  page,
}) => {
  const state = await fixture(page, false);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "¿No tienes cuenta? Regístrate" })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente Prueba");
  await page.getByLabel("Email", { exact: true }).fill("cliente@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("only-a-test-password");
  await page.getByRole("button", { name: "Crear Cuenta", exact: true }).click();
  await expect(
    page.getByText("Revisa tu correo y confirma la cuenta.", { exact: false }),
  ).toBeVisible();
  expect(state.profileCalls()).toBe(0);
  expect(state.writes).toHaveLength(0);
  expect(state.unexpected).toEqual([]);
});

test("customer sees recommendations, saves a favorite and can reopen the saved search", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await fixture(page);
  await page.goto("/cliente/dashboard");
  await expect(
    page.getByRole("heading", { name: "Tus inmuebles" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Piso de prueba en Madrid" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver anuncio original" }),
  ).toHaveAttribute("href", "https://www.pisos.com/fixture");
  await expect(page.getByRole("button", { name: /Suscribirme/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Guardar favorito", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Quitar de favoritos" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Editar búsqueda" }).click();
  await expect(page.getByLabel("Ciudades, barrios o provincias")).toHaveValue(
    "Madrid",
  );
  await expect(page.getByLabel("Hasta (€)", { exact: true })).toHaveValue(
    "220000",
  );
  await expect(page.getByLabel("Baños mínimos")).toHaveValue("2");
  await expect(page.getByLabel("Ascensor imprescindible")).toBeChecked();
  await page.getByLabel("Hasta (€)", { exact: true }).fill("230000");
  await page.getByRole("button", { name: "Guardar mi búsqueda" }).click();
  await expect(
    page.getByRole("heading", { name: "Tus inmuebles" }),
  ).toBeVisible();
  expect(
    state.writes.find((w) => w.path.endsWith("save_client_search")),
  ).toMatchObject({
    method: "POST",
    body: {
      p_profile: { presupuesto_max: 230000 },
      p_criteria: {
        banos_min: 2,
        flexibilidad_presupuesto: 0,
        tiene_ascensor: true,
      },
      p_expected_version: 1,
    },
  });
  expect(
    state.writes.filter(
      (w) =>
        w.path.endsWith("clientes") || w.path.endsWith("criterios_busqueda"),
    ),
  ).toHaveLength(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("admin inspects captured response and reprocesses it without sending worker credentials", async ({
  page,
}) => {
  await fixture(page);
  const id = "00000000-0000-4000-8000-000000000050",
    captureId = "a".repeat(64);
  const job = {
    id,
    status: "captured",
    error: "adapter_not_configured",
    delivered: 0,
    captures: 1,
    created_at: Date.now(),
    request: {
      source_id: "pisos",
      ubicacion: "Murcia",
      search_urls: ["https://www.pisos.com/venta/pisos-murcia_capital/"],
    },
  };
  const actions: string[] = [];
  await page.route("https://fixture.supabase.co/rest/v1/user_roles*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: '{"role":"admin"}',
    }),
  );
  await page.route(
    "https://fixture.supabase.co/functions/v1/browser-worker",
    async (route) => {
      const body = route.request().postDataJSON();
      actions.push(body.action);
      expect(route.request().headers()["x-scraper-secret"]).toBeUndefined();
      const values: Record<string, unknown> = {
        metrics: {
          sources: [],
          jobs: [],
          captures: { count: 1, bytes: 23 },
          rss_bytes: 1000,
        },
        schedules: { schedules: [] },
        sources: {
          sources: [
            {
              id: "pisos",
              portal: "pisos",
              label: "Pisos.com",
              adapter_version: null,
            },
          ],
        },
        list: { jobs: [job] },
        get: {
          job,
          captures: [
            {
              id: captureId,
              response_url: "https://www.pisos.com/fixture-api",
              page_index: 0,
              mime_type: "text/plain",
              bytes: 23,
              captured_at: Date.now(),
            },
          ],
          preview: [],
          preview_error: "adapter_not_configured",
        },
        capture: {
          capture: {
            body: "",
            text: '{"datoSoloAPI":132456.78}',
            mime_type: "text/plain",
          },
        },
        replay: { success: true, job_id: id },
      };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(values[body.action]),
      });
    },
  );
  await page.goto("/scraper");
  await expect(
    page.getByRole("heading", { name: "Búsquedas con navegador" }),
  ).toBeVisible();
  await expect(page.getByLabel("Fuente", { exact: true })).toHaveValue("pisos");
  await page.getByRole("button", { name: /pisos · Murcia/ }).click();
  await page.getByRole("button", { name: /fixture-api/ }).click();
  await expect(page.getByLabel("Respuesta original")).toContainText(
    "132456.78",
  );
  await page.getByRole("button", { name: "Reprocesar bruto guardado" }).click();
  await expect
    .poll(() => actions.filter((action) => action === "replay").length)
    .toBe(1);
  expect(actions).not.toContain("create");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("customer saves a private visit note and retrieves a versioned investment scenario", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/cliente/dashboard");
  await page.getByRole("button", { name: "Ver ficha", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Piso de prueba en Madrid" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Mi seguimiento", exact: true })
    .click();
  await dialog.getByLabel("Estado", { exact: true }).selectOption("visit");
  await dialog
    .getByLabel("Notas y preguntas para la visita")
    .fill("Confirmar el estado del ascensor");
  await dialog.getByRole("button", { name: "Guardar seguimiento" }).click();
  await expect(
    page.getByText("Seguimiento guardado", { exact: true }),
  ).toBeVisible();
  expect(
    state.writes.find((w) => w.path.endsWith("property_decisions"))?.body.note,
  ).toBe("Confirmar el estado del ascensor");
  await dialog.getByRole("button", { name: "Inversión", exact: true }).click();
  const inputs = {
    "Gastos de adquisición (€)": "15000",
    "Reforma (€)": "10000",
    "Mobiliario (€)": "5000",
    "Préstamo (€)": "100000",
    "Interés nominal anual (%)": "3",
    "Plazo del préstamo (años)": "25",
    "Alquiler mensual supuesto (€)": "1000",
    "Vacancia (%)": "10",
    "Impago sobre renta ocupada (%)": "0",
    "Gastos operativos anuales (€)": "2000",
    "Reserva anual de reposiciones (€)": "500",
  };
  for (const [label, value] of Object.entries(inputs))
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await expect(
    dialog.getByText("Flujo anual antes de impuestos personales", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Guardar escenario", exact: true })
    .click();
  await expect(
    page.getByText("Escenario guardado · versión 1", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Alquiler mensual supuesto (€)", { exact: true })
    .fill("1500");
  await dialog.getByRole("button", { name: "Recuperar guardado" }).click();
  await expect(
    dialog.getByLabel("Alquiler mensual supuesto (€)", { exact: true }),
  ).toHaveValue("1000");
  expect(state.unexpected).toEqual([]);
});
test("comparison preserves unknown values, downloads a PDF and creates a share without private notes", async ({
  page,
}, testInfo) => {
  const state = await fixture(page, true, 2);
  await page.goto("/cliente/dashboard");
  await page
    .getByRole("button", { name: "Comparar", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Comparador · 2/4" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Sin datos", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar dossier PDF" }).click();
  const file = await download;
  await file.saveAs(testInfo.outputPath("comparison.pdf"));
  expect(file.suggestedFilename()).toBe("comparacion-findoo.pdf");
  await page.getByRole("button", { name: "Compartir durante 7 días" }).click();
  await expect(page.getByLabel("Enlace de selección")).toHaveValue(
    new RegExp("/seleccion/a{64}$"),
  );
  await page.goto(`/seleccion/${"a".repeat(64)}`);
  await expect(
    page.getByRole("heading", { name: "Selección compartida" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Piso de prueba en Madrid" }),
  ).toBeVisible();
  await expect(page.getByText("Confirmar el estado del ascensor")).toHaveCount(
    0,
  );
  expect(state.unexpected).toEqual([]);
});
test("a concurrent search edit shows a conflict and never navigates away claiming success", async ({
  page,
}) => {
  await fixture(page);
  await page.route(
    "https://fixture.supabase.co/rest/v1/rpc/save_client_search",
    (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: "40001",
          message: "Search changed in another session",
        }),
      }),
  );
  await page.goto("/cliente/onboarding");
  await page.getByLabel("Hasta (€)", { exact: true }).fill("240000");
  await page.getByRole("button", { name: "Guardar mi búsqueda" }).click();
  await expect(
    page.getByText(
      "La búsqueda cambió en otra sesión. Recarga antes de guardar.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/onboarding/);
});
test("forgotten password uses the configured recovery route and neutral account response", async ({
  page,
}) => {
  const state = await fixture(page, false);
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("cliente@example.test");
  await page.getByRole("button", { name: "He olvidado mi contraseña" }).click();
  await expect(
    page.getByText(
      "Si la cuenta puede recuperarse, recibirás un enlace por correo.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    state.writes.find((w) => w.path === "/auth/v1/recover")?.body.email,
  ).toBe("cliente@example.test");
  expect(state.unexpected).toEqual([]);
});

test("an unfinished search draft survives reload without overwriting the server", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/cliente/onboarding");
  await expect(page.getByLabel("Hasta (€)", { exact: true })).toHaveValue(
    "220000",
  );
  await page.getByLabel("Hasta (€)", { exact: true }).fill("185000");
  await page.reload();
  await expect(page.getByLabel("Hasta (€)", { exact: true })).toHaveValue(
    "185000",
  );
  await expect(
    page.getByText("Hemos recuperado tus cambios pendientes de esta pestaña.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar mi búsqueda", exact: true })
    .click();
  await expect(page).toHaveURL(/cliente\/dashboard/);
  expect(
    state.writes.find((w) => w.path.endsWith("save_client_search"))?.body
      .p_profile.presupuesto_max,
  ).toBe(185000);
  expect(state.unexpected).toEqual([]);
});
