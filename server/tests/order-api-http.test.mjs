import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const spec = JSON.parse(await readFile(new URL('../../docs/api/order-checkout.openapi.json', import.meta.url), 'utf8'));
const clientOrigin = 'http://localhost:5173';
let phpServer;
let baseUrl;
let serverLog = '';

// Chạy index.php thật trên loopback/port tạm, không seed user/DB hoặc thêm endpoint fixture.
before(async () => {
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  baseUrl = `http://127.0.0.1:${port}`;
  phpServer = spawn(process.env.PHP_BIN || 'php', ['-S', `127.0.0.1:${port}`, '-t', serverRoot, `${serverRoot}index.php`], {
    cwd: serverRoot, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, CLIENT_URL: clientOrigin },
  });
  let startupError;
  phpServer.on('error', error => { startupError = error; });
  phpServer.stderr.on('data', buffer => { serverLog = (serverLog + buffer.toString()).slice(-12000); });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (startupError) throw startupError;
    if (phpServer.exitCode !== null) throw new Error(`PHP server stopped: ${serverLog}`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(250) });
      if (response.ok) return;
    } catch { /* Startup có thể chưa bind port; chỉ retry loopback trong 5 giây. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`PHP server did not start: ${serverLog}`);
});

after(async () => {
  if (phpServer?.pid && phpServer.exitCode === null) {
    const stopped = once(phpServer, 'exit');
    phpServer.kill();
    await stopped;
  }
});

test('health uses JSON envelope and explicitly reports skeleton/storage not ready', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.equal(result.success, true);
  assert.equal(result.data.orderApi, 'skeleton');
  assert.equal(result.data.storageReady, false);
});

test('all nine real HTTP endpoints are routed and reject anonymous with 401', async () => {
  for (const [path, operations] of Object.entries(spec.paths)) {
    if (['/cart', '/addresses'].includes(path)) continue;
    for (const [method, operation] of Object.entries(operations)) {
      const body = operation.requestBody?.content['application/json'].example;
      const response = await fetch(`${baseUrl}${path.replace('{orderId}', '101')}`, {
        method: method.toUpperCase(), headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, 401, `${method} ${path}`);
      const result = await response.json();
      assert.equal(result.success, false);
      assert.equal(result.errors.code, 'AUTH_REQUIRED');
      assert.deepEqual(result.errors.fields, {});
      assert.equal('data' in result, false);
    }
  }
});

test('HTTP principal spoof in headers/query/body never logs a user in', async () => {
  const read = await fetch(`${baseUrl}/orders?customerId=1&role=ADMIN`, { headers: { 'X-Role': 'ADMIN', Authorization: 'Bearer fake' } });
  assert.equal(read.status, 401);
  const write = await fetch(`${baseUrl}/checkout/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: '1', role: 'CUSTOMER', sessionEstablished: true, total: 1 }) });
  assert.equal(write.status, 401);
});

test('unknown HTTP path is 404, not generic scaffold success', async () => {
  const response = await fetch(`${baseUrl}/unknown`);
  assert.equal(response.status, 404);
  const result = await response.json();
  assert.equal(result.success, false);
  assert.equal(result.errors.code, 'NOT_FOUND');
});

test('wrong method is 405 with Allow header', async () => {
  const response = await fetch(`${baseUrl}/orders`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal((await response.json()).errors.code, 'METHOD_NOT_ALLOWED');
});

test('trusted origin preflight allows cookie/CSRF/idempotency headers without wildcard', async () => {
  const response = await fetch(`${baseUrl}/checkout/orders`, { method: 'OPTIONS', headers: { Origin: clientOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-token,idempotency-key' } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), clientOrigin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-headers'), /X-CSRF-Token/);
  assert.match(response.headers.get('access-control-allow-headers'), /Idempotency-Key/);
  assert.equal(await response.text(), '');
});

test('untrusted origin cannot call API or preflight and gets no reflected origin', async () => {
  for (const method of ['GET', 'OPTIONS']) {
    const response = await fetch(`${baseUrl}/orders`, { method, headers: { Origin: 'https://attacker.test' } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await response.json()).errors.code, 'ORIGIN_NOT_ALLOWED');
  }
});

test('test fixture route is not a public API and default responses expose no fixture/stack', async () => {
  const response = await fetch(`${baseUrl}/tests/order-api.test.php`);
  assert.equal(response.status, 404);
  const text = await response.text();
  assert.doesNotMatch(text, /HC202610|passed|Stack trace|Fatal error|test-csrf-token/);
});
