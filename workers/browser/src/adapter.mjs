import { WorkerError, safeUrl } from "./config.mjs";
import { normalizeListing } from "../../../supabase/functions/_shared/listing-core.mjs";

function at(value, path) {
  if (path === "$") return value;
  if (!path || typeof path !== "string") return undefined;
  return path
    .split(".")
    .reduce(
      (node, key) =>
        node != null &&
        Object.hasOwn(Object(node), key) &&
        !["__proto__", "constructor", "prototype"].includes(key)
          ? node[key]
          : undefined,
      value,
    );
}
export function responseText(capture) {
  if (typeof capture === "string") return capture;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.from(
        capture.body,
        capture.body_encoding === "base64" ? "base64" : "utf8",
      ),
    );
  } catch {
    throw new WorkerError("response_not_utf8");
  }
}
export function analyzeCapture(capture, source) {
  const adapter = source.adapter;
  if (!adapter) throw new WorkerError("adapter_not_configured");
  if (adapter.currency !== "EUR")
    throw new WorkerError("currency_contract_missing");
  const body = responseText(capture);
  const format = adapter.format ?? "json";
  if (!["json", "ndjson"].includes(format))
    throw new WorkerError("decoder_not_configured");
  let payload;
  try {
    payload =
      format === "json"
        ? JSON.parse(body)
        : body
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));
  } catch {
    throw new WorkerError("invalid_json");
  }
  const items = at(payload, adapter.items_path);
  if (!Array.isArray(items) || items.length > 500)
    throw new WorkerError("schema_changed");
  const unique = new Map(),
    rejections = [];
  for (const [index, item] of items.entries()) {
    try {
      const id = at(item, adapter.id_path);
      const href = at(item, adapter.url_path);
      if (
        !["string", "number"].includes(typeof id) ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(String(id)) ||
        typeof href !== "string" ||
        !href
      )
        throw new WorkerError("listing_identity_missing");
      let url;
      try {
        url = safeUrl(
          new URL(href, source.navigation_origins[0]).href,
          source.navigation_origins,
        );
      } catch {
        throw new WorkerError("listing_url_invalid");
      }
      const normalized = {};
      for (const [field, path] of Object.entries(adapter.fields)) {
        const value = at(item, path);
        normalized[field] = adapter.value_maps?.[field]
          ? (adapter.value_maps[field][String(value)] ?? null)
          : (value ?? null);
      }
      const row = {
        external_id: `${source.portal}-${id}`,
        portal_origen: source.portal,
        url,
        raw_data: {
          _capture_version: 1,
          source_record: item,
          normalized,
          _evidence: {
            source_id: source.id,
            adapter_version: adapter.version,
            capture_id: capture.id ?? null,
            body_sha256: capture.body_sha256 ?? null,
            observed_at: capture.captured_at
              ? new Date(capture.captured_at).toISOString()
              : null,
            response_url: capture.response_url ?? null,
            fields: adapter.fields,
            record_index: index,
            currency: adapter.currency,
          },
        },
      };
      try {
        normalizeListing(row);
      } catch {
        throw new WorkerError("listing_requires_review");
      }
      if (Buffer.byteLength(JSON.stringify(row)) > 400000)
        throw new WorkerError("listing_too_large");
      unique.set(row.external_id, row);
    } catch (error) {
      rejections.push({
        capture_id: capture.id ?? "preview",
        record_index: index,
        code:
          error instanceof WorkerError ? error.code : "listing_requires_review",
      });
    }
  }
  return { records: [...unique.values()], rejections };
}
// Strict single-capture API retained for adapter acceptance tests.
export function decodeCapture(capture, source) {
  const result = analyzeCapture(capture, source);
  if (result.rejections.length)
    throw new WorkerError(result.rejections[0].code);
  return result.records;
}
export function analyzeCaptures(captures, source) {
  const records = new Map(),
    rejections = [];
  for (const capture of captures) {
    const result = analyzeCapture(capture, source);
    for (const row of result.records) records.set(row.external_id, row);
    rejections.push(...result.rejections);
  }
  return { records: [...records.values()], rejections };
}
export function previewCaptures(captures, source) {
  return analyzeCaptures(captures, source).records;
}
