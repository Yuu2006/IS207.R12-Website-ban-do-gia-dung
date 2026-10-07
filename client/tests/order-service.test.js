import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ApiError, createApiClient } from '../src/services/api-client.js';
import { createOrderService, mapOrder } from '../src/services/order-service.js';
import { createMockOrderService } from '../src/services/order-mock-service.js';

const api = JSON.parse(await readFile(new URL('../../docs/api/order-checkout.openapi.json', import.meta.url), 'utf8'));
const owner = { id: 'preview:nguyen.minh@example.com', role: 'CUSTOMER', fullName: 'Nguyễn Minh' };
const idempotencyKey = 'b5576303-2f2f-469a-b90c-5a7a99fb37d3';
const order = api.paths['/orders/{orderId}'].get.responses['200'].content['application/json'].example.data;
const cart = api.paths['/cart'].get.responses['200'].content['application/json'].example.data;
const options = { idempotencyKey };
const mock = settings => createMockOrderService({ getCustomer: async () => owner, delayMs: 0, ...settings });
const isError = (status, code) => error => error.status === status && error.code === code;

// Kiểm chứng schema/example thật trong OpenAPI, không tạo bộ expected docs riêng.
function matches(schema, value) {
  if (schema.$ref) return matches(api.components.schemas[schema.$ref.split('/').at(-1)], value);
  if (value === null && schema.nullable) { if (schema.enum) assert.ok(schema.enum.includes(null)); return; }
  if (schema.allOf) return schema.allOf.forEach(part => matches(part, value));
  if (schema.enum) assert.ok(schema.enum.includes(value), `enum rejects ${value}`);
  if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    for (const key of schema.required || []) assert.ok(key in value, `missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) matches(schema.properties[key], item);
      else if (schema.additionalProperties === false) assert.fail(`unexpected ${key}`);
    }
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value)); value.forEach(item => matches(schema.items, item));
  } else if (schema.type === 'integer') {
    assert.ok(Number.isSafeInteger(value));
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum);
  } else if (schema.type === 'boolean') assert.equal(typeof value, 'boolean');
  else if (schema.type === 'string') {
    assert.equal(typeof value, 'string');
    if (schema.pattern) assert.ok(new RegExp(schema.pattern).test(value));
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength);
    if (schema.maxLength !== undefined) assert.ok(value.length <= schema.maxLength);
    if (schema.format === 'date-time') assert.ok(!Number.isNaN(Date.parse(value)));
  }
}

test('OpenAPI operations declare role/status/security and valid request/response examples', () => {
  assert.equal(api.openapi, '3.0.3');
  for (const [path, methods] of Object.entries(api.paths)) for (const [method, operation] of Object.entries(methods)) {
    assert.ok(operation['x-roles'].length);
    assert.ok(operation.security.length);
    assert.ok(operation.responses['401']); assert.ok(operation.responses['403']);
    if (path.includes('{orderId}')) assert.ok(operation.parameters.some(parameter => parameter.name === 'orderId' && parameter.required));
    if (['post', 'patch'].includes(method)) {
      const body = operation.requestBody.content['application/json']; matches(body.schema, body.example);
      assert.ok(operation.parameters.some(parameter => parameter.name === 'X-CSRF-Token'));
      if (path !== '/checkout/quote') assert.ok(operation.parameters.some(parameter => parameter.name === 'Idempotency-Key'));
    }
    for (const response of Object.values(operation.responses)) {
      const content = response.content['application/json']; matches(content.schema, content.example);
    }
  }
  assert.equal(api['x-inventory-decision'].vnpayHoldMinutes, 15);
});

test('HTTP client sends credential/CSRF/key and returns only successful data', async () => {
  let received;
  const request = createApiClient({ baseUrl: 'https://api.example.test/', getCsrfToken: () => 'csrf', fetchImpl: async (url, init) => {
    received = { url, init }; return Response.json({ success: true, message: 'OK', data: cart });
  } });
  assert.deepEqual(await request('/cart', { method: 'POST', body: { skuId: '1' }, idempotencyKey }), cart);
  assert.equal(received.url, 'https://api.example.test/cart');
  assert.equal(received.init.credentials, 'include');
  assert.equal(received.init.headers['X-CSRF-Token'], 'csrf');
  assert.equal(received.init.headers['Idempotency-Key'], idempotencyKey);
});

test('HTTP error status/code/fields survive; 5xx does not expose SQL message', async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 503]) {
    const request = createApiClient({ fetchImpl: async () => Response.json({ success: false, message: 'SQL private exception', errors: { code: 'EXPECTED_ERROR', fields: { reason: 'Required' } } }, { status }) });
    await assert.rejects(request('/orders'), error => {
      assert.equal(error.status, status); assert.equal(error.code, 'EXPECTED_ERROR'); assert.equal(error.fields.reason, 'Required');
      if (status >= 500) assert.doesNotMatch(error.message, /SQL/);
      return true;
    });
  }
});

test('missing CSRF fails before fetch; invalid success/HTML never reports success', async () => {
  let calls = 0;
  const request = createApiClient({ getCsrfToken: () => '', fetchImpl: async () => { calls += 1; return Response.json({}); } });
  await assert.rejects(request('/checkout/orders', { method: 'POST' }), isError(403, 'CSRF_TOKEN_MISSING'));
  assert.equal(calls, 0);
  for (const result of [Response.json({ success: true }), Response.json({ success: false }), new Response('<html>Login</html>')]) {
    await assert.rejects(createApiClient({ fetchImpl: async () => result })('/orders'), error => error.code === 'INVALID_API_RESPONSE');
  }
});

test('network, timeout and deliberate abort reject without fallback data', async () => {
  await assert.rejects(createApiClient({ fetchImpl: async () => { throw new TypeError('Offline'); } })('/orders'), isError(0, 'NETWORK_ERROR'));
  const fetchPending = (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
    else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(createApiClient({ timeoutMs: 5, fetchImpl: fetchPending })('/orders'), isError(0, 'NETWORK_ERROR'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createApiClient({ fetchImpl: fetchPending })('/orders', { signal: controller.signal }), error => error.name === 'AbortError');
});

test('DTO maps DB id separately from display code and rejects malformed money/states', () => {
  const mapped = mapOrder(order, true);
  assert.equal(mapped.id, '101'); assert.equal(mapped.code, 'HC2026100001');
  assert.equal(mapped.items[0].sku_id, '1'); assert.equal(mapped.totals.total, 8990000);
  assert.equal(mapped.history[0].status, 'pending');
  for (const changed of [{ ...order, id: 101 }, { ...order, orderStatus: 'PENDING' }, { ...order, shippingAddress: null }, { ...order, totals: { ...order.totals, total: 1 } }, { ...order, items: [{ ...order.items[0], unitPrice: 1.5 }] }]) {
    assert.throws(() => mapOrder(changed, true), error => error.code === 'INVALID_API_RESPONSE');
  }
});

test('list service encodes server filtering/pagination/search, never sends role/owner', async () => {
  let received;
  const service = createOrderService(async (path, input) => { received = { path, input }; return { items: [order], pagination: { page: 2, pageSize: 10, totalItems: 12, totalPages: 2 } }; });
  await service.listCustomerOrders({ status: 'confirmed,preparing', page: 2, customerId: 'attacker', role: 'ADMIN' });
  const query = new URL(received.path, 'https://example.test').searchParams;
  assert.equal(query.get('status'), 'confirmed,preparing'); assert.equal(query.get('page'), '2');
  assert.equal(query.has('customerId'), false); assert.equal(query.has('role'), false);
  await service.listSalesOrders({ search: ' Nguyễn Minh ' });
  assert.equal(new URL(received.path, 'https://example.test').searchParams.get('search'), 'Nguyễn Minh');
});

test('cancel/status payloads whitelist fields and encode path ID', async () => {
  let received;
  const service = createOrderService(async (path, input) => { received = { path, input }; return order; });
  await service.cancelOrder('101/foreign', { expectedVersion: 1, reason: 'Không cần nữa', actorId: 'attacker', role: 'ADMIN', paymentStatus: 'paid' }, options);
  assert.equal(received.path, '/orders/101%2Fforeign/cancel');
  assert.deepEqual(received.input.body, { expectedVersion: 1, reason: 'Không cần nữa' });
  await service.updateSalesStatus('101', { expectedVersion: 1, toStatus: 'delivered', codCollected: true, actor: { role: 'ADMIN' }, paymentStatus: 'paid' }, options);
  assert.deepEqual(received.input.body, { expectedVersion: 1, toStatus: 'delivered', codCollected: true });
  assert.equal(received.input.method, 'PATCH');
  await assert.rejects(service.cancelOrder('101', { expectedVersion: 1, reason: 'x' }, {}), error => error.code === 'IDEMPOTENCY_KEY_REQUIRED');
});

test('checkout quote/create never send UI prices, totals, stock or identity', async () => {
  let received;
  const quote = api.paths['/checkout/quote'].post.responses['200'].content['application/json'].example.data;
  const service = createOrderService(async (path, input) => { received = { path, input }; return path === '/checkout/quote' ? quote : { order, payment: null }; });
  const input = { cartVersion: 3, addressId: '12', paymentMethod: 'COD', voucherCode: null, quoteFingerprint: 'fp', note: '', total: 1, price: 1, stock: 999, customerId: 'other', role: 'ADMIN' };
  await service.quoteCheckout(input);
  assert.deepEqual(received.input.body, { cartVersion: 3, addressId: '12', paymentMethod: 'COD', voucherCode: null });
  await service.createOrder(input, options);
  assert.deepEqual(received.input.body, { cartVersion: 3, addressId: '12', paymentMethod: 'COD', voucherCode: null, quoteFingerprint: 'fp', note: '' });
});

test('malformed payment or unsafe redirect cannot yield successful create result', async () => {
  for (const payment of [undefined, { attemptReference: 'try1', expiresAt: '2026-10-07T09:15:00+07:00', redirectUrl: 'javascript:alert(1)' }, { attemptReference: 'try1', expiresAt: '2026-10-07T09:15:00+07:00', redirectUrl: 'https://attacker.test/' }]) {
    const service = createOrderService(async () => ({ order: { ...order, paymentMethod: 'VNPAY', paymentStatus: 'pending' }, payment }));
    await assert.rejects(service.createOrder({}, options), error => error.code === 'INVALID_API_RESPONSE');
  }
});

test('mock list filters before pagination and never exposes foreign customer detail', async () => {
  const service = mock();
  const page = await service.listCustomerOrders({ status: 'delivered,completed', pageSize: 1 });
  assert.equal(page.items.length, 1); assert.equal(page.pagination.totalItems, 1); assert.equal(page.items[0].status, 'completed');
  const other = mock({ getCustomer: async () => ({ id: 'preview:other@example.com', role: 'CUSTOMER' }) });
  assert.equal((await other.listCustomerOrders()).items.length, 0);
  await assert.rejects(other.getCustomerOrder('HC2026100001'), isError(404, 'ORDER_NOT_FOUND'));
  await assert.rejects(mock({ getCustomer: async () => null }).listCustomerOrders(), isError(401, 'AUTH_REQUIRED'));
  await assert.rejects(mock({ getStaff: async () => ({ id: 4, role: 'WAREHOUSE' }) }).listSalesOrders(), isError(403, 'FORBIDDEN'));
});

test('mock cancellation replay adds only one history entry; changed payload conflicts', async () => {
  const service = mock(); const original = await service.getCustomerOrder('HC2026100003');
  const input = { expectedVersion: original.version, reason: 'Đổi nhu cầu' };
  const [first, second] = await Promise.all([service.cancelOrder(original.id, input, options), service.cancelOrder(original.id, input, options)]);
  assert.equal(first.status, 'cancelled'); assert.deepEqual(first, second);
  assert.equal((await service.getCustomerOrder(original.id)).history.length, original.history.length + 1);
  await assert.rejects(service.cancelOrder(original.id, { ...input, reason: 'Khác' }, options), isError(409, 'IDEMPOTENCY_CONFLICT'));
});

test('mock sales only moves one step; COD requires collection at delivered', async () => {
  const service = mock(); const shipping = await service.getSalesOrder('HC2026100002');
  await assert.rejects(service.updateSalesStatus(shipping.id, { expectedVersion: shipping.version, toStatus: 'completed' }, options), isError(409, 'INVALID_ORDER_TRANSITION'));
  await assert.rejects(service.updateSalesStatus(shipping.id, { expectedVersion: shipping.version, toStatus: 'delivered' }, options), isError(422, 'COD_COLLECTION_REQUIRED'));
  const result = await service.updateSalesStatus(shipping.id, { expectedVersion: shipping.version, toStatus: 'delivered', codCollected: true }, options);
  assert.equal(result.payment, 'paid'); assert.equal(result.status, 'delivered');
});

test('mock quote/create COD is idempotent, empties cart once and appears in owner history', async () => {
  const service = mock(); const cart = await service.getCart(); const [address] = await service.getAddresses();
  const input = { cartVersion: cart.cartVersion, addressId: address.id, paymentMethod: 'COD', voucherCode: 'HOMECARE' };
  const quoted = await service.quoteCheckout(input);
  const request = { ...input, quoteFingerprint: quoted.quoteFingerprint, note: 'Gọi trước' };
  const [first, replay] = await Promise.all([service.createOrder(request, options), service.createOrder(request, options)]);
  assert.deepEqual(first, replay); assert.equal(first.order.payment, 'unpaid'); assert.equal(first.payment, null);
  assert.equal(first.order.totals.total, quoted.totals.total);
  assert.equal((await service.getCart()).items.length, 0);
  assert.equal((await service.listCustomerOrders()).pagination.totalItems, 5);
});

test('mock invalid quote/price change/VNPay never creates a successful fake order', async () => {
  const service = mock(); const cart = await service.getCart(); const [address] = await service.getAddresses();
  const input = { cartVersion: cart.cartVersion, addressId: address.id, paymentMethod: 'COD', voucherCode: null };
  await assert.rejects(service.quoteCheckout({ ...input, voucherCode: 'INVALID' }), isError(422, 'VOUCHER_INVALID'));
  await assert.rejects(service.quoteCheckout({ ...input, addressId: 'foreign' }), isError(404, 'ADDRESS_NOT_FOUND'));
  await assert.rejects(service.quoteCheckout({ ...input, cartVersion: 99 }), isError(409, 'CART_VERSION_CONFLICT'));
  await assert.rejects(service.createOrder({ ...input, quoteFingerprint: 'changed', note: '' }, options), isError(409, 'CHECKOUT_CHANGED'));
  const vnpay = { ...input, paymentMethod: 'VNPAY' }; const quoted = await service.quoteCheckout(vnpay);
  await assert.rejects(service.createOrder({ ...vnpay, quoteFingerprint: quoted.quoteFingerprint, note: '' }, options), isError(409, 'PAYMENT_NOT_AVAILABLE'));
  assert.equal((await service.listCustomerOrders()).pagination.totalItems, 4);
  assert.equal((await service.getCart()).cartVersion, 1);
});

test('mock reorder merges current catalog SKU once and respects cart version', async () => {
  const service = mock(); const before = await service.getCart();
  const input = { expectedCartVersion: before.cartVersion };
  const first = await service.reorder('HC2026100001', input, options);
  const second = await service.reorder('HC2026100001', input, options);
  assert.deepEqual(first, second); assert.equal(first.cartVersion, before.cartVersion + 1); assert.equal(first.items[0].quantity, 2);
  await assert.rejects(service.reorder('HC2026100001', input, { idempotencyKey: crypto.randomUUID() }), isError(409, 'CART_VERSION_CONFLICT'));
});
