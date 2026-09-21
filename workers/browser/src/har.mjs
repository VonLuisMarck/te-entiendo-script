import { WorkerError, matchesResponse, safeResponseUrl } from './config.mjs';

// Only response bodies matching the configured source are imported. Request headers,
// cookies, request bodies and URL query parameters never enter the capture store.
export function capturesFromHar(har, source) {
  const entries=har?.log?.entries;
  if (!Array.isArray(entries)) throw new WorkerError('invalid_har');
  const captures=[];
  for (const entry of entries) {
    const url=entry.request?.url;
    if (!url || !matchesResponse(url,source,entry._resourceType ?? 'xhr')) continue;
    const response=entry.response;
    if (response?.status < 200 || response?.status >= 400) throw new WorkerError('har_contains_failed_response');
    if (typeof response?.content?.text !== 'string') throw new WorkerError('har_response_body_missing');
    if (response.content.encoding && response.content.encoding !== 'base64') throw new WorkerError('unsupported_har_encoding');
    const raw=Buffer.from(response.content.text,response.content.encoding==='base64'?'base64':'utf8');
    if (raw.byteLength > 2_000_000 || captures.length >= 50) throw new WorkerError('capture_limit_exceeded');
    captures.push({page_index:0,response_url:safeResponseUrl(url),body:raw.toString('base64'),body_encoding:'base64',
      mime_type:response.content.mimeType ?? 'application/octet-stream',http_status:response.status});
  }
  if (!captures.length) throw new WorkerError('har_no_matching_responses');
  return captures;
}
