import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, password } from './api-test-client.mjs';

// STT 25: ma trận role x endpoint (401 chưa đăng nhập, 403 sai role, 200 đúng role) và cô lập dữ liệu giữa khách hàng.
// Chạy với API + DB đã seed demo. Chỉ gọi GET nên không đổi dữ liệu; test dữ liệu chéo tạo một tài khoản khách mới.
const ALL = ['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE'];
const matrix = [
  ['/users/me/addresses', ['CUSTOMER']], ['/orders', ['CUSTOMER']], ['/cart', ['CUSTOMER']], ['/wishlist', ['CUSTOMER']],
  ['/sales/orders', ['SALES', 'ADMIN']], ['/returns', ['SALES', 'ADMIN', 'WAREHOUSE']],
  ['/admin/users', ['ADMIN']], ['/api/inventory', ['ADMIN', 'WAREHOUSE']], ['/api/inventory/movements', ['ADMIN', 'WAREHOUSE']],
  ['/api/admin/fit-rules', ['ADMIN']], ['/admin/dashboard', ['ADMIN']], ['/admin/reports/revenue.csv', ['ADMIN']],
];

async function login(role) {
  const client = new Client();
  await client.init();
  const response = role === 'CUSTOMER'
    ? await client.request('/auth/login', 'POST', { identifier: 'customer@example.test', password })
    : await client.staff(role);
  assert.equal(response.status, 200, `login ${role}`);
  return client;
}

test('Ma trận role x endpoint: 401 khi chưa đăng nhập, 403 sai role, đúng role không bị chặn', async () => {
  const anonymous = new Client();
  await anonymous.init();
  const sessions = Object.fromEntries(await Promise.all(ALL.map(async role => [role, await login(role)])));
  for (const [path, allowed] of matrix) {
    assert.equal((await anonymous.request(path)).status, 401, `${path} anonymous`);
    for (const role of ALL) {
      const { status } = await sessions[role].request(path);
      if (allowed.includes(role)) assert.ok(status !== 401 && status !== 403, `${path} ${role} phải qua guard, nhận ${status}`);
      else assert.equal(status, 403, `${path} ${role}`);
    }
  }
});

test('Khách không đọc được đơn của khách khác; đổi role/ID trong request bị từ chối', async () => {
  const owner = await login('CUSTOMER');
  const orders = (await owner.request('/orders')).json.data;
  const list = orders.items ?? orders.orders ?? orders;
  assert.ok(Array.isArray(list) && list.length > 0, 'tài khoản demo cần có ít nhất một đơn (seed)');
  const orderId = list[0].orderId ?? list[0].id;

  const stranger = new Client();
  await stranger.init();
  const email = `rbac${Date.now()}@example.test`;
  assert.equal((await stranger.request('/auth/register', 'POST', { fullName: 'Khách lạ', email, phone: `09${String(Date.now()).slice(-8)}`, password })).status, 201);
  assert.ok([403, 404].includes((await stranger.request(`/orders/${orderId}`)).status), 'GET đơn của người khác');
  assert.ok([403, 404].includes((await stranger.request(`/orders/${orderId}/cancel`, 'POST', { expectedVersion: 1, reason: 'test' }, { 'Idempotency-Key': `rbac-${Date.now()}-cancel-key` })).status), 'hủy đơn của người khác');
  assert.equal((await stranger.request('/orders')).json.data.total ?? 0, 0, 'danh sách đơn của khách mới phải rỗng');

  const customer = await login('CUSTOMER');
  assert.equal((await customer.request('/users/me', 'PATCH', { role: 'ADMIN' })).status, 422, 'không tự nâng role');
  assert.equal((await customer.request('/admin/users', 'GET')).status, 403);
});
