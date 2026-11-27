import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Real HTTP smoke test ONLY for compose.week4-demo.yml. Refuses writes without the demo marker.
const base = 'http://localhost:18080';
const probe = await fetch(`${base}/auth/me`);
assert.equal(probe.headers.get('x-homecare-demo'), 'week4', 'Refusing writes: this is not the separate week4 demo API.');
function client() {
  const jar = new Map();
  let csrf = '';
  return async (path, { method = 'GET', body, key, noCsrf = false, expected = 200, csv = false } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { Cookie: [...jar].map(([key,value]) => `${key}=${value}`).join('; '), Origin: 'http://localhost:15173', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(!noCsrf && csrf ? { 'X-CSRF-Token': csrf } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const cookies = response.headers.getSetCookie();
    for (const item of cookies) { const [name, ...value] = item.split(';')[0].split('='); jar.set(name, value.join('=')); }
    const text = await response.text();
    assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${text.slice(0, 350)}`);
    assert.ok(!/SQLSTATE|Stack trace|Fatal error/.test(text), 'API leaked internal error details');
    if (csv) { assert.match(response.headers.get('content-type'), /text\/csv/); return text; }
    const result = JSON.parse(text);
    if (result.data?.csrfToken) csrf = result.data.csrfToken;
    assert.equal(result.success, expected < 400, `${method} ${path}: ${result.message}`);
    return result.data;
  };
}
async function login(role) {
  const api = client(); await api('/auth/me');
  await api(role === 'customer' ? '/auth/login' : '/auth/staff/login', { method: 'POST', body: { identifier: `${role}@example.test`, password: 'Demo@1234567890!' } });
  return api;
}
const anonymous = client();
await anonymous('/api/installation-checklists?productId=1', { expected: 401 });
const customer = client(); await customer('/auth/me');
await customer('/auth/register', { method: 'POST', expected: 201, body: { fullName: 'Week4 isolated HTTP customer', email: `week4-${randomUUID()}@example.test`, password: 'Demo@1234567890!' } });
await customer('/users/me/addresses', { method: 'POST', expected: 201, body: { recipientName: 'Week4 demo receiver', phone: '0900000000', addressLine: 'Dia chi mo phong cho kiem thu', province: 'TP. Ho Chi Minh', isDefault: true } });
const admin = await login('admin'), sales = await login('sales'), warehouse = await login('warehouse');
const now = new Date();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const period = `from=${today}&to=${today}`;
for (const actor of [customer, sales, warehouse]) await actor(`/admin/dashboard?${period}`, { expected: 403 });
const before = await admin(`/admin/dashboard?${period}`);
const products = await customer('/api/products?is_active=1');
const group = products.filter(item => /giặt/i.test(item.category_name));
assert.ok(group.length >= 4, 'Demo needs four washing machines');
const details = await Promise.all(group.slice(0, 4).map(item => customer(`/api/products/${item.id}`)));
const ids = details.map(item => Number(item.id));
const variants = details.map(item => item.variants.find(sku => Number(sku.stock_quantity) > 0));
assert.ok(variants.every(Boolean));
const room = await customer('/api/room-profiles', { method: 'POST', body: { name: `Week4 HTTP ${randomUUID()}` }, expected: 201 });
const fitBody = { productId: ids[0], roomProfileId: room.id, requestKey: randomUUID() };
const fit = await customer('/api/fit-checks', { method: 'POST', body: fitBody });
assert.equal(fit.result, 'NEEDS_CHECK');
assert.deepEqual(await customer('/api/fit-checks', { method: 'POST', body: fitBody }), fit);
const checklistPath = `/api/installation-checklists?productId=${ids[0]}&roomProfileId=${room.id}`;
const empty = await customer(checklistPath);
await customer('/api/installation-checklists', { method: 'POST', body: {}, noCsrf: true, expected: 403 });
await sales(checklistPath, { expected: 403 });
const checklistBody = { productId: ids[0], roomProfileId: room.id, expectedVersion: 0, checks: Object.fromEntries(Object.keys(empty.items).map(key => [key, true])), requestKey: randomUUID() };
const saved = await customer('/api/installation-checklists', { method: 'POST', body: checklistBody });
assert.equal(saved.history?.at(-1)?.version, saved.version, 'Save response must include checklist history');
assert.equal(saved.completed, true);
assert.deepEqual(await customer('/api/installation-checklists', { method: 'POST', body: checklistBody }), saved);
const tcoBody = { productIds: ids, variantIds: variants.map(item => Number(item.id)), years: 3, usesPerWeek: 5, hoursPerUse: '1.5', electricityVndPerKwh: '3000', waterVndPerM3: '25000', annualCosts: ids.map(productId => ({ productId, consumablesVndPerYear: '0', maintenanceVndPerYear: null })), requestKey: randomUUID() };
const tco = await customer('/api/tco/calculate', { method: 'POST', body: tcoBody });
assert.equal(tco.products.length, 4);
assert.ok(tco.products.every(item => item.total === null && item.missingInputs.length > 0));
await customer('/api/tco/calculate', { method: 'POST', body: tcoBody });
const bot = await customer('/api/chatbot/messages', { method: 'POST', body: { message: 'máy giặt dưới 20 triệu tiết kiệm điện' } });
assert.ok(bot.followUpQuestion && bot.recommendations.length);

// One new COD purchase in this private demo DB, including completion -> device/care bridge replay.
const cart = await customer('/cart');
assert.equal(cart.items.length, 0, 'Demo cart must be empty before this smoke test; inspect it manually.');
const added = await customer('/cart/items', { method: 'POST', body: { variantId: String(variants[0].id), quantity: 1, expectedCartVersion: cart.cartVersion }, key: randomUUID() });
const addresses = await customer('/addresses');
const quoteBody = { cartVersion: added.cartVersion, addressId: String(addresses.items[0].id), paymentMethod: 'COD', voucherCode: null };
const quote = await customer('/checkout/quote', { method: 'POST', body: quoteBody });
const created = await customer('/checkout/orders', { method: 'POST', body: { ...quoteBody, quoteFingerprint: quote.quoteFingerprint, note: 'Week4 isolated HTTP smoke test' }, key: randomUUID(), expected: 201 });
let order = created.order;
for (const toStatus of ['confirmed', 'preparing', 'shipping', 'delivered', 'completed']) {
  const body = { expectedVersion: order.version, toStatus, ...(toStatus === 'delivered' ? { codCollected: true } : {}) };
  const key = randomUUID();
  order = await sales(`/sales/orders/${order.id}/status`, { method: 'PATCH', body, key });
  if (toStatus === 'completed') assert.deepEqual(await sales(`/sales/orders/${order.id}/status`, { method: 'PATCH', body, key }), order);
}
const devices = await customer('/api/owned-devices?pageSize=50');
const device = devices.items.find(item => item.orderItemId === order.items[0].orderItemId);
assert.ok(device?.careTasks.length, 'Completed purchase must create one device with maintenance');
assert.equal(devices.items.filter(item => item.orderItemId === order.items[0].orderItemId).length, 1);
const task = device.careTasks.find(item => item.status === 'DUE');
const nextDay = new Date(`${task.dueDate}T00:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
const postponed = await customer(`/api/care-tasks/${task.id}/postpone`, { method: 'POST', body: { newDueDate: nextDay.toISOString().slice(0, 10), reason: 'Week4 simulated customer schedule' } });
assert.equal(postponed.status, 'POSTPONED');
const done = await customer(`/api/care-tasks/${task.id}/complete`, { method: 'POST', body: {} });
assert.deepEqual(await customer(`/api/care-tasks/${task.id}/complete`, { method: 'POST', body: {} }), done);
const tasks = await customer(`/api/owned-devices/${device.id}/care-tasks`);
assert.equal(tasks.items.filter(item => item.careRuleId === task.careRuleId && item.cycleNumber === 2).length, 1);
const after = await admin(`/admin/dashboard?${period}`);
assert.equal(after.decisionTools.fitChecks - before.decisionTools.fitChecks, 1);
assert.equal(after.decisionTools.tcoCalculations - before.decisionTools.tcoCalculations, 1);
assert.equal(after.decisionTools.installationChecklistsCompleted - before.decisionTools.installationChecklistsCompleted, 1);
assert.equal(after.decisionTools.careCompleted - before.decisionTools.careCompleted, 1);
const csv = await admin(`/admin/reports/revenue.csv?${period}`, { csv: true });
const netLine = csv.split(/\r?\n/).find(line => line.startsWith('NET_TOTAL,'));
assert.equal(Number(netLine.split(',')[6]), after.sales.netRevenueVnd);
console.log(`PASS real HTTP: four roles, CSRF, FitCheck, four-product TCO missing data, chatbot, checklist replay, COD ${order.code}, device/care replay, dashboard and CSV parity.`);
