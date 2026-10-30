import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const executable = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'ezmoo-party-browser-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  define: { 'import.meta.env.VITE_GOOGLE_API_URL': JSON.stringify('http://127.0.0.1/mock-google-api') },
  plugins: [{ name: 'party-browser-fixture', configureServer(server) {
    server.middlewares.use('/__party_test', async (_req, res) => {
      const html = await server.transformIndexHtml('/__party_test', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/party-builder.browser.tsx"></script></body></html>');
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  } }],
});
let chrome, socket;
try {
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/__party_test`;
  chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let startupError = '';
  chrome.stderr.on('data', data => { startupError += data.toString(); });
  chrome.on('error', error => { startupError += error.message; });
  let port;
  for (let i = 0; i < 200; i++) {
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(50); }
  }
  assert.ok(port, `Headless Chrome failed to start: ${startupError}`);
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const item = pending.get(message.id);
    if (item) { pending.delete(message.id); message.error ? item.reject(message.error) : item.resolve(message.result); }
  };
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); });
  }
  await cdp('Page.enable');
  for (const width of [1440, 1024, 901, 900, 768, 390]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: `${url}?width=${width}` });
    let result;
    for (let i = 0; i < 300; i++) {
      await sleep(100);
      const response = await cdp('Runtime.evaluate', { expression: 'window.__partyTest', returnByValue: true });
      result = response.result?.value;
      if (result) break;
    }
    assert.equal(result?.width ?? width, width, 'Result must belong to the requested viewport');
    assert.ok(result?.ok, JSON.stringify(result ?? { error: 'Browser test timed out' }));
    console.log(`PASS: real Chrome ${width}px: all six modes, single board/toolbar/member panel, Raid A/B 8x5, class updates, separate drafts and undo/redo, no overlap/overflow, no React errors`);
  }
} finally {
  socket?.close(); chrome?.kill(); await server.close();
  // Chrome may briefly hold its temporary profile open on Windows.
  await fs.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
