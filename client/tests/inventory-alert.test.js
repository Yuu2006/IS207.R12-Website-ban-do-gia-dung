import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeLowStock } from '../src/utils/inventory-alert.js';

const sku = (name, stock) => ({ sku: name, stock_quantity: stock, low_stock_threshold: 5 });

test('danh sách rỗng không có cảnh báo', () => {
  assert.deepEqual(summarizeLowStock([]), { total: 0, outOfStock: 0, top: [] });
});

test('đếm hết hàng, sắp tồn tăng dần, cắt theo limit và không đổi mảng đầu vào', () => {
  const items = [5, 3, 0, 4, 0, 2, 1].map((stock, index) => sku(`S${index}`, stock));
  const copy = items.map(item => item.sku);
  const summary = summarizeLowStock(items);
  assert.equal(summary.total, 7);
  assert.equal(summary.outOfStock, 2);
  assert.equal(summary.top.length, 5);
  assert.deepEqual(summary.top.map(item => item.stock_quantity), [0, 0, 1, 2, 3]);
  assert.deepEqual(items.map(item => item.sku), copy);
});
