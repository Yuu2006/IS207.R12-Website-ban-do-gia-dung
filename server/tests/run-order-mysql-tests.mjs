import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

// A brand-new loopback MySQL instance only. Never connect to the user's running DB service.
const php = process.env.PHP_BIN || 'php';
const mysqld = process.env.MYSQLD_BIN || 'mysqld';
const phpArgs = process.env.PHP_EXTENSION_DIR ? ['-n', '-d', `extension_dir=${process.env.PHP_EXTENSION_DIR}`, '-d', 'extension=php_pdo_mysql.dll'] : [];
const suite = fileURLToPath(new URL('./order-mysql.test.php', import.meta.url));
const tempParent = await realpath(tmpdir());
const root = await mkdtemp(join(tempParent, 'homecare-order-mysql-'));
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
if (port === 3306) throw new Error('Refusing default MySQL port.');
const env = { ...process.env, ORDER_MYSQL_TEST: 'isolated', DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: 'homecare_order_test_' + Date.now(), DB_USER: 'root', DB_PASSWORD: '' };
const run = (binary, args, allowedFailure = false) => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  child.on('error', reject);
  child.on('exit', code => code === 0 || allowedFailure ? resolve({ code, output }) : reject(new Error(output || `Process exited ${code}`)));
});
const call = (...args) => run(php, [...phpArgs, suite, ...args]);
let server;
let log = '';
try {
  console.log(`Isolated data directory: ${root}; port: ${port}`);
  console.log((await run(mysqld, ['--version'])).output.trim());
  await run(mysqld, ['--no-defaults', '--initialize-insecure', `--datadir=${join(root, 'data')}`, '--console']);
  server = spawn(mysqld, ['--no-defaults', `--datadir=${join(root, 'data')}`, '--bind-address=127.0.0.1', `--port=${port}`, '--mysqlx=OFF', '--innodb-buffer-pool-size=64M', '--console'], { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  server.on('error', error => { log += error.message; });
  server.stderr.on('data', data => { log = (log + data).slice(-12000); });
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (server.exitCode !== null) throw new Error(log);
    const ping = await run(php, [...phpArgs, suite, 'ping'], true);
    if (ping.code === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`MySQL did not become ready: ${log}`);
  console.log((await call('init')).output.trim());
  console.log((await call('test')).output.trim());
  // Two independent PHP/PDO processes contend for the same last SKU.
  const prepared = JSON.parse((await call('prepare-race')).output);
  const checkoutRace = await Promise.all(prepared.map(input => call('checkout-worker', JSON.stringify(input))));
  const outcomes = checkoutRace.map(result => JSON.parse(result.output));
  if (outcomes.filter(result => result.ok).length !== 1 || outcomes.filter(result => result.code === 'OUT_OF_STOCK').length !== 1) throw new Error(`Oversell race failed: ${JSON.stringify(outcomes)}`);
  console.log((await call('verify-race')).output.trim());
  const raceOrder = JSON.parse((await call('prepare-status-race')).output);
  const statusRace = await Promise.all(['first', 'second'].map(key => call('status-worker', JSON.stringify({ ...raceOrder, key }))));
  const transitions = statusRace.map(result => JSON.parse(result.output));
  if (transitions.filter(result => result.ok).length !== 1 || transitions.filter(result => result.code === 'ORDER_VERSION_CONFLICT').length !== 1) throw new Error(`Version race failed: ${JSON.stringify(transitions)}`);
  console.log((await call('verify-status-race')).output.trim());
  const same = { ...raceOrder, expectedVersion: 2, toStatus: 'preparing', key: 'identical' };
  const duplicateRace = await Promise.all([call('status-worker', JSON.stringify(same)), call('status-worker', JSON.stringify(same))]);
  const replay = duplicateRace.map(result => JSON.parse(result.output));
  if (!replay.every(result => result.ok)) throw new Error('Concurrent identical key did not succeed.');
  assert.deepEqual(replay[0], replay[1], 'Concurrent identical key must replay the same JSON values.');
  console.log((await call('verify-replay-race')).output.trim());
  const cancel = JSON.parse((await call('prepare-cancel-race')).output);
  const cancelRace = await Promise.all(['cancel', 'shipping'].map(action => call('cancel-worker', JSON.stringify({ ...cancel, action }))));
  const cancelled = cancelRace.map(result => JSON.parse(result.output));
  if (cancelled.filter(result => result.ok).length !== 1 || cancelled.filter(result => result.code === 'ORDER_VERSION_CONFLICT').length !== 1) throw new Error(`Cancel/shipping race failed: ${JSON.stringify(cancelled)}`);
  console.log((await call('verify-cancel-race', JSON.stringify(cancel))).output.trim());
  console.log('PASS: isolated MySQL integration and four two-process races.');
} finally {
  if (server?.pid && server.exitCode === null) {
    const stopped = once(server, 'exit');
    try { await call('shutdown'); } catch { server.kill(); }
    await stopped;
  }
  // Delete ONLY this newly generated private directory, after stopping its own server.
  const resolved = await realpath(root);
  if (resolved !== root || dirname(resolved) !== tempParent || !basename(resolved).startsWith('homecare-order-mysql-')) throw new Error('Unsafe temporary cleanup target.');
  await rm(resolved, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
  console.log('Test instance stopped; its generated test datadir removed. No shared DB was changed.');
}
