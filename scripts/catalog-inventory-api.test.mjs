import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, password } from './api-test-client.mjs';

// Task 12 trên API PHP + MySQL thật (DB thử nghiệm đã seed 001 + 003). Tạo dữ liệu mới mỗi lần chạy.
const unique = `${Date.now()}`.slice(-8);
// PNG 1×1 hợp lệ để thử upload thật qua finfo/getimagesize.
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0));

test('Tồn kho chỉ ADMIN/WAREHOUSE; điều chỉnh bắt buộc lý do, ghi người thực hiện, chặn tồn âm và chứng từ trùng', async () => {
  const anonymous = new Client();
  await anonymous.init();
  assert.equal((await anonymous.request('/api/inventory')).status, 401);
  assert.equal((await anonymous.request('/api/inventory/movements')).status, 401);
  const customer = new Client();
  await customer.init();
  await customer.request('/auth/login', 'POST', { identifier: 'customer@example.test', password });
  assert.equal((await customer.request('/api/inventory')).status, 403);
  const sales = new Client();
  await sales.staff('SALES');
  assert.equal((await sales.request('/api/inventory/movements', 'POST', { sku: 'TL-001-01', movement_type: 'import', quantity: 1, reference_code: `T-${unique}-S`, note: 'x' })).status, 403);

  const warehouse = new Client();
  await warehouse.staff('WAREHOUSE');
  const low = await warehouse.request('/api/inventory?low_stock=1');
  assert.equal(low.status, 200);
  assert.ok(low.json.data.every(item => item.stock_quantity <= item.low_stock_threshold));
  const before = (await warehouse.request('/api/inventory?sku=TL-002-01')).json.data[0].stock_quantity;
  const move = { sku: 'TL-002-01', movement_type: 'import', quantity: 3, reference_code: `T-${unique}-1` };
  assert.equal((await warehouse.request('/api/inventory/movements', 'POST', move)).status, 400);
  assert.equal((await warehouse.request('/api/inventory/movements', 'POST', move, { 'X-CSRF-Token': 'bad' })).status, 403);
  const created = await warehouse.request('/api/inventory/movements', 'POST', { ...move, note: 'Nhập bổ sung kiểm thử' });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.quantity_before, before);
  assert.equal(created.json.data.quantity_after, before + 3);
  assert.equal((await warehouse.request('/api/inventory/movements', 'POST', { ...move, note: 'Gửi lặp' })).status, 409);
  assert.equal((await warehouse.request('/api/inventory/movements', 'POST', { ...move, movement_type: 'export', quantity: before + 4, reference_code: `T-${unique}-2`, note: 'Quá tồn' })).status, 400);
  const history = (await warehouse.request(`/api/inventory/movements?sku=TL-002-01&page=1&pageSize=5`)).json.data;
  assert.ok(history.items.length <= 5);
  assert.equal(history.pagination.totalPages, Math.ceil(history.pagination.totalItems / 5));
  assert.equal((await warehouse.request('/api/inventory/movements?pageSize=500')).status, 400);
  const row = history.items.find(item => item.reference_code === move.reference_code);
  assert.equal(row.performed_by_name, 'Nhân viên kho demo');
  assert.equal(row.note, 'Nhập bổ sung kiểm thử');
  assert.equal((await warehouse.request('/api/inventory?sku=TL-002-01')).json.data[0].stock_quantity, before + 3);
});

test('ADMIN quản lý SKU, giá khuyến mãi, thông số và ảnh; tồn chỉ đổi qua kho', async () => {
  const admin = new Client();
  await admin.staff('ADMIN');
  const warehouse = new Client();
  await warehouse.staff('WAREHOUSE');
  assert.equal((await warehouse.request('/api/products/1/variants')).status, 403);
  const category = (await admin.request('/api/categories')).json.data.find(item => item.slug === 'tu-lanh');
  const brand = (await admin.request('/api/brands')).json.data[0];
  const product = await admin.request('/api/products', 'POST', { category_id: category.id, brand_id: brand.id, product_code: `T${unique}`, name: `Tủ lạnh kiểm thử ${unique}`, slug: `tu-lanh-kiem-thu-${unique}`, sku: `T${unique}-01`, variant_name: 'Tiêu chuẩn', price: '9990000', stock_quantity: 50 });
  assert.equal(product.status, 201);
  const productId = product.json.data.id;
  assert.equal(product.json.data.variants[0].stock_quantity, 0);

  const sku = { sku: `T${unique}-02`, variant_name: 'Màu bạc', price: '10490000' };
  assert.equal((await admin.request(`/api/products/${productId}/variants`, 'POST', { ...sku, stock_quantity: 9 })).status, 422);
  assert.equal((await admin.request(`/api/products/${productId}/variants`, 'POST', { ...sku, sale_price: '10490000' })).status, 422);
  assert.equal((await admin.request(`/api/products/${productId}/variants`, 'POST', { ...sku, price: 1500.5 })).status, 422);
  assert.equal((await admin.request(`/api/products/${productId}/variants`, 'POST', { ...sku, sku: `T${unique}-01` })).status, 409);
  const variant = await admin.request(`/api/products/${productId}/variants`, 'POST', { ...sku, sale_price: '9990000.50', sale_starts_at: '2026-10-01T00:00', sale_ends_at: '2026-10-31 23:59:59' });
  assert.equal(variant.status, 201);
  assert.equal(variant.json.data.stock_quantity, 0);
  assert.equal(variant.json.data.sale_price, '9990000.50');
  const variantId = variant.json.data.id;
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'PUT', { sku: 'CHANGED' })).status, 422);
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'PUT', { sale_ends_at: '2026-09-01 00:00' })).status, 422);
  const updated = await admin.request(`/api/variants/${variantId}`, 'PUT', { is_active: false, low_stock_threshold: 2 });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.is_active, 0);
  const all = (await admin.request(`/api/products/${productId}/variants`)).json.data;
  assert.equal(all.length, 2);
  assert.equal((await admin.request(`/api/products/${productId}`)).json.data.variants.length, 1);

  assert.equal((await admin.request(`/api/categories/${category.id}/attributes`, 'POST', { name: 'Bad', attribute_key: 'Bad Key' })).status, 422);
  assert.equal((await admin.request(`/api/categories/${category.id}/attributes`, 'POST', { name: 'Dung tích', attribute_key: 'capacity_liters', data_type: 'number' })).status, 409);
  const attribute = await admin.request(`/api/categories/${category.id}/attributes`, 'POST', { name: 'Mức ồn', attribute_key: `noise_db_${unique}`, data_type: 'number', unit: 'dB', is_required: false });
  assert.equal(attribute.status, 201);
  assert.equal((await admin.request(`/api/products/${productId}/attributes`, 'PUT', { attributes: [{ attribute_id: Number(attribute.json.data.id), value: 38 }] })).status, 200);

  const upload = async (type, blob, name) => { const form = new FormData(); form.append('type', type); form.append('image', blob, name); return admin.request('/api/uploads/images', 'POST', form); };
  const first = await upload('products', new Blob([png], { type: 'image/png' }), 'x.php.png');
  assert.equal(first.status, 201);
  assert.match(first.json.data.image_url, /^\/uploads\/products\/[a-f0-9]{32}\.png$/);
  assert.equal((await upload('products', new Blob(['<?php echo 1;'], { type: 'image/png' }), 'shell.png')).status, 400);
  assert.equal((await warehouse.request('/api/uploads/images', 'POST', (() => { const f = new FormData(); f.append('type', 'products'); f.append('image', new Blob([png], { type: 'image/png' }), 'a.png'); return f; })())).status, 403);
  const second = await upload('products', new Blob([png], { type: 'image/png' }), 'b.png');
  const url = path => `http://127.0.0.1${path}`;
  assert.equal((await admin.request(`/api/products/${productId}/images`, 'POST', { image_url: 'https://evil.test/a.php' })).status, 422);
  let images = (await admin.request(`/api/products/${productId}/images`, 'POST', { image_url: url(first.json.data.image_url), sort_order: 2 })).json.data;
  assert.equal(images.length, 1);
  assert.equal(images[0].is_primary, 1);
  const added = await admin.request(`/api/products/${productId}/images`, 'POST', { image_url: url(second.json.data.image_url), sort_order: 1 });
  assert.equal(added.status, 201);
  images = added.json.data;
  assert.equal(images.filter(image => image.is_primary).length, 1);
  const secondId = images.find(image => image.image_url.endsWith(second.json.data.image_url)).id;
  assert.equal((await admin.request(`/api/product-images/${secondId}`, 'PUT', { is_primary: false })).status, 422);
  images = (await admin.request(`/api/product-images/${secondId}`, 'PUT', { is_primary: true, sort_order: 0 })).json.data;
  assert.equal(images[0].id, secondId);
  assert.equal(images.filter(image => image.is_primary).length, 1);
  images = (await admin.request(`/api/product-images/${secondId}`, 'DELETE')).json.data;
  assert.equal(images.length, 1);
  assert.equal(images[0].is_primary, 1);
  assert.equal((await admin.request(`/api/product-images/${secondId}`, 'DELETE')).status, 404);
  const detail = (await admin.request(`/api/products/${productId}`)).json.data;
  assert.equal(detail.images.length, 1);
  const listed = (await admin.request(`/api/products?keyword=T${unique}`)).json.data[0];
  assert.equal(listed.primary_image, url(first.json.data.image_url));

  assert.equal((await admin.request('/api/admin/banners')).status, 200);
  assert.equal((await warehouse.request('/api/admin/banners')).status, 403);
});

test('Danh mục tối đa 2 cấp có thứ tự; thương hiệu có mô tả; banner có thứ tự', async () => {
  const admin = new Client();
  await admin.staff('ADMIN');
  const root = await admin.request('/api/categories', 'POST', { name: `Gốc ${unique}`, slug: `goc-${unique}`, sort_order: 3 });
  assert.equal(root.status, 201);
  const child = await admin.request('/api/categories', 'POST', { name: `Con ${unique}`, slug: `con-${unique}`, parent_id: root.json.data.id });
  assert.equal(child.status, 201);
  assert.equal((await admin.request('/api/categories', 'POST', { name: `Cháu ${unique}`, slug: `chau-${unique}`, parent_id: child.json.data.id })).status, 422);
  const other = await admin.request('/api/categories', 'POST', { name: `Khác ${unique}`, slug: `khac-${unique}` });
  assert.equal((await admin.request(`/api/categories/${root.json.data.id}`, 'PUT', { name: `Gốc ${unique}`, slug: `goc-${unique}`, parent_id: other.json.data.id })).status, 422);
  assert.equal((await admin.request('/api/categories', 'POST', { name: 'X', slug: `x-${unique}`, sort_order: -1 })).status, 422);
  const categories = (await admin.request('/api/categories')).json.data;
  assert.equal(categories.find(item => item.id === root.json.data.id).sort_order, 3);
  assert.deepEqual(categories.map(item => item.sort_order), [...categories.map(item => item.sort_order)].sort((a, b) => a - b));

  const brand = await admin.request('/api/brands', 'POST', { name: `Hãng ${unique}`, description: 'Thương hiệu mô phỏng cho kiểm thử.' });
  assert.equal(brand.status, 201);
  assert.equal((await admin.request('/api/brands')).json.data.find(item => item.name === `Hãng ${unique}`).description, 'Thương hiệu mô phỏng cho kiểm thử.');
  assert.equal((await admin.request('/api/brands', 'POST', { name: `Dài ${unique}`, description: 'x'.repeat(1001) })).status, 422);

  const banner = { title: `Banner ${unique}`, image_url: 'https://example.test/banner.png', sort_order: 1 };
  assert.equal((await admin.request('/api/banners', 'POST', banner)).status, 201);
  assert.equal((await admin.request('/api/admin/banners')).json.data.find(item => item.title === banner.title).sort_order, 1);
});
