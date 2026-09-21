import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

// A dedicated persistent automation profile. Never attach a personal/default Chrome profile.
const port=Number(process.env.CDP_PORT ?? 9222);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_debugging_port');
const context=await chromium.launchPersistentContext(resolve(process.env.BROWSER_PROFILE ?? `data/browser-${port}`),{
  headless:process.env.HEADLESS !== 'false',
  executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
  acceptDownloads:false,
  args:[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1'],
});
console.log(`Dedicated browser ready on loopback port ${port}`);
const close=()=>context.close();
process.once('SIGTERM',close); process.once('SIGINT',close);
