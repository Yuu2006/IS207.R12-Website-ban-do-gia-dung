import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyOrderTransition, canCancelOrder, nextOrderStatus, validateOrderTransition } from '../src/utils/order-state.js';
import { initialOrders } from '../src/services/order-ui-data.js';

const sales = { id: 'sales-1', role: 'SALES' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };
const makeOrder = (patch = {}) => ({ id: 'order-1', customerId: customer.id, version: 1, status: 'pending', payment: 'unpaid', method: 'COD', history: [], ...patch });
const makeRequest = (patch = {}) => ({ actor: sales, expectedVersion: 1, toStatus: 'confirmed', ...patch });
const now = '2026-10-07T02:00:00Z';

test('all 49 state pairs follow only forward edges or pre-shipping cancellation', () => {
  const states = [...Object.keys(nextOrderStatus), 'completed', 'cancelled'];
  for (const from of states) for (const to of states) {
    const order = makeOrder({ status: from, method: 'VNPAY', payment: 'paid' });
    const request = makeRequest({ toStatus: to, reason: 'Khách yêu cầu' });
    const expected = nextOrderStatus[from] === to || (to === 'cancelled' && canCancelOrder(from));
    assert.equal(validateOrderTransition(order, request).ok, expected, `${from} -> ${to}`);
  }
});

test('CUSTOMER only cancels their own pre-shipping order; no foreign or forward transitions', () => {
  assert.equal(validateOrderTransition(makeOrder(), makeRequest({ actor: customer, toStatus: 'cancelled', reason: 'Đổi nhu cầu' })).ok, true);
  for (const patch of [{ customerId: 'someone-else' }, { customerId: null }, { status: 'shipping' }, { status: 'delivered', payment: 'paid' }]) {
    assert.equal(validateOrderTransition(makeOrder(patch), makeRequest({ actor: customer, toStatus: 'cancelled', reason: 'Đổi nhu cầu' })).ok, false);
  }
  assert.equal(validateOrderTransition(makeOrder(), makeRequest({ actor: customer })).code, 'FORBIDDEN');
});

test('WAREHOUSE, unauthenticated actors and unknown roles cannot change order state', () => {
  for (const actor of [null, {}, { id: '', role: 'SALES' }, { id: 0, role: 'ADMIN' }, { id: 'w', role: 'WAREHOUSE' }, { id: 'x', role: 'SYSTEM' }]) {
    assert.equal(validateOrderTransition(makeOrder(), makeRequest({ actor })).code, 'FORBIDDEN');
  }
  assert.equal(validateOrderTransition(makeOrder(), makeRequest({ actor: { id: 1, role: 'ADMIN' } })).ok, true);
});

test('cancellation requires a trimmed reason of 1–500 characters', () => {
  for (const reason of [undefined, null, '', '   ']) assert.equal(validateOrderTransition(makeOrder(), makeRequest({ toStatus: 'cancelled', reason })).code, 'REASON_REQUIRED');
  assert.equal(validateOrderTransition(makeOrder(), makeRequest({ toStatus: 'cancelled', reason: 'x'.repeat(501) })).code, 'INVALID_INPUT');
  assert.equal(validateOrderTransition(makeOrder(), makeRequest({ toStatus: 'cancelled', reason: 'x'.repeat(500) })).ok, true);
});

test('VNPay cannot progress until server-confirmed paid; cancellation does not pretend to refund', () => {
  for (const payment of ['pending', 'unpaid', 'failed', 'refunded']) assert.equal(validateOrderTransition(makeOrder({ method: 'VNPay', payment }), makeRequest()).code, 'PAYMENT_NOT_PAID');
  const result = applyOrderTransition(makeOrder({ method: 'VNPAY', payment: 'paid' }), makeRequest({ toStatus: 'cancelled', reason: 'Đổi nhu cầu' }), now);
  assert.equal(result.ok, true);
  assert.equal(result.order.payment, 'paid');
  assert.equal(result.order.refundRequired, true);
});

test('COD only becomes paid at shipping -> delivered with explicit collection confirmation', () => {
  const order = makeOrder({ status: 'shipping' });
  for (const codCollected of [undefined, false]) assert.equal(validateOrderTransition(order, makeRequest({ toStatus: 'delivered', codCollected })).code, 'COD_COLLECTION_REQUIRED');
  assert.equal(validateOrderTransition(order, makeRequest({ toStatus: 'delivered', codCollected: 'true' })).code, 'INVALID_INPUT');
  const delivery = applyOrderTransition(order, makeRequest({ toStatus: 'delivered', codCollected: true }), now);
  assert.equal(delivery.order.status, 'delivered');
  assert.equal(delivery.order.payment, 'paid');
  assert.equal(delivery.order.version, 2);
  const complete = applyOrderTransition(delivery.order, makeRequest({ toStatus: 'completed', expectedVersion: 2 }), now);
  assert.equal(complete.ok, true);
  assert.equal(complete.order.payment, 'paid');
  assert.equal(validateOrderTransition(makeOrder({ status: 'delivered' }), makeRequest({ toStatus: 'completed' })).code, 'PAYMENT_NOT_PAID');
});

test('COD cannot be marked paid during confirmation or use collection field at another step', () => {
  assert.equal(validateOrderTransition(makeOrder(), makeRequest({ codCollected: true })).code, 'INVALID_INPUT');
  assert.equal(validateOrderTransition(makeOrder({ payment: 'paid' }), makeRequest()).code, 'INVALID_INPUT');
  const result = applyOrderTransition(makeOrder(), makeRequest(), now);
  assert.equal(result.order.payment, 'unpaid');
});

test('stale or invalid versions reject mutation; repeated event cannot append another history entry', () => {
  for (const expectedVersion of [undefined, 0, 1.5, '1']) assert.equal(validateOrderTransition(makeOrder(), makeRequest({ expectedVersion })).code, 'INVALID_INPUT');
  assert.equal(validateOrderTransition(makeOrder({ version: 2 }), makeRequest()).code, 'ORDER_VERSION_CONFLICT');
  const first = applyOrderTransition(makeOrder(), makeRequest(), now);
  const repeated = applyOrderTransition(first.order, makeRequest(), now);
  assert.equal(repeated.ok, false);
  assert.strictEqual(repeated.order, first.order);
  assert.equal(repeated.order.history.length, 1);
});

test('successful transition is immutable and records source, target, actor, timestamp and reason', () => {
  const order = makeOrder();
  const original = structuredClone(order);
  const result = applyOrderTransition(order, makeRequest({ toStatus: 'cancelled', reason: '  Đổi nhu cầu  ' }), now);
  assert.deepEqual(order, original);
  assert.notStrictEqual(result.order, order);
  assert.equal(result.order.version, 2);
  assert.equal(result.order.history.length, 1);
  assert.deepEqual(result.order.history[0], {
    fromStatus: 'pending', toStatus: 'cancelled', status: 'cancelled', actorId: 'sales-1', actorRole: 'SALES', actor: 'Nhân viên bán hàng',
    createdAt: '2026-10-07T02:00:00.000Z', date: new Date(now).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), reason: 'Đổi nhu cầu',
  });
});

test('invalid snapshot or timestamp does not throw or modify order', () => {
  for (const patch of [{ status: 'unknown' }, { method: 123 }, { method: null }, { payment: 'unknown' }, { history: null }]) assert.equal(validateOrderTransition(makeOrder(patch), makeRequest()).code, 'INVALID_INPUT');
  const order = makeOrder();
  const result = applyOrderTransition(order, makeRequest(), 'not-a-date');
  assert.equal(result.ok, false);
  assert.strictEqual(result.order, order);
});

test('all fixture histories obey state edges and stop at their displayed state', () => {
  for (const order of initialOrders()) {
    assert.equal(order.version, order.history.length);
    assert.equal(order.history[0].status, 'pending');
    assert.equal(order.history.at(-1).status, order.status);
    for (let index = 1; index < order.history.length; index++) {
      const from = order.history[index - 1].status;
      const to = order.history[index].status;
      assert.equal(order.history[index].fromStatus, from);
      assert.equal(order.history[index].toStatus, to);
      assert.equal(nextOrderStatus[from] === to || (to === 'cancelled' && canCancelOrder(from)), true, `${order.id}: ${from} -> ${to}`);
    }
  }
});
