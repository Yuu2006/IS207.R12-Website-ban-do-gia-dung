import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import * as demo from './demo-service.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

beforeEach(() => { globalThis.localStorage = new MemoryStorage(); globalThis.sessionStorage = new MemoryStorage(); });
const validAddress = { recipientName: 'Khách hàng demo', phone: '0901234567', addressLine: '12 Đường thử nghiệm', province: 'TP. Hồ Chí Minh', district: '', ward: '', isDefault: false };
async function customer(contact = 'customer@example.test', flow = 'login') {
  const challenge = await demo.requestDemoOtp({ flow, contact, fullName: 'Tài khoản thử nghiệm' });
  return demo.verifyDemoOtp({ challengeId: challenge.challengeId, code: challenge.previewCode });
}

test('Ba role nội bộ đăng nhập đúng tài khoản; mật khẩu sai và customer bị từ chối', async () => {
  for (const role of ['ADMIN', 'SALES', 'WAREHOUSE']) {
    const session = await demo.loginDemoStaff({ identifier: `${role.toLowerCase()}@example.test`, password: demo.demoPassword });
    assert.equal(session.user.role, role);
    assert.ok(session.expiresAt > Date.now());
    await assert.rejects(demo.listDemoAddresses(), { status: 403 });
    await demo.logoutDemo();
    assert.equal((await demo.getDemoSession()).user, null);
  }
  await assert.rejects(demo.loginDemoStaff({ identifier: 'admin@example.test', password: 'wrong' }), { status: 401 });
  await assert.rejects(demo.loginDemoStaff({ identifier: 'admin@example.test', password: `${demo.demoPassword} ` }), { status: 401 });
  await assert.rejects(demo.loginDemoStaff({ identifier: 'customer@example.test', password: demo.demoPassword }), { status: 401 });
});

test('OTP kiểm tra cooldown, mã sai và mã đã dùng; đăng ký chỉ tạo CUSTOMER', async () => {
  const challenge = await demo.requestDemoOtp({ flow: 'register', contact: 'new@example.test', fullName: 'Khách mới' });
  await assert.rejects(demo.requestDemoOtp({ flow: 'register', contact: 'other@example.test', fullName: 'Khách mới' }), { status: 429 });
  await assert.rejects(demo.verifyDemoOtp({ challengeId: challenge.challengeId, code: 'wrong' }), { status: 422 });
  const session = await demo.verifyDemoOtp({ challengeId: challenge.challengeId, code: challenge.previewCode });
  assert.equal(session.user.role, 'CUSTOMER');
  assert.equal(session.user.email, 'new@example.test');
  await assert.rejects(demo.verifyDemoOtp({ challengeId: challenge.challengeId, code: challenge.previewCode }), { status: 422 });
  await assert.rejects(demo.requestDemoOtp({ flow: 'register', contact: 'new@example.test', fullName: 'Khách mới' }), { status: 409 });
});

test('OTP hết hạn và vượt số lần thử không tạo phiên', async () => {
  const challenge = await demo.requestDemoOtp({ flow: 'login', contact: '0901234567' });
  const wrongCode = challenge.previewCode === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 6; attempt++) await assert.rejects(demo.verifyDemoOtp({ challengeId: challenge.challengeId, code: wrongCode }));
  await assert.rejects(demo.verifyDemoOtp({ challengeId: challenge.challengeId, code: challenge.previewCode }));
  assert.equal((await demo.getDemoSession()).user, null);
  const expired = { ...JSON.parse(sessionStorage.getItem('homecare.demo.challenge.v1') || '{}'), challengeId: 'expired', expiresAt: Date.now() - 1 };
  sessionStorage.setItem('homecare.demo.challenge.v1', JSON.stringify(expired));
  await assert.rejects(demo.verifyDemoOtp({ challengeId: 'expired', code: '123456' }));
});

test('Hồ sơ bắt buộc tên và liên hệ, không đổi ID/role, báo xung đột liên hệ', async () => {
  await customer();
  await assert.rejects(demo.updateDemoProfile({ fullName: '', email: '', phone: '' }), { status: 422 });
  await assert.rejects(demo.updateDemoProfile({ fullName: 'Khách', email: 'bad', phone: '123' }), { status: 422 });
  await assert.rejects(demo.updateDemoProfile({ fullName: 'Khách', email: 'admin@example.test', phone: '' }), { status: 409 });
  await assert.rejects(demo.updateDemoProfile({ role: 'ADMIN', id: 'demo-admin' }), { status: 422 });
  await assert.rejects(demo.updateDemoProfile({ fullName: [] }), { status: 422 });
  const user = await demo.updateDemoProfile({ fullName: 'Tên cập nhật', phone: '+84 901 234 567' });
  assert.equal(user.role, 'CUSTOMER');
  assert.equal(user.id, 'demo-customer');
  assert.equal((await demo.getDemoProfile()).fullName, 'Tên cập nhật');
  assert.equal(user.phone, '0901234567');
  assert.equal(user.email, 'customer@example.test');
});

test('CRUD địa chỉ duy trì một mặc định, merge PATCH và thay thế khi xóa mặc định', async () => {
  await customer();
  await assert.rejects(demo.saveDemoAddress(null, { ...validAddress, province: '' }), { status: 422 });
  await assert.rejects(demo.saveDemoAddress(null, { ...validAddress, userId: 'other' }), { status: 422 });
  await assert.rejects(demo.saveDemoAddress(null, { ...validAddress, phone: [] }), { status: 422 });
  let addresses = await demo.saveDemoAddress(null, validAddress);
  const first = addresses[0].id;
  assert.equal(addresses[0].isDefault, true);
  addresses = await demo.saveDemoAddress(null, { ...validAddress, recipientName: 'Địa chỉ hai' });
  const second = addresses[1].id;
  addresses = await demo.saveDemoAddress(second, { isDefault: true });
  assert.equal(addresses.filter(address => address.isDefault).length, 1);
  assert.equal(addresses.find(address => address.id === second).phone, '0901234567');
  await assert.rejects(demo.saveDemoAddress(second, { isDefault: false }), { status: 422 });
  addresses = await demo.saveDemoAddress(first, { addressLine: 'Địa chỉ đã chỉnh sửa' });
  assert.equal(addresses[0].addressLine, 'Địa chỉ đã chỉnh sửa');
  addresses = await demo.deleteDemoAddress(second);
  assert.equal(addresses[0].isDefault, true);
  assert.equal((await demo.listDemoAddresses()).length, 1);
  assert.deepEqual(await demo.deleteDemoAddress(first), []);
  await assert.rejects(demo.deleteDemoAddress(first), { status: 404 });
});

test('Dữ liệu tách theo chủ sở hữu; phiên hết hạn và chưa đăng nhập bị từ chối', async () => {
  await assert.rejects(demo.getDemoProfile(), { status: 401 });
  await customer();
  const [address] = await demo.saveDemoAddress(null, validAddress);
  await demo.logoutDemo();
  await customer('second@example.test', 'register');
  assert.deepEqual(await demo.listDemoAddresses(), []);
  await assert.rejects(demo.saveDemoAddress(address.id, { isDefault: true }), { status: 404 });
  await assert.rejects(demo.deleteDemoAddress(address.id), { status: 404 });
  sessionStorage.setItem('homecare.demo.session.v1', JSON.stringify({ userId: 'demo-customer', expiresAt: Date.now() - 1 }));
  assert.equal((await demo.getDemoSession()).user, null);
  await assert.rejects(demo.listDemoAddresses(), { status: 401 });
});

test('Lỗi lưu dữ liệu được báo về, không trả thành công giả', async () => {
  await customer();
  localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  await assert.rejects(demo.saveDemoAddress(null, validAddress), { status: 500 });
  assert.deepEqual(await demo.listDemoAddresses(), []);
});
