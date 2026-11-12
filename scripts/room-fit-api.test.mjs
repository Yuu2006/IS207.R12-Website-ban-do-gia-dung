import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, password } from './api-test-client.mjs';

// HOME-01/FIT-01 trên API PHP + MySQL thật (cần seed 001, 003, 006, 010). Hồ sơ tạo ra được xóa mềm cuối test.
async function login(identifier) {
  const client = new Client();
  await client.init();
  assert.equal((await client.request('/auth/login', 'POST', { identifier, password })).status, 200);
  return client;
}

test('Hồ sơ phòng chỉ CUSTOMER chủ sở hữu dùng được; FitCheck trả đủ ba mức có giải thích', async () => {
  const anonymous = new Client();
  await anonymous.init();
  assert.equal((await anonymous.request('/api/room-profiles')).status, 401);
  const sales = new Client();
  await sales.staff('SALES');
  assert.equal((await sales.request('/api/room-profiles')).status, 403);

  const owner = await login('customer@example.test');
  const other = await login('lan.tran@example.test');
  assert.equal((await owner.request('/api/room-profiles', 'POST', { name: 'CSRF' }, { 'X-CSRF-Token': 'bad' })).status, 403);

  const invalid = await owner.request('/api/room-profiles', 'POST', { name: ' ', placementWidthMm: 0, floorAreaM2: 1.234, waterSupply: 'yes' });
  assert.equal(invalid.status, 422);
  assert.deepEqual(Object.keys(invalid.json.errors).sort(), ['floorAreaM2', 'name', 'placementWidthMm', 'waterSupply']);
  assert.equal((await owner.request('/api/room-profiles', 'POST', { name: 'X', userId: 1 })).status, 422);

  const full = { placementWidthMm: 5000, placementDepthMm: 5000, placementHeightMm: 5000, doorWidthMm: 5000, floorAreaM2: 12.5, occupantCount: 2, powerAvailable: true, waterSupply: true, drainage: true };
  const created = await owner.request('/api/room-profiles', 'POST', { name: 'Phòng test FitCheck', ...full });
  assert.equal(created.status, 201);
  const room = created.json.data;
  assert.equal(room.floorAreaM2, 12.5);
  assert.equal(room.isDefault, false);

  const partial = await owner.request(`/api/room-profiles/${room.id}`, 'PATCH', { occupantCount: null });
  assert.equal(partial.status, 200);
  assert.equal(partial.json.data.occupantCount, null);
  assert.equal(partial.json.data.placementWidthMm, 5000);

  assert.equal((await other.request(`/api/room-profiles/${room.id}`, 'PATCH', { name: 'Chiếm' })).status, 404);
  assert.equal((await other.request(`/api/room-profiles/${room.id}`, 'DELETE')).status, 404);
  assert.ok(!(await other.request('/api/room-profiles')).json.data.some(item => item.id === room.id));

  const products = (await owner.request('/api/products?is_active=1')).json.data;
  const fridge = products.find(product => product.category_slug === 'tu-lanh' && product.product_code !== 'TL-012');
  const check = (client, roomProfileId, productId = fridge.id) => client.request('/api/fit-checks', 'POST', { productId, roomProfileId, requestKey: randomUUID() });

  const fit = await check(owner, room.id);
  assert.equal(fit.status, 200);
  assert.equal(fit.json.data.result, 'FIT');
  assert.equal(fit.json.data.label, 'Phù hợp');
  assert.ok(fit.json.data.checks.length >= 4 && fit.json.data.checks.every(item => item.status === 'PASS' && item.explanation));

  await owner.request(`/api/room-profiles/${room.id}`, 'PATCH', { placementHeightMm: null });
  const unknown = await check(owner, room.id);
  assert.equal(unknown.json.data.result, 'NEEDS_CHECK');
  assert.equal(unknown.json.data.checks.find(item => item.status === 'MISSING').limit, null);

  await owner.request(`/api/room-profiles/${room.id}`, 'PATCH', { placementWidthMm: 100 });
  const blocked = await check(owner, room.id);
  assert.equal(blocked.json.data.result, 'NOT_FIT');
  assert.ok(blocked.json.data.checks.some(item => item.status === 'FAIL' && item.severity === 'BLOCK'));

  assert.equal((await check(other, room.id)).status, 404);
  assert.equal((await check(owner, room.id, 99999999)).status, 404);
  assert.equal((await owner.request('/api/fit-checks', 'POST', { productId: fridge.id, roomProfileId: room.id, requestKey: 'abc' })).status, 422);
  assert.equal((await owner.request('/api/fit-checks', 'POST', { productId: fridge.id, roomDraft: {}, requestKey: randomUUID() })).status, 422);

  assert.equal((await owner.request(`/api/room-profiles/${room.id}`, 'DELETE')).status, 200);
  assert.equal((await owner.request(`/api/room-profiles/${room.id}`, 'PATCH', { name: 'Đã xóa' })).status, 404);
  assert.ok(!(await owner.request('/api/room-profiles')).json.data.some(item => item.id === room.id));
});
