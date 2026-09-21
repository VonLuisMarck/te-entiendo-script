import { readFileSync } from 'node:fs';

export class WorkerError extends Error {
  constructor(code, status = 422) { super(code); this.code = code; this.status = status; }
}
export function safeUrl(value, origins) {
  let url;
  try { url = new URL(value); } catch { throw new WorkerError('invalid_url', 400); }
  if (url.username || url.password || !origins.includes(url.origin) || !['https:', 'http:'].includes(url.protocol)) throw new WorkerError('url_not_allowed', 400);
  url.hash = '';
  return url.href;
}
export function loadSources(path) {
  const sources = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(sources) || !sources.length) throw new WorkerError('sources_not_configured', 503);
  const ids = new Set();
  for (const source of sources) {
    const domain = { fotocasa: 'fotocasa.es', pisos: 'pisos.com' }[source.portal];
    if (!domain || !/^[a-z0-9-]{1,60}$/.test(source.id) || ids.has(source.id)) throw new WorkerError('invalid_source_config', 503);
    ids.add(source.id);
    if (!Array.isArray(source.navigation_origins) || !source.navigation_origins.length || !Array.isArray(source.responses) || !source.responses.length) throw new WorkerError('invalid_source_config', 503);
    for (const origin of source.navigation_origins) {
      if (![ `https://${domain}`, `https://www.${domain}` ].includes(origin)) throw new WorkerError('invalid_navigation_origin', 503);
    }
    for (const rule of source.responses) {
      const url = new URL(rule.origin);
      if (url.protocol !== 'https:' || url.origin !== rule.origin || !(url.hostname === domain || url.hostname.endsWith(`.${domain}`)) || !rule.path_prefix?.startsWith('/')) throw new WorkerError('invalid_response_rule', 503);
      if (rule.resource_types && (!Array.isArray(rule.resource_types) || !rule.resource_types.length || rule.resource_types.some(type=>!['xhr','fetch','document','script'].includes(type)))) throw new WorkerError('invalid_resource_types',503);
    }
    if (source.adapter && (!source.adapter.version || !source.adapter.items_path || !source.adapter.fields)) throw new WorkerError('invalid_adapter_config', 503);
    if ((source.actions ?? []).some(action => !['click', 'fill'].includes(action.type) || !action.role || typeof action.name !== 'string')) throw new WorkerError('invalid_action_config', 503);
  }
  return sources;
}
export function validateJob(input, sources) {
  const source = sources.find(source => source.id === input.source_id);
  if (!source) throw new WorkerError('unknown_source', 400);
  if (!Array.isArray(input.search_urls) || input.search_urls.length < 1 || input.search_urls.length > 5) throw new WorkerError('provide_one_to_five_search_urls', 400);
  const search_urls = [...new Set(input.search_urls.map(value => safeUrl(value, source.navigation_origins)))];
  if (search_urls.some(value => value.length > 2048)) throw new WorkerError('url_too_long', 400);
  return { source_id: source.id, portal: source.portal, search_urls, ubicacion: typeof input.ubicacion === 'string' ? input.ubicacion.trim().slice(0,120) : '' };
}
export function matchesResponse(url, source, resourceType) {
  try {
    const u = new URL(url);
    return source.responses.some(rule => u.origin === rule.origin && u.pathname.startsWith(rule.path_prefix) && (!resourceType || (rule.resource_types ?? ['xhr','fetch']).includes(resourceType)));
  } catch { return false; }
}
export function safeResponseUrl(value) { const u = new URL(value); return u.origin + u.pathname; }
