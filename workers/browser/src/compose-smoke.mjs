// Runs only against the isolated CI Compose project; never visits a portal.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
const headers = {
  Authorization: `Bearer ${process.env.SCRAPER_API_KEY}`,
  "Content-Type": "application/json",
};
async function api(path, body) {
  const r = await fetch(`http://127.0.0.1:8000${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(r.ok, `API ${path}: ${r.status}`);
  return r.json();
}
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
try {
  const page = await browser.contexts()[0].newPage();
  await page.setContent("<title>Isolated Compose check</title>");
  assert.equal(await page.title(), "Isolated Compose check");
  await page.close();
} finally {
  await browser.close();
}
if (process.argv.includes("--verify")) {
  const id = readFileSync("data/ci-job-id", "utf8");
  const job = await api(`/jobs/${id}`);
  assert.equal(job.job.status, "queued");
  assert.equal(
    (await api("/metrics")).sources.find((s) => s.id === "pisos").paused,
    1,
  );
  await api(`/jobs/${id}/cancel`, {});
  console.log("compose_restart_and_persistence_ok");
} else {
  await api("/sources/pisos/pause", {});
  const result = await api("/jobs", {
    source_id: "pisos",
    search_urls: ["https://www.pisos.com/venta/pisos-murcia_capital/"],
    ubicacion: "CI fixture: paused, no navigation",
  });
  writeFileSync("data/ci-job-id", result.job_id, { mode: 0o600 });
  console.log("compose_private_cdp_and_queue_ok");
}
