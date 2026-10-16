import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client as BaseClient, password } from './api-test-client.mjs';

// Chạy với API PHP + MySQL đã áp baseline, migration 010 và seed demo. Test tạo tài khoản mới mỗi lần chạy:
// chỉ dùng database thử nghiệm, không chạy trên dữ liệu thật.
const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let phoneSeq = 0;
const freshPhone = () => `09${unique.slice(-7)}${phoneSeq++}`.slice(0, 10);

class Client extends BaseClient {
  async register(email, extra = {}) { await this.init(); return this.request('/auth/register', 'POST', { fullName: 'Khách test', email, phone: freshPhone(), password, ...extra }); }
}

test('HTTP contract: cookie HttpOnly, CSRF, CORS, JSON lỗi và method', async () => {
  const client = new Client();
  const initial = await client.init();
  assert.equal(initial.json.data.user, null);
  const session = initial.setCookies.find(line => line.startsWith('HOMECARE_SESSION='));
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=Lax/i);
  assert.equal(client.cookies['XSRF-TOKEN'], client.token);
  assert.equal((await client.request('/users/me')).status, 401);
  assert.equal((await client.request('/auth/login', 'POST', {}, { 'X-CSRF-Token': 'bad' })).status, 403);
  assert.equal((await client.request('/auth/me', 'GET', undefined, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await client.request('/auth/login', 'POST', '{bad-json')).status, 400);
  assert.equal((await client.request('/auth/login', 'POST', [])).status, 422);
  assert.equal((await client.request('/auth/login', 'POST', 'x'.repeat(65537))).status, 413);
  assert.equal((await client.request('/auth/logout')).status, 405);
  assert.equal((await client.request('/auth/missing')).status, 404);
});

test('Ba role nội bộ đăng nhập đúng cổng; API kiểm tra role', async () => {
  const client = new Client();
  await client.init();
  assert.equal((await client.request('/auth/staff/login', 'POST', { identifier: 'customer@example.test', password })).status, 401);
  assert.equal((await client.request('/auth/login', 'POST', { identifier: 'admin@example.test', password })).status, 401);
  assert.equal((await client.request('/auth/staff/login', 'POST', { identifier: 'admin@example.test', password: `${password} ` })).status, 401);
  assert.equal((await client.request('/auth/staff/login', 'POST', { identifier: 'admin@example.test', password: '' })).status, 422);
  for (const role of ['ADMIN', 'SALES', 'WAREHOUSE']) {
    const oldSession = client.cookies.HOMECARE_SESSION;
    const response = await client.request('/auth/staff/login', 'POST', { identifier: `${role.toLowerCase()}@example.test`, password });
    assert.equal(response.status, 200);
    assert.notEqual(client.cookies.HOMECARE_SESSION, oldSession);
    assert.equal(response.json.data.user.role, role);
    assert.ok(!JSON.stringify(response.json).includes('password'));
    assert.equal((await client.request('/users/me')).status, 200);
    assert.equal((await client.request('/users/me/addresses')).status, 403);
    assert.equal((await client.request('/users/me', 'PATCH', { role: 'CUSTOMER' })).status, 422);
    assert.equal((await client.request('/api/products', 'POST', {})).status, role === 'ADMIN' ? 422 : 403);
    assert.equal((await client.request('/auth/logout', 'POST')).status, 200);
    assert.equal((await client.request('/users/me')).status, 401);
  }
  assert.equal((await client.request('/api/products', 'POST', {})).status, 401);
});

test('Đăng ký CUSTOMER, hồ sơ và CRUD địa chỉ giữ một mặc định, cô lập chủ sở hữu', async () => {
  const client = new Client();
  await client.init();
  assert.equal((await client.request('/auth/register', 'POST', { fullName: 'X', email: `a${unique}@example.test`, password, role: 'ADMIN' })).status, 422);
  assert.equal((await client.request('/auth/register', 'POST', { fullName: 'X', email: `a${unique}@example.test`, password: 'short' })).status, 422);
  const signedUp = await client.register(`signup${unique}@example.test`);
  assert.equal(signedUp.status, 201);
  assert.equal(signedUp.json.data.user.role, 'CUSTOMER');
  assert.equal((await new Client().register(`signup${unique}@example.test`)).status, 409);
  assert.equal((await client.request('/users/me', 'PATCH', { email: 'admin@example.test' })).status, 422);
  assert.equal((await client.request('/users/me', 'PATCH', { phone: '0901234567' })).status, 409);
  assert.equal((await client.request('/users/me', 'PATCH', { birthDate: '2999-01-01' })).status, 422);
  const profile = await client.request('/users/me', 'PATCH', { fullName: 'Tên cập nhật', birthDate: '2000-02-29' });
  assert.equal(profile.status, 200);
  assert.equal(profile.json.data.birthDate, '2000-02-29');
  const address = { recipientName: 'Khách test', phone: '+84 901 111 111', addressLine: '12 Đường demo', province: 'TP. Hồ Chí Minh', isDefault: false };
  assert.equal((await client.request('/users/me/addresses', 'POST', { ...address, userId: '1' })).status, 422);
  assert.equal((await client.request('/users/me/addresses', 'POST', { ...address, phone: [] })).status, 422);
  let response = await client.request('/users/me/addresses', 'POST', address);
  assert.equal(response.status, 201);
  assert.equal(response.json.data[0].isDefault, true);
  assert.equal(response.json.data[0].phone, '0901111111');
  const first = response.json.data[0].id;
  response = await client.request('/users/me/addresses', 'POST', address);
  const second = response.json.data[1].id;
  response = await client.request(`/users/me/addresses/${second}`, 'PATCH', { isDefault: true });
  assert.equal(response.json.data.filter(item => item.isDefault).length, 1);
  assert.equal(response.json.data[1].isDefault, true);
  assert.equal((await client.request(`/users/me/addresses/${second}`, 'PATCH', { isDefault: false })).status, 422);
  response = await client.request(`/users/me/addresses/${second}`, 'DELETE');
  assert.equal(response.json.data.length, 1);
  assert.equal(response.json.data[0].isDefault, true);
  const stranger = new Client();
  await stranger.register(`stranger${unique}@example.test`);
  assert.deepEqual((await stranger.request('/users/me/addresses')).json.data, []);
  assert.equal((await stranger.request(`/users/me/addresses/${first}`, 'PATCH', { isDefault: true })).status, 404);
  assert.equal((await stranger.request(`/users/me/addresses/${first}`, 'DELETE')).status, 404);
  assert.deepEqual((await client.request(`/users/me/addresses/${first}`, 'DELETE')).json.data, []);
  assert.equal((await client.request(`/users/me/addresses/${first}`, 'DELETE')).status, 404);
});

test('Hai request đồng thời đặt mặc định vẫn chỉ còn một địa chỉ mặc định', async () => {
  const client = new Client();
  await client.register(`race${unique}@example.test`);
  // Hai phiên khác nhau: PHP khóa file session nên cùng một phiên sẽ tự tuần tự hóa, không thử được khóa MySQL.
  const second = new Client();
  await second.init();
  await second.request('/auth/login', 'POST', { identifier: `race${unique}@example.test`, password });
  const address = { recipientName: 'Khách test', phone: '0901111111', addressLine: '1 Đường demo', province: 'Hà Nội' };
  await client.request('/users/me/addresses', 'POST', address);
  await client.request('/users/me/addresses', 'POST', address);
  await Promise.all([client.request('/users/me/addresses', 'POST', { ...address, isDefault: true }), second.request('/users/me/addresses', 'POST', { ...address, isDefault: true })]);
  const list = (await client.request('/users/me/addresses')).json.data;
  assert.equal(list.length, 4);
  assert.equal(list.filter(item => item.isDefault).length, 1);
});

test('Sai mật khẩu 5 lần khóa tài khoản; đổi mật khẩu hủy phiên khác; quên mật khẩu dùng mã một lần', async () => {
  const email = `lock${unique}@example.test`;
  const owner = new Client();
  await owner.register(email);
  const other = new Client();
  await other.init();
  assert.equal((await other.request('/auth/login', 'POST', { identifier: email, password })).status, 200);
  assert.equal((await owner.request('/auth/password/change', 'POST', { currentPassword: 'wrong-pass1', newPassword: 'NewPass2026' })).status, 422);
  assert.equal((await owner.request('/auth/password/change', 'POST', { currentPassword: password, newPassword: 'NewPass2026' })).status, 200);
  assert.equal((await owner.request('/users/me')).status, 200);
  assert.equal((await other.request('/users/me')).status, 401);

  const attacker = new Client();
  await attacker.init();
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await attacker.request('/auth/login', 'POST', { identifier: email, password: 'Wrong12345' })).status, 401);
  assert.equal((await attacker.request('/auth/login', 'POST', { identifier: email, password: 'NewPass2026' })).status, 429);

  const reset = new Client();
  await reset.init();
  assert.equal((await reset.request('/auth/password-reset/request', 'POST', { contact: 'nobody@example.test' })).status, 404);
  const challenge = (await reset.request('/auth/password-reset/request', 'POST', { contact: email.toUpperCase() })).json.data;
  assert.match(challenge.previewCode, /^\d{6}$/);
  assert.equal((await reset.request('/auth/password-reset/request', 'POST', { contact: email })).status, 429);
  assert.equal((await reset.request('/auth/password-reset/confirm', 'POST', { resetToken: 'guess', newPassword: 'Reset2026x' })).status, 422);
  const wrong = challenge.previewCode === '000000' ? '000001' : '000000';
  assert.equal((await reset.request('/auth/password-reset/verify', 'POST', { challengeId: challenge.challengeId, code: wrong })).status, 422);
  const verified = await reset.request('/auth/password-reset/verify', 'POST', { challengeId: challenge.challengeId, code: challenge.previewCode });
  assert.equal(verified.status, 200);
  assert.equal((await reset.request('/auth/password-reset/verify', 'POST', { challengeId: challenge.challengeId, code: challenge.previewCode })).status, 422);
  assert.equal((await reset.request('/auth/password-reset/confirm', 'POST', { resetToken: verified.json.data.resetToken, newPassword: 'Reset2026x' })).status, 200);
  assert.equal((await reset.request('/auth/password-reset/confirm', 'POST', { resetToken: verified.json.data.resetToken, newPassword: 'Reset2026y' })).status, 422);
  assert.equal((await owner.request('/users/me')).status, 401);
  const after = new Client();
  await after.init();
  assert.equal((await after.request('/auth/login', 'POST', { identifier: email, password: 'Reset2026x' })).status, 200);
});
