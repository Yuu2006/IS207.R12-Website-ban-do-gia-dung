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

// Tạo sản phẩm + SKU đầu tiên (tồn 0) bằng ADMIN, trả { productId, sku, variantId }.
async function createProduct(admin, tag, extra = {}) {
  const category = (await admin.request('/api/categories')).json.data.find(item => item.slug === 'tu-lanh');
  const brand = (await admin.request('/api/brands')).json.data[0];
  const sku = `W${unique}${tag}`;
  const created = await admin.request('/api/products', 'POST', { category_id: category.id, brand_id: brand.id, product_code: sku, name: `Sản phẩm tuần 2 ${sku}`, slug: `sp-tuan-2-${sku.toLowerCase()}`, sku, variant_name: 'Tiêu chuẩn', price: '1000000', ...extra });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  return { productId: created.json.data.id, sku, variantId: created.json.data.variants[0].id };
}
const move = (client, sku, type, quantity, ref, note = 'Kiểm thử') => client.request('/api/inventory/movements', 'POST', { sku, movement_type: type, quantity, reference_code: ref, note });

test('Catalog công khai ẩn sản phẩm ngừng bán; ADMIN vẫn thấy và lọc được', async () => {
  const admin = new Client(); await admin.staff('ADMIN');
  const anonymous = new Client(); await anonymous.init();
  const customer = new Client(); await customer.init();
  await customer.request('/auth/login', 'POST', { identifier: 'customer@example.test', password });
  const { productId, sku } = await createProduct(admin, 'V');
  for (const viewer of [anonymous, customer]) {
    assert.equal((await viewer.request(`/api/products?keyword=${sku}`)).json.data.length, 1);
    assert.equal((await viewer.request(`/api/products/${productId}`)).status, 200);
  }
  assert.equal((await admin.request(`/api/products/${productId}`, 'PUT', { is_active: 0 })).status, 200);
  for (const viewer of [anonymous, customer]) {
    assert.equal((await viewer.request(`/api/products?keyword=${sku}`)).json.data.length, 0);
    assert.equal((await viewer.request(`/api/products?keyword=${sku}&is_active=0`)).json.data.length, 0);
    assert.equal((await viewer.request(`/api/products/${productId}`)).status, 404);
  }
  assert.equal((await admin.request(`/api/products?keyword=${sku}&is_active=0`)).json.data.length, 1);
  assert.equal((await admin.request(`/api/products?keyword=${sku}&is_active=1`)).json.data.length, 0);
  assert.equal((await admin.request(`/api/products/${productId}`)).status, 200);
});

test('Xóa mềm SKU chỉ khi tồn bằng 0; giá tạo sản phẩm không qua float', async () => {
  const admin = new Client(); await admin.staff('ADMIN');
  const warehouse = new Client(); await warehouse.staff('WAREHOUSE');
  const category = (await admin.request('/api/categories')).json.data[0];
  const brand = (await admin.request('/api/brands')).json.data[0];
  const base = { category_id: category.id, brand_id: brand.id, variant_name: 'Giá', };
  for (const [i, price] of [1500.5, '12345678901234', '-1', 'abc', ''].entries()) {
    const code = `P${unique}${i}`;
    assert.equal((await admin.request('/api/products', 'POST', { ...base, product_code: code, name: code, slug: code.toLowerCase(), sku: code, price })).status, 422, `price=${price}`);
  }
  const { productId, sku, variantId } = await createProduct(admin, 'D', { price: '1500.50' });
  assert.equal((await admin.request(`/api/products/${productId}`)).json.data.variants[0].price, '1500.50');

  assert.equal((await warehouse.request(`/api/variants/${variantId}`, 'DELETE')).status, 403);
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'DELETE', undefined, { 'X-CSRF-Token': 'bad' })).status, 403);
  assert.equal((await move(warehouse, sku, 'import', 2, `W-${unique}-D1`)).status, 201);
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'DELETE')).status, 409, 'SKU cuối cùng không xóa được');
  const spare = await admin.request(`/api/products/${productId}/variants`, 'POST', { sku: `${sku}-B`, variant_name: 'Phụ', price: '1' });
  assert.equal(spare.status, 201);
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'DELETE')).status, 409, 'còn tồn');
  assert.equal((await admin.request(`/api/products/${productId}/variants`)).json.data.length, 2);
  assert.equal((await move(warehouse, sku, 'export', 2, `W-${unique}-D2`)).status, 201);
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'DELETE')).status, 200);
  assert.deepEqual((await admin.request(`/api/products/${productId}/variants`)).json.data.map(item => item.id), [spare.json.data.id]);
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'DELETE')).status, 404);
  assert.equal((await admin.request(`/api/products/${productId}/variants`, 'POST', { sku, variant_name: 'Lại', price: '1' })).status, 409);
  assert.equal((await warehouse.request(`/api/inventory/movements?sku=${sku}`)).json.data.pagination.totalItems, 0, 'lịch sử của SKU đã xóa được ẩn khỏi danh sách');
});

test('Hai lần xuất đồng thời không làm tồn âm', async () => {
  const admin = new Client(); await admin.staff('ADMIN');
  const warehouse = new Client(); await warehouse.staff('WAREHOUSE');
  const { sku } = await createProduct(admin, 'R');
  assert.equal((await move(warehouse, sku, 'import', 5, `W-${unique}-R0`)).status, 201);
  const results = await Promise.all([1, 2].map(n => move(warehouse, sku, 'export', 5, `W-${unique}-R${n}`)));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 400]);
  assert.equal((await warehouse.request(`/api/inventory?sku=${sku}`)).json.data[0].stock_quantity, 0);
  const rows = (await warehouse.request(`/api/inventory/movements?sku=${sku}`)).json.data.items;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.quantity_before, row.quantity_after]), [[5, 0], [0, 5]]);
});

test('Đầu vào điều chỉnh kho sai bị từ chối; cảnh báo sắp hết bỏ SKU ngừng bán', async () => {
  const admin = new Client(); await admin.staff('ADMIN');
  const warehouse = new Client(); await warehouse.staff('WAREHOUSE');
  const { sku, variantId } = await createProduct(admin, 'I');
  let n = 0;
  for (const quantity of [0, -1, 1.5, 'abc', 4294967296]) assert.equal((await move(warehouse, sku, 'import', quantity, `W-${unique}-I${n++}`)).status, 400, `quantity=${quantity}`);
  assert.equal((await move(warehouse, sku, 'import', 1, `W-${unique}-I${n++}`, 'x'.repeat(501))).status, 400);
  assert.equal((await move(warehouse, sku, 'adjust', 1, `W-${unique}-I${n++}`)).status, 400);
  assert.equal((await move(warehouse, 'KHONG-CO', 'import', 1, `W-${unique}-I${n++}`)).status, 404);
  assert.equal((await warehouse.request(`/api/inventory?sku=${sku}`)).json.data[0].stock_quantity, 0);
  const lowSkus = async () => (await warehouse.request('/api/inventory?low_stock=1')).json.data.map(item => item.sku);
  assert.ok((await lowSkus()).includes(sku), 'tồn 0, ngưỡng mặc định → cảnh báo');
  assert.equal((await warehouse.request(`/api/inventory?sku=${sku}`)).json.data[0].stock_status, 'out_of_stock');
  assert.equal((await admin.request(`/api/variants/${variantId}`, 'PUT', { is_active: false })).status, 200);
  assert.ok(!(await lowSkus()).includes(sku), 'SKU ngừng bán không cảnh báo');
  assert.equal((await warehouse.request(`/api/inventory?sku=${sku}`)).json.data.length, 1, 'danh sách thường vẫn thấy SKU ngừng bán');
});
