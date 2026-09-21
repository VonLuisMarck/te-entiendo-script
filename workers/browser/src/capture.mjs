import { chromium } from 'playwright-core';
import { setTimeout as delay } from 'node:timers/promises';
import { WorkerError, matchesResponse, safeResponseUrl, safeUrl } from './config.mjs';

// Passive observation: never replay private portal requests, inspect cookies, or parse HTML.
// Register before navigation. Preserve response bytes, without assuming a JSON content type.
export async function captureSearch({ endpoint, source, urls, onCapture, signal, windowMs = 12000, quietMs = 1500 }) {
  let browser;
  try { browser = await chromium.connectOverCDP(endpoint, { timeout: 10000 }); }
  catch { throw new WorkerError('browser_connection_failed',503); }
  let page;
  try {
    const context = browser.contexts()[0];
    if (!context) throw new WorkerError('browser_context_missing');
    page = await context.newPage();
    const stop = () => { void page.close().catch(() => {}); };
    signal?.addEventListener('abort', stop, { once: true });
    try {
      for (let index = 0; index < urls.length; index++) {
        signal?.throwIfAborted();
        let count = 0, last = Date.now(), fatal = null, pending = new Set();
        const capture = async response => {
          const request = response.request();
          const candidate = matchesResponse(response.url(), source, request.resourceType());
          const document = request.isNavigationRequest() && request.frame() === page.mainFrame();
          if (!candidate && !document) return;
          if ([401,403,429].includes(response.status())) throw new WorkerError(`source_http_${response.status()}`);
          if (!candidate) return;
          if (response.status() >= 400) throw new WorkerError('source_http_error');
          const headers = response.headers();
          if (Number(headers['content-length']) > 2_000_000) throw new WorkerError('response_too_large');
          if (count >= 50) throw new WorkerError('capture_limit_exceeded');
          count++;
          const buffer = await response.body();
          signal?.throwIfAborted();
          if (buffer.byteLength > 2_000_000) throw new WorkerError('response_too_large');
          await onCapture({ page_index: index, response_url: safeResponseUrl(response.url()),
            body:buffer.toString('base64'),body_encoding:'base64',mime_type:headers['content-type'] ?? 'application/octet-stream',http_status:response.status() });
          last = Date.now();
        };
        const listener = response => {
          const promise = capture(response).catch(error => { fatal ??= error; }).finally(() => pending.delete(promise));
          pending.add(promise);
        };
        const failed = request => { if (matchesResponse(request.url(),source,request.resourceType())) fatal ??= new WorkerError('source_request_failed'); };
        page.on('response', listener);
        page.on('requestfailed', failed);
        // Block top-level redirects outside the configured portal. Subresources remain untouched.
        await page.route('**/*', route => {
          const request = route.request();
          if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
            try { safeUrl(request.url(),source.navigation_origins); }
            catch { fatal = new WorkerError('navigation_left_source'); return route.abort(); }
          }
          return route.continue();
        });
        try {
          await page.goto(urls[index], { waitUntil: 'domcontentloaded', timeout: 20000 });
          if (fatal) throw fatal;
          for (const action of source.actions ?? []) {
            const locator = page.getByRole(action.role, { name: action.name, exact: true });
            if (action.optional && !await locator.isVisible()) continue;
            if (action.type === 'fill') await locator.fill(action.value, { timeout: 5000 });
            else await locator.click({ timeout: 5000 });
          }
          const deadline = Date.now() + windowMs;
          while (Date.now() < deadline) {
            signal?.throwIfAborted();
            if (fatal) throw fatal;
            if (count > 0 && pending.size === 0 && Date.now() - last >= quietMs) break;
            await delay(50, undefined, { signal });
          }
          if (fatal) throw fatal;
          if (pending.size) throw new WorkerError('response_body_timeout');
          if (!count) throw new WorkerError('no_matching_response');
        } finally {
          page.off('response', listener);
          page.off('requestfailed', failed);
          await page.unroute('**/*');
        }
        if (index < urls.length - 1) await delay(2000, undefined, { signal });
      }
    } finally { signal?.removeEventListener('abort', stop); }
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    const networkCode = String(error?.message).match(/net::(ERR_[A-Z_]+)/)?.[1];
    if (networkCode) throw new WorkerError(`browser_${networkCode}`);
    throw new WorkerError(signal?.aborted ? 'job_interrupted' : 'browser_navigation_failed');
  } finally {
    await page?.close().catch(() => {});
    // A CDP connection is disconnected; the separately owned Chrome process stays alive.
    await browser.close().catch(() => {});
  }
}
