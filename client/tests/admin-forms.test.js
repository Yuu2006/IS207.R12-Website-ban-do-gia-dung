import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoneyInput, parseMoneyInput, toMoneyValue } from '../src/utils/money-input.js';
import { adjustmentRequest, lineCode, sheetCode, submitStockLines } from '../src/utils/stock-sheet.js';

test('ô tiền: DECIMAL đi qua hiển thị rồi về không đổi giá trị', () => {
  for (const [server, shown, stored] of [['1890000.00', '1.890.000', '1890000'], ['1500.50', '1.500,5', '1500.5'], ['1000', '1.000', '1000'], ['0.05', '0,05', '0.05'], ['12.34', '12,34', '12.34']]) {
    assert.equal(formatMoneyInput(toMoneyValue(server)), shown);
    assert.equal(parseMoneyInput(shown), stored);
  }
  assert.equal(toMoneyValue('1000'), '1000');
  assert.equal(toMoneyValue(null), '');
  assert.equal(parseMoneyInput('1.500,5'), '1500.5');
  assert.notEqual(parseMoneyInput('1.500,5'), '15005');
});

test('ô tiền: gõ dở, bỏ ký tự lạ, tối đa 2 số lẻ, không thành NaN', () => {
  assert.equal(formatMoneyInput(parseMoneyInput('1500,')), '1.500,');
  assert.equal(parseMoneyInput('abc'), '');
  assert.equal(parseMoneyInput('007'), '7');
  assert.equal(parseMoneyInput('1,239'), '1.23');
  assert.equal(parseMoneyInput(',5'), '0.5');
  assert.equal(formatMoneyInput(''), '');
});

test('mã phiếu: đúng tiền tố, có thời gian, mã dòng ổn định và không quá 100 ký tự', () => {
  const code = sheetCode('PN', new Date('2026-11-02T08:09:10Z'), 0xab);
  assert.equal(code, 'PN-20261102080910-00ab');
  assert.equal(lineCode(code, 3), 'PN-20261102080910-00ab-3');
  assert.ok(lineCode(sheetCode('DC'), 99).length <= 100);
});

test('kiểm kê: lệch dương gửi import, lệch âm gửi export, không lệch không gửi', () => {
  const base = { sku: 'SKU-1', reference_code: 'DC-1', note: 'Kiểm kê định kỳ' };
  assert.deepEqual(adjustmentRequest({ ...base, system: 10, actual: 13 }), { sku: 'SKU-1', movement_type: 'import', quantity: 3, reference_code: 'DC-1', note: 'Kiểm kê định kỳ' });
  assert.deepEqual(adjustmentRequest({ ...base, system: 10, actual: 4 }), { sku: 'SKU-1', movement_type: 'export', quantity: 6, reference_code: 'DC-1', note: 'Kiểm kê định kỳ' });
  assert.equal(adjustmentRequest({ ...base, system: 10, actual: 10 }), null);
});

const line = (key, extra = {}) => ({ key, request: { sku: `S${key}`, movement_type: 'import', quantity: 1, reference_code: `R-${key}`, note: 'x' }, ...extra });
const apiError = (status, message) => Object.assign(new Error(message), { status });

test('gửi phiếu: dừng ở dòng lỗi đầu tiên, dòng sau không được gửi', async () => {
  const sent = [];
  const post = async request => { sent.push(request.sku); if (request.sku === 'S2') throw apiError(404, 'Không tìm thấy SKU đang hoạt động.'); return { sku: request.sku, quantity_before: 1, quantity_after: 2 }; };
  const outcome = await submitStockLines([line(1), line(2), line(3)], post);
  assert.deepEqual(sent, ['S1', 'S2']);
  assert.deepEqual(Object.keys(outcome.results), ['1']);
  assert.deepEqual(outcome.failure, { key: 2, message: 'Không tìm thấy SKU đang hoạt động.' });
});

test('gửi lại: bỏ qua dòng đã ghi, giữ nguyên mã chứng từ của dòng còn lại', async () => {
  const sent = [];
  const outcome = await submitStockLines([line(1, { result: { quantity_after: 2 } }), line(2), line(3)], async request => { sent.push(request.reference_code); return { ok: true }; });
  assert.deepEqual(sent, ['R-2', 'R-3']);
  assert.equal(outcome.failure, null);
  assert.deepEqual(Object.keys(outcome.results), ['2', '3']);
});

test('gửi lại nhận 409 thì báo kiểm tra Nhật ký kho, không coi là thành công', async () => {
  const outcome = await submitStockLines([line(1)], async () => { throw apiError(409, 'Mã tham chiếu đã tồn tại'); });
  assert.deepEqual(outcome.results, {});
  assert.match(outcome.failure.message, /Nhật ký kho/);
  assert.equal(outcome.failure.key, 1);
});

test('mất kết nối hoặc 5xx cảnh báo phiếu có thể đã ghi; lỗi nghiệp vụ giữ nguyên thông điệp', async () => {
  const fail = error => submitStockLines([line(1)], async () => { throw error; });
  assert.match((await fail(new Error('Không thể kết nối máy chủ.'))).failure.message, /có thể đã được ghi/);
  assert.match((await fail(apiError(500, 'Lỗi'))).failure.message, /có thể đã được ghi/);
  assert.equal((await fail(apiError(400, 'Số lượng xuất vượt quá tồn kho hiện tại.'))).failure.message, 'Số lượng xuất vượt quá tồn kho hiện tại.');
});
