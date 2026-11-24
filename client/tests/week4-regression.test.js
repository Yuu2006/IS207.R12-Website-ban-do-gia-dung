import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { calculateTco } from '../src/services/decision-tools-service.js';
import { getInstallationChecklist, saveInstallationChecklist } from '../src/services/installation-checklist-service.js';

let vite, Shell, AuthContext, menus;
before(async () => {
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  ({ default: Shell, workspaceMenus: menus } = await vite.ssrLoadModule('/src/layouts/AppShell.jsx'));
  ({ AuthContext } = await vite.ssrLoadModule('/src/context/auth-context.js'));
});
after(async () => vite?.close());

test('four workspace menus render only their role links and expose the staff mobile menu control', () => {
  for (const role of ['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE']) {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AuthContext.Provider, { value: { user: { id: '1', role, fullName: 'Week 4' }, signOut() {} } }, createElement(Shell))));
    for (const [path] of menus[role]) assert.ok(html.includes(`href="${path}"`), `${role} misses ${path}`);
    if (role !== 'ADMIN') assert.ok(!html.includes('href="/admin/reports"'));
    if (role !== 'CUSTOMER') assert.match(html, /aria-controls="hc-side-nav"/);
  }
});

test('checklist requests retain version/key and surface failures without fabricated progress', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ success: true, data: String(url).endsWith('/auth/me') ? { csrfToken: 'week4-token' } : { version: 1, completed: false } }), { status: 200 });
  };
  try {
    const body = { productId: 20, roomProfileId: 7, checks: { spaceMeasured: false }, expectedVersion: 0, requestKey: 'b3d5e8f0-0ef0-4b13-8667-e7ea638c09c7' };
    await getInstallationChecklist(20, 7);
    assert.ok(calls[0].url.endsWith('/api/installation-checklists?productId=20&roomProfileId=7'));
    await saveInstallationChecklist(body);
    const saved = calls.at(-1);
    assert.deepEqual(JSON.parse(saved.options.body), body);
    assert.equal(saved.options.headers['X-CSRF-Token'], 'week4-token');
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: 'Schema chưa sẵn sàng.' }), { status: 503 });
    await assert.rejects(getInstallationChecklist(20, 7), error => error.status === 503);
  } finally { globalThis.fetch = originalFetch; }
});

test('changing a TCO scenario cancels the prior request through the real HTTP client', async () => {
  const originalFetch = globalThis.fetch;
  let posted = false;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/me')) return new Response(JSON.stringify({ success: true, data: { csrfToken: 'week4-token' } }));
    posted = true;
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
  };
  try {
    const controller = new AbortController();
    const pending = calculateTco({ productIds: [20, 21] }, { signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(posted, true);
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    await assert.rejects(calculateTco({}, { signal: controller.signal }), error => error.name === 'AbortError');
  } finally { globalThis.fetch = originalFetch; }
});
