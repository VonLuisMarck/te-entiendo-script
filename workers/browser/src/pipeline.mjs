// Separate trusted process. No CDP access or credentials in the browser client.
import { setTimeout as delay } from "node:timers/promises";
const base = new URL(process.env.SUPABASE_URL ?? "");
if (
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash
)
  throw new Error("Invalid backend origin");
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("Pipeline service credential required");
const interval = Number(process.env.PIPELINE_INTERVAL_SECONDS ?? 60);
if (!Number.isFinite(interval) || interval < 30 || interval > 3600)
  throw new Error("Invalid pipeline interval");
const controller = new AbortController();
process.once("SIGTERM", () => controller.abort());
process.once("SIGINT", () => controller.abort());
while (!controller.signal.aborted) {
  for (const [name, body] of [
    ["batch-classify-properties", { batch_size: 50, max_intentos: 3 }],
    ["matching-service", {}],
    ...(process.env.EMAIL_ENABLED === "true"
      ? [["notification-dispatch", {}]]
      : []),
  ]) {
    if (controller.signal.aborted) break;
    const started = Date.now();
    try {
      const response = await fetch(new URL(`/functions/v1/${name}`, base), {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${secret}`,
          apikey: secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45000),
        ]),
      });
      const result = await response.json();
      console.info(
        JSON.stringify({
          component: "pipeline",
          step: name,
          http_status: response.status,
          success: response.ok && result.success === true,
          duration_ms: Date.now() - started,
        }),
      );
    } catch {
      console.error(
        JSON.stringify({
          component: "pipeline",
          step: name,
          status: "uncertain",
          duration_ms: Date.now() - started,
        }),
      );
    }
  }
  if (process.argv.includes("--once")) break;
  await delay(interval * 1000, undefined, { signal: controller.signal }).catch(
    () => {},
  );
}
