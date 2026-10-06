import { test } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.API_TEST_URL || 'http://127.0.0.1:8080';

// Client HTTP riêng cho mỗi kịch bản để kiểm tra cookie/CSRF và tách dữ liệu.
class Client {
  cookie = '';
  token = '';
  async request(path, method = 'GET', body, extraHeaders = {}) {
    const response = await fetch(baseUrl + path, { method, headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(this.token ? { 'X-CSRF-Token': this.token } : {}), 'Content-Type': 'application/json', ...extraHeaders }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const json = await response.json();
    if (json.data?.csrfToken) this.token = json.data.csrfToken;
    return { status: response.status, json, setCookie };
  }
  async init() { return this.request('/auth/me'); }
}

test('HTTP contract, cookie, CSRF, CORS, malformed JSON và method', async () => {
  const client = new Client();
  assert.equal((await client.request('/')).status, 200);
  assert.equal((await client.request('/missing')).status, 404);
  const initial = await client.init();
  assert.equal(initial.json.data.user, null);
  assert.match(initial.setCookie, /HttpOnly/i);
  assert.match(initial.setCookie, /SameSite=Lax/i);
  assert.equal((await client.request('/users/me')).status, 401);
  assert.equal((await client.request('/auth/staff/login', 'POST', {}, { 'X-CSRF-Token': 'bad' })).status, 403);
  assert.equal((await client.request('/auth/me', 'GET', undefined, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await client.request('/auth/staff/login', 'POST', '{bad-json')).status, 400);
  assert.equal((await client.request('/auth/staff/login', 'POST', [])).status, 422);
  assert.equal((await client.request('/auth/staff/login', 'POST', 'x'.repeat(65537))).status, 413);
  assert.equal((await client.request('/auth/logout')).status, 405);
});

test('Login/logout ba role nội bộ và quyền API theo role', async () => {
  const client = new Client();
  await client.init();
  assert.equal((await client.request('/auth/staff/login', 'POST', { identifier: 'admin@example.test', password: 'wrong' })).status, 401);
  assert.equal((await client.request('/auth/staff/login', 'POST', { identifier: 'admin@example.test', password: 'Demo@1234567890! ' })).status, 401);
  assert.equal((await client.request('/auth/staff/login', 'POST', { identifier: 'admin@example.test', password: '' })).status, 422);
  for (const role of ['ADMIN', 'SALES', 'WAREHOUSE']) {
    const oldCookie = client.cookie;
    const response = await client.request('/auth/staff/login', 'POST', { identifier: `${role.toLowerCase()}@example.test`, password: 'Demo@1234567890!' });
    assert.equal(response.status, 200);
    assert.notEqual(client.cookie, oldCookie);
    assert.equal(response.json.data.user.role, role);
    assert.ok(!('passwordHash' in response.json.data.user));
    assert.equal((await client.request('/users/me')).status, 200);
    assert.equal((await client.request('/users/me/addresses')).status, 403);
    assert.equal((await client.request('/users/me', 'PATCH', { role: 'CUSTOMER' })).status, 422);
    assert.equal((await client.request('/auth/logout', 'POST')).status, 200);
    assert.equal((await client.request('/users/me')).status, 401);
  }
});

test('OTP, đăng ký CUSTOMER, hồ sơ và CRUD địa chỉ giữ một mặc định', async () => {
  const client = new Client();
  await client.init();
  assert.equal((await client.request('/auth/customer/otp/request', 'POST', { flow: 'register', contact: 'signup@example.test', fullName: 'Khách test', role: 'ADMIN' })).status, 422);
  const otp = await client.request('/auth/customer/otp/request', 'POST', { flow: 'register', contact: 'signup@example.test', fullName: 'Khách test' });
  assert.equal(otp.status, 200);
  assert.match(otp.json.data.previewCode, /^\d{6}$/);
  assert.equal((await client.request('/auth/customer/otp/request', 'POST', { flow: 'login', contact: 'customer@example.test' })).status, 429);
  const verification = { challengeId: otp.json.data.challengeId, code: otp.json.data.previewCode };
  assert.equal((await client.request('/auth/customer/otp/verify', 'POST', { ...verification, code: 'bad' })).status, 422);
  const signedIn = await client.request('/auth/customer/otp/verify', 'POST', verification);
  assert.equal(signedIn.json.data.user.role, 'CUSTOMER');
  assert.equal((await client.request('/auth/customer/otp/verify', 'POST', verification)).status, 422);
  assert.equal((await client.request('/users/me', 'PATCH', { email: 'admin@example.test' })).status, 409);
  assert.equal((await client.request('/users/me', 'PATCH', { fullName: 'Tên cập nhật', phone: '+84 901 111 111' })).status, 200);
  const address = { recipientName: 'Khách test', phone: '0901111111', addressLine: '12 Đường demo', province: 'TP. Hồ Chí Minh', isDefault: false };
  assert.equal((await client.request('/users/me/addresses', 'POST', { ...address, userId: 'other' })).status, 422);
  assert.equal((await client.request('/users/me/addresses', 'POST', { ...address, phone: [] })).status, 422);
  let response = await client.request('/users/me/addresses', 'POST', address);
  assert.equal(response.status, 201);
  assert.equal(response.json.data[0].isDefault, true);
  const first = response.json.data[0].id;
  response = await client.request('/users/me/addresses', 'POST', address);
  const second = response.json.data[1].id;
  response = await client.request(`/users/me/addresses/${second}`, 'PATCH', { isDefault: true });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.filter(item => item.isDefault).length, 1);
  assert.equal(response.json.data[1].phone, address.phone);
  assert.equal((await client.request(`/users/me/addresses/${second}`, 'PATCH', { isDefault: false })).status, 422);
  response = await client.request(`/users/me/addresses/${second}`, 'DELETE');
  assert.equal(response.json.data[0].isDefault, true);
  const stranger = new Client();
  await stranger.init();
  const challenge = (await stranger.request('/auth/customer/otp/request', 'POST', { flow: 'login', contact: 'customer@example.test' })).json.data;
  await stranger.request('/auth/customer/otp/verify', 'POST', { challengeId: challenge.challengeId, code: challenge.previewCode });
  assert.deepEqual((await stranger.request('/users/me/addresses')).json.data, []);
  assert.equal((await stranger.request(`/users/me/addresses/${first}`, 'PATCH', { isDefault: true })).status, 404);
  assert.equal((await stranger.request(`/users/me/addresses/${first}`, 'DELETE')).status, 404);
  response = await client.request(`/users/me/addresses/${first}`, 'DELETE');
  assert.deepEqual(response.json.data, []);
  assert.equal((await client.request(`/users/me/addresses/${first}`, 'DELETE')).status, 404);
});

test('API demo bị khóa khi không được bật', { skip: !process.env.API_DISABLED_URL }, async () => {
  const response = await fetch(process.env.API_DISABLED_URL + '/auth/me');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});
