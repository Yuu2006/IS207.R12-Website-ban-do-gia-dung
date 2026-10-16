import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressErrors, normalizeContact, passwordError, profileErrors, registerErrors, safeReturnPath } from '../src/utils/account-validation.js';

const address = { recipientName: 'Khách demo', phone: '+84 901 234 567', addressLine: '12 Đường thử nghiệm', province: 'TP. Hồ Chí Minh', district: '', ward: '', isDefault: false };

test('contact normalization matches PHP normalizeContact', () => {
  assert.equal(normalizeContact(' Customer@Example.TEST '), 'customer@example.test');
  assert.equal(normalizeContact('+84 901.234-567'), '0901234567');
});

test('password rule mirrors backend: 8–200 chars with letters and digits', () => {
  for (const ok of ['abcdefg1', 'Mật khẩu 2026', 'Demo@1234567890!']) assert.equal(passwordError(ok), '', ok);
  for (const bad of ['', 'abc1', 'abcdefgh', '12345678', 'a1'.repeat(101), undefined]) assert.notEqual(passwordError(bad), '', String(bad));
});

test('registration requires name, valid email, matching password; phone optional', () => {
  const valid = { fullName: 'Khách mới', email: 'new@example.test', phone: '', password: 'abcdefg1', confirmPassword: 'abcdefg1' };
  assert.deepEqual(registerErrors(valid), {});
  const errors = registerErrors({ ...valid, fullName: ' ', email: 'x@', phone: '123', confirmPassword: 'other' });
  assert.deepEqual(Object.keys(errors).sort(), ['confirmPassword', 'email', 'fullName', 'phone']);
});

test('profile rejects future or malformed birth dates and bad phone', () => {
  assert.deepEqual(profileErrors({ fullName: 'A', phone: '', birthDate: '' }, '2026-10-16'), {});
  assert.deepEqual(Object.keys(profileErrors({ fullName: 'A', phone: '12', birthDate: '2026-10-17' }, '2026-10-16')).sort(), ['birthDate', 'phone']);
  assert.ok(profileErrors({ fullName: 'A', birthDate: '16/10/2000' }).birthDate);
});

test('address requires recipient, phone, line, province and boolean default', () => {
  assert.deepEqual(addressErrors(address), {});
  assert.deepEqual(Object.keys(addressErrors({ ...address, recipientName: '', phone: '1', province: '', isDefault: 'true' })).sort(), ['isDefault', 'phone', 'province', 'recipientName']);
});

test('return path accepts only same-site paths', () => {
  for (const path of ['/profile', '/admin/products?tab=sku']) assert.equal(safeReturnPath(path), path);
  for (const path of [undefined, 'https://evil.test', '//evil.test', '/\\evil.test', '/a/../b', 'profile']) assert.equal(safeReturnPath(path), '', String(path));
});
