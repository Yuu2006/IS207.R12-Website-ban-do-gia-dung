import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  comparableCandidates,
  comparisonSpecs,
  estimateTco,
  findRequestedProduct,
  productPrice,
  productionYear,
  selectedComparisonProducts,
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

test('URL selection accepts up to four distinct products from one API category', () => {
  const catalog = [products[0], products[1], { id: 4, category_id: 10 }, { id: 5, category_id: 10 }, products[2]];
  assert.deepEqual(selectedComparisonProducts(catalog, ['1', '2', '4', '5']).map(item => item?.id), [1, 2, 4, 5]);
  assert.deepEqual(selectedComparisonProducts(catalog, ['1', '1', '3', '5']).map(item => item?.id), [1, undefined, undefined, 5]);
  assert.deepEqual(selectedComparisonProducts(catalog, ['999', '2']).map(item => item?.id), [undefined, undefined]);
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
  const rows = comparisonSpecs([first, second]);
  assert.deepEqual(rows.map(row => [row.label, ...row.values]), [
    ['Dung tích', '300 L', '350 L'],
    ['Inverter', 'Không', 'Có'],
    ['Chế độ', 'Tiết kiệm', null],
  ]);
});

test('dynamic criteria align across four columns without inventing missing values', () => {
  const rows = comparisonSpecs([
    { attributes: [{ attribute_key: 'capacity', name: 'Dung tích', data_type: 'number', value_number: 200, unit: 'L' }] },
    null,
    { attributes: [{ attribute_key: 'capacity', name: 'Dung tích', data_type: 'number', value_number: 300, unit: 'L' }] },
    null,
  ]);
  assert.deepEqual(rows[0].values, ['200 L', null, '300 L', null]);
});

test('TCO uses catalog values and explicit assumptions, preserving missing costs', () => {
  const fridge = { min_price: 1000000, category_slug: 'tu-lanh', attributes: [
    { attribute_key: 'energy_kwh_year', value_number: 100 },
  ] };
  const assumptions = { years: '3', electricityRate: '2000', waterRate: '', usesPerWeek: '', hoursPerUse: '', consumablesPerYear: '0', maintenancePerYear: '100000' };
  assert.deepEqual(estimateTco(fridge, assumptions), {
    purchase: 1000000, electricity: 600000, water: 0, consumables: 0, maintenance: 300000, total: 1900000, missing: [],
  });
  assert.equal(estimateTco(fridge, { ...assumptions, maintenancePerYear: '' }).total, null);
  assert.deepEqual(estimateTco(fridge, { ...assumptions, maintenancePerYear: '' }).missing, ['maintenance']);
});

test('washer TCO converts W to kWh and liters to cubic meters', () => {
  const washer = { min_price: 5000000, category_slug: 'may-giat', attributes: [
    { attribute_key: 'power_watts', value_number: 1000 },
    { attribute_key: 'water_liters_cycle', value_number: 100 },
  ] };
  const result = estimateTco(washer, { years: '1', electricityRate: '2000', waterRate: '10000', usesPerWeek: '2', hoursPerUse: '1', consumablesPerYear: '0', maintenancePerYear: '0' });
  assert.equal(result.electricity, 208000);
  assert.equal(result.water, 104000);
  assert.equal(result.total, 5312000);
});
