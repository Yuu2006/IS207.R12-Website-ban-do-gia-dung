import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  comparableCandidates,
  comparisonSpecs,
  findRequestedProduct,
  productPrice,
  productionYear,
} from '../src/utils/product-comparison.js';

const products = [
  { id: 1, name: 'Tủ lạnh A', category_id: 10 },
  { id: 2, name: 'Tủ lạnh B', category_id: 10 },
  { id: 3, name: 'Máy giặt C', category_id: 20 },
];

test('only another product in the selected API category can be compared', () => {
  assert.deepEqual(comparableCandidates(products, products[0]).map(item => item.id), [2]);
  assert.deepEqual(comparableCandidates(products, null), []);
});

test('a storefront mock ID cannot silently select a different API product', () => {
  assert.equal(findRequestedProduct(products, '1', 'Tủ lạnh A')?.id, 1);
  assert.equal(findRequestedProduct(products, '1', 'Máy giặt A'), null);
  assert.equal(findRequestedProduct(products, ''), null);
});

test('price uses the cheapest active effective variant and falls back to list price', () => {
  assert.equal(productPrice({ min_price: '900', variants: [
    { effective_price: '850', is_active: 1 },
    { effective_price: '800', is_active: 0 },
    { effective_price: '700', is_active: 1 },
  ] }), 700);
  assert.equal(productPrice({ min_price: '900' }), 900);
  assert.equal(productPrice({ min_price: 0 }), null);
});

test('year stays empty when absent and accepts a later dynamic attribute', () => {
  assert.equal(productionYear(products[0]), null);
  assert.equal(productionYear({ attributes: [{ attribute_key: 'production_year', data_type: 'number', value_number: '2025' }] }), '2025');
});

test('dynamic criteria keep missing values visible without turning false into missing', () => {
  const first = {
    attributes: [
      { attribute_key: 'capacity', name: 'Dung tích', data_type: 'number', value_number: '300', unit: 'L' },
      { attribute_key: 'inverter', name: 'Inverter', data_type: 'boolean', value_boolean: 0 },
      { attribute_key: 'production_year', name: 'Năm sản xuất', data_type: 'number', value_number: '2024' },
    ],
    specifications: JSON.stringify({ 'Dung tích': '299 L', 'Chế độ': 'Tiết kiệm' }),
  };
  const second = {
    attributes: [
      { attribute_key: 'capacity', name: 'Dung tích', data_type: 'number', value_number: null, unit: 'L' },
      { attribute_key: 'inverter', name: 'Inverter', data_type: 'boolean', value_boolean: 1 },
    ],
    specifications: { 'Dung tích': '350 L' },
  };
  const rows = comparisonSpecs(first, second);
  assert.deepEqual(rows.map(row => [row.label, ...row.values]), [
    ['Dung tích', '300 L', '350 L'],
    ['Inverter', 'Không', 'Có'],
    ['Chế độ', 'Tiết kiệm', null],
  ]);
});
