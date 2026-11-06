// Sinh seeds 004..009 + ảnh placeholder từ scripts/seed-data/dataset.mjs. Tất định (PRNG cố định): chạy lại cho cùng kết quả.
//   node scripts/generate-seed-data.mjs
// Ghi: server/db/seeds/004..009_*.sql và server/uploads/{products,banners,brands}/<md5>.png (thư mục uploads bị .gitignore).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIRCONS, BANNERS, BRANDS, CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_PREFIX, CUSTOMERS, FRIDGES, REVIEW_TEXT, VOUCHERS, WASHERS } from './seed-data/dataset.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS = join(root, 'server/db/seeds');
const UPLOADS = join(root, 'server/uploads');
const API_ORIGIN = 'http://localhost:8080'; // banner/brand yêu cầu URL tuyệt đối (xem nợ kỹ thuật #3 trong CLAUDE.md)
const PASSWORD_HASH = '$2y$10$KkT8yurULCYRqY29j/rVcugGKg57g8LIftRaQId.pugTgOyQ779yq'; // Demo@1234567890! (như seed 001)
const SALE_FRESH_MINUTES = 25 * 1440; // 003 đặt khuyến mãi 30 ngày kể từ lúc nạp; đơn cũ hơn 25 ngày dùng giá gốc

// ---------- tiện ích ----------
let state = 20261106;
const rnd = () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`);
const ago = (m) => `UTC_TIMESTAMP() - INTERVAL ${Math.max(0, Math.round(m))} MINUTE`;
const dayRel = (d) => (d < 0 ? `UTC_TIMESTAMP() - INTERVAL ${-d} DAY` : `UTC_TIMESTAMP() + INTERVAL ${d} DAY`);
const uid = (email) => `(SELECT id FROM users WHERE email = ${q(email)})`;
const assert = (c, m) => { if (!c) throw new Error(`Assert failed: ${m}`); };
const HEAD = (note) => `-- ${note}\n-- FILE SINH TỰ ĐỘNG bởi scripts/generate-seed-data.mjs — đừng sửa tay. Dữ liệu MÔ PHỎNG cho demo.\nUSE household_ecommerce;\n\n`;
const emit = (name, text) => writeFileSync(join(SEEDS, name), text, 'utf8');

// ---------- ảnh PNG placeholder (không phụ thuộc thư viện) ----------
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(w, h, px) {
  const raw = Buffer.alloc((w * 3 + 1) * h); let o = 0;
  for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y); raw[o++] = r; raw[o++] = g; raw[o++] = b; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hash32 = (s) => createHash('md5').update(s).digest('hex');
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function hsl(h, s, l) { const f = (n) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)); }
function saveImage(folder, key, buf) { const name = `${hash32(key)}.png`; mkdirSync(join(UPLOADS, folder), { recursive: true }); writeFileSync(join(UPLOADS, folder, name), buf); return `/uploads/${folder}/${name}`; }
const BODY = [236, 240, 244], LINE = [150, 160, 172], DARK = [70, 84, 102];
function productImage(cat, hue, variant) {
  const bg = hsl((hue + variant * 24) % 360, 0.45, 0.86 - variant * 0.04), edge = hsl((hue + variant * 24) % 360, 0.5, 0.62);
  return png(400, 400, (x, y) => {
    const base = mix(bg, edge, y / 400 * 0.55);
    if (cat === 'tu-lanh' && x > 120 && x < 280 && y > 40 && y < 360) return y > 150 && y < 154 ? LINE : x > 250 && x < 258 && y > 80 && y < 130 ? DARK : BODY;
    if (cat === 'may-giat' && x > 90 && x < 310 && y > 50 && y < 350) return (x - 200) ** 2 + (y - 220) ** 2 < 4900 ? ((x - 200) ** 2 + (y - 220) ** 2 < 2500 ? hsl(hue, 0.4, 0.7) : DARK) : y < 100 ? LINE : BODY;
    if (cat === 'may-lanh' && x > 50 && x < 350 && y > 110 && y < 210) return y > 190 ? (x % 24 < 12 ? LINE : DARK) : BODY;
    return base;
  });
}
const bannerImage = (hex) => { const c = hex2rgb(hex); return png(1200, 400, (x, y) => (x > 700 && x < 1100 && y > 90 && y < 310 && (x + y) % 80 < 40 ? mix(c, [255, 255, 255], 0.35) : mix(c, [255, 255, 255], 0.12 + (x / 1200) * 0.3 - (y / 400) * 0.06))); };
const logoImage = (hue) => { const c = hsl(hue, 0.55, 0.45); return png(200, 200, (x, y) => ((x - 100) ** 2 + (y - 100) ** 2 < 7000 ? c : [245, 247, 250])); };
const hueOf = (s) => parseInt(hash32(s).slice(0, 4), 16) % 360;

// ---------- danh mục sản phẩm (30 mới + 30 của seed 003) ----------
const products = []; // {code, cat, brand, name, year, attrs[[key,value,boolean?]], capacity, watts, variants[{sku,vname,price,sale,stock}], fresh}
const catOf = (code) => CATEGORY_PREFIX[code.slice(0, 2)];
const mkVariants = (code, vs) => vs.map(([s, vname, price, stock, sale]) => ({ sku: `${code}-${s}`, vname, price, sale: sale ?? null, stock, code }));
for (const [code, brand, name, year, l, w, d, h, kwh, inv, vs] of FRIDGES) products.push({ code, cat: 'tu-lanh', brand, name, year, capacity: l, watts: null, attrs: [['capacity_liters', l], ['width_mm', w], ['depth_mm', d], ['height_mm', h], ['energy_kwh_year', kwh], ['inverter', inv, true]], variants: mkVariants(code, vs), fresh: true });
for (const [code, brand, name, year, kg, w, d, h, watts, water, inv, vs] of WASHERS) products.push({ code, cat: 'may-giat', brand, name, year, capacity: null, watts, attrs: [['capacity_kg', kg], ['width_mm', w], ['depth_mm', d], ['height_mm', h], ['power_watts', watts], ['water_liters_cycle', water], ['inverter', inv, true]], variants: mkVariants(code, vs), fresh: true });
for (const [code, brand, name, year, btu, area, watts, iw, inv, vs] of AIRCONS) products.push({ code, cat: 'may-lanh', brand, name, year, capacity: null, watts, attrs: [['cooling_btu', btu], ['room_area_max_m2', area], ['power_watts', watts], ['indoor_width_mm', iw], ['inverter', inv, true]], variants: mkVariants(code, vs), fresh: true });
{ // đọc lại seed 003 để đơn hàng/ảnh/đánh giá phủ cả 30 sản phẩm cũ (003 không bị sửa)
  const s3 = readFileSync(join(SEEDS, '003_catalog_appliances.sql'), 'utf8');
  const old = new Map();
  for (const m of s3.matchAll(/SELECT c\.id, b\.id, '([A-Z]{2}-\d{3})', '([^']+)'/g)) old.set(m[1], { code: m[1], cat: catOf(m[1]), brand: '(003)', name: m[2], variants: [], fresh: false });
  const imports = new Map([...s3.matchAll(/'import', (\d+), v\.stock_quantity.*?'SEED-([A-Z0-9-]+)'/g)].map((m) => [m[2], Number(m[1])]));
  for (const m of s3.matchAll(/SELECT p\.id, '([A-Z0-9-]+)', '([^']+)', (\d+), (NULL|\d+), (?:NULL|UTC_TIMESTAMP\(\)), (?:NULL|UTC_TIMESTAMP\(\) \+ INTERVAL 30 DAY), 0, 5 FROM products p WHERE p\.product_code = '([A-Z]{2}-\d{3})'/g))
    old.get(m[5]).variants.push({ sku: m[1], vname: m[2], price: Number(m[3]), sale: m[4] === 'NULL' ? null : Number(m[4]), stock: imports.get(m[1]) ?? 0, code: m[5] });
  assert(old.size === 30 && [...old.values()].reduce((n, p) => n + p.variants.length, 0) === 39 && imports.size === 36, 'parse seed 003 (30 SP / 39 SKU / 36 phiếu nhập)');
  products.push(...old.values());
}
const allVariants = products.flatMap((p) => p.variants.map((v) => ({ ...v, product: p })));
assert(new Set(allVariants.map((v) => v.sku)).size === allVariants.length, 'SKU trùng');

// ---------- 004: thương hiệu + sản phẩm mới ----------
{
  let s = HEAD('Seed 004 — 30 sản phẩm thương hiệu thật (model/giá/thông số mô phỏng): 10 tủ lạnh, 10 máy giặt, 10 máy lạnh. Chạy sau 003 (cần admin@example.test và 011).');
  s += `INSERT INTO categories (name, slug) VALUES ${Object.entries(CATEGORY_LABEL).map(([slug, n]) => `(${q(n)}, ${q(slug)})`).join(', ')} ON DUPLICATE KEY UPDATE name = VALUES(name), is_deleted = 0;\n`;
  for (const [name, desc] of BRANDS) s += `INSERT INTO brands (name, description) VALUES (${q(name)}, ${q(desc)}) ON DUPLICATE KEY UPDATE description = VALUES(description), is_deleted = 0;\n`;
  for (const p of products.filter((x) => x.fresh)) {
    const desc = `${p.name} – dữ liệu mô phỏng cho demo; tên model, giá và thông số không phải của sản phẩm thật.`;
    s += `\nINSERT INTO products (category_id, brand_id, product_code, name, slug, description, specifications, power_watts, capacity_liters, warranty_months) SELECT c.id, b.id, ${q(p.code)}, ${q(p.name)}, ${q(`${p.cat}-${p.code.toLowerCase()}`)}, ${q(desc)}, JSON_OBJECT('Năm sản xuất', ${p.year}), ${p.watts ?? 'NULL'}, ${p.capacity ?? 'NULL'}, 24 FROM categories c JOIN brands b ON b.name = ${q(p.brand)} WHERE c.slug = ${q(p.cat)} ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), specifications = VALUES(specifications), power_watts = VALUES(power_watts), capacity_liters = VALUES(capacity_liters), is_deleted = 0;\n`;
    for (const [key, val, isBool] of p.attrs) s += `INSERT INTO product_attribute_values (product_id, attribute_id, ${isBool ? 'value_boolean' : 'value_number'}) SELECT p.id, a.id, ${val} FROM products p JOIN product_attributes a ON a.category_id = p.category_id AND a.attribute_key = ${q(key)} WHERE p.product_code = ${q(p.code)} ON DUPLICATE KEY UPDATE ${isBool ? 'value_boolean = VALUES(value_boolean)' : 'value_number = VALUES(value_number)'};\n`;
    for (const v of p.variants) {
      s += `INSERT INTO product_variants (product_id, sku, variant_name, price, sale_price, sale_starts_at, sale_ends_at, stock_quantity, low_stock_threshold) SELECT p.id, ${q(v.sku)}, ${q(v.vname)}, ${v.price}, ${v.sale ?? 'NULL'}, ${v.sale ? 'UTC_TIMESTAMP()' : 'NULL'}, ${v.sale ? 'UTC_TIMESTAMP() + INTERVAL 30 DAY' : 'NULL'}, 0, 5 FROM products p WHERE p.product_code = ${q(p.code)} ON DUPLICATE KEY UPDATE variant_name = VALUES(variant_name);\n`;
      if (v.stock > 0) s += `INSERT IGNORE INTO inventory_movements (variant_id, movement_type, quantity_change, quantity_before, quantity_after, reference_code, note, performed_by) SELECT v.id, 'import', ${v.stock}, v.stock_quantity, v.stock_quantity + ${v.stock}, ${q(`SEED-${v.sku}`)}, 'Nhập kho dữ liệu demo', u.id FROM product_variants v JOIN users u ON u.email = 'admin@example.test' WHERE v.sku = ${q(v.sku)} AND v.stock_quantity = 0;\n`
        + `UPDATE product_variants v JOIN inventory_movements m ON m.variant_id = v.id AND m.reference_code = ${q(`SEED-${v.sku}`)} SET v.stock_quantity = m.quantity_after WHERE v.sku = ${q(v.sku)} AND v.stock_quantity = m.quantity_before AND NOT EXISTS (SELECT 1 FROM inventory_movements o WHERE o.variant_id = v.id AND o.id <> m.id);\n`;
    }
  }
  emit('004_catalog_real_brands.sql', s);
}

// ---------- 005: ảnh sản phẩm, banner, logo hãng, thứ tự danh mục ----------
{
  let s = HEAD('Seed 005 — ảnh placeholder (PNG sinh bởi generator vào server/uploads), banner, logo thương hiệu, thứ tự danh mục. Cần migration 011.');
  for (const [slug, order] of Object.entries(CATEGORY_ORDER)) s += `UPDATE categories SET sort_order = ${order} WHERE slug = ${q(slug)};\n`;
  for (const [name] of BRANDS) s += `UPDATE brands SET logo_url = ${q(API_ORIGIN + saveImage('brands', `brand-${name}`, logoImage(hueOf(name))))} WHERE name = ${q(name)};\n`;
  for (const p of products) {
    const hue = hueOf(p.code);
    for (let i = 0; i < 3; i++) {
      const url = saveImage('products', `${p.code}-${i + 1}`, productImage(p.cat, hue, i));
      s += `INSERT INTO product_images (product_id, image_url, is_primary, sort_order) SELECT p.id, ${q(url)}, ${i === 0 ? 1 : 0}, ${i} FROM products p WHERE p.product_code = ${q(p.code)} AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id AND x.image_url = ${q(url)});\n`;
    }
  }
  for (const [title, color, from, to, order, link] of BANNERS) {
    const url = API_ORIGIN + saveImage('banners', `banner-${title}`, bannerImage(color));
    s += `INSERT INTO banners (title, image_url, target_url, sort_order, starts_at, ends_at, is_active) SELECT ${q(title)}, ${q(url)}, ${q(link)}, ${order}, ${dayRel(from)}, ${dayRel(to)}, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM banners WHERE title = ${q(title)});\n`;
  }
  emit('005_catalog_media.sql', s);
}

// ---------- 006: khách hàng + địa chỉ ----------
{
  let s = HEAD('Seed 006 — 8 khách demo (mật khẩu chung Demo@1234567890!) và địa chỉ. Cần 001 và migration 010 (phone UNIQUE).');
  s += `INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES\n${CUSTOMERS.slice(1).map(([e, n, ph]) => `    (${q(n)}, ${q(e)}, ${q(ph)}, ${q(PASSWORD_HASH)}, 'CUSTOMER', 'ACTIVE')`).join(',\n')}\nON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), status = VALUES(status), is_deleted = 0;\n`;
  for (const [email, , , addrs] of CUSTOMERS) addrs.forEach(([rn, ph, line, ward, dist, prov], i) => {
    s += `INSERT INTO addresses (user_id, recipient_name, phone, address_line, ward, district, province, is_default) SELECT u.id, ${q(rn)}, ${q(ph)}, ${q(line)}, ${q(ward)}, ${q(dist)}, ${q(prov)}, ${i === 0 ? 1 : 0} FROM users u WHERE u.email = ${q(email)} AND NOT EXISTS (SELECT 1 FROM addresses a WHERE a.user_id = u.id AND a.address_line = ${q(line)});\n`;
  });
  emit('006_customers_addresses.sql', s);
}

// ---------- đơn hàng (mô phỏng trong bộ nhớ, rồi sinh 007/008/009) ----------
const PLAN = [['PENDING', 5], ['CONFIRMED', 4], ['PREPARING', 4], ['SHIPPING', 4], ['DELIVERED', 4], ['COMPLETED', 20], ['CANCELLED', 7]];
const RANGE = { PENDING: [30, 2800], CONFIRMED: [1500, 4300], PREPARING: [3000, 6000], SHIPPING: [5000, 9000], DELIVERED: [9000, 18000], COMPLETED: [24000, 125000], CANCELLED: [1500, 100000] };
const CARRIERS = ['Nhanh Express (demo)', 'Việt Ship (demo)', 'An Tâm Logistics (demo)'];
const SALES = 'sales@example.test', WH = 'warehouse@example.test';
let orders = PLAN.flatMap(([status, n]) => Array.from({ length: n }, (_, i) => ({ status, idx: i, placed: ri(...RANGE[status]) })));
orders.sort((a, b) => b.placed - a.placed); // cũ nhất trước
orders.forEach((o, i) => { o.code = `HC2026110${String(i + 1).padStart(3, '0')}`; });

const vouchers = VOUCHERS.map(([code, type, value, min, max, from, to, limit, active]) => ({ code, type, value, min, max, from, to, limit, active, used: 0 }));
const voucherOk = (v, o) => v.active && v.from <= -o.placed / 1440 && -o.placed / 1440 <= v.to && o.subtotal >= v.min && (v.limit === 'AUTO' || v.used < v.limit);
const discountOf = (v, sub) => (v.type === 'PERCENT' ? Math.min(Math.floor(sub * v.value / 100), v.max ?? Infinity) : v.value);
const effPrice = (v, placed) => (v.sale && placed < SALE_FRESH_MINUTES ? v.sale : v.price);

// stock "bảo thủ" khi chọn dòng hàng: giữ trừ cho tới hết, không cộng lại khi hủy
const free = new Map(allVariants.map((v) => [v.sku, v.stock]));
const byStatusSeen = {};
for (const o of orders) {
  const seen = (byStatusSeen[o.status] = (byStatusSeen[o.status] ?? -1) + 1); o.idx = seen;
  o.customer = chance(0.28) ? CUSTOMERS[0] : pick(CUSTOMERS);
  o.lines = [];
  const nLines = chance(0.6) ? 1 : chance(0.75) ? 2 : 3;
  for (let tries = 0; o.lines.length < nLines && tries < 60; tries++) {
    const v = pick(allVariants), qty = chance(0.12) ? 2 : 1;
    if (o.lines.some((l) => l.v.sku === v.sku) || (free.get(v.sku) ?? 0) < qty) continue;
    free.set(v.sku, free.get(v.sku) - qty);
    o.lines.push({ v, qty, price: effPrice(v, o.placed) });
  }
  assert(o.lines.length > 0, `không chọn được hàng cho ${o.code}`);
  o.subtotal = o.lines.reduce((n, l) => n + l.price * l.qty, 0);
  o.shipping = 0; // giả định như mock: miễn phí vận chuyển với đơn >= 500.000đ (phí thật chờ nhóm chốt)
}
// voucher: ép dùng cho vài đơn để có voucher hết lượt/hết hạn, còn lại ngẫu nhiên
const force = (code, n, pred) => { const v = vouchers.find((x) => x.code === code); for (const o of orders) { if (n <= 0) break; if (!o.voucher && o.status !== 'CANCELLED' && pred(o) && voucherOk(v, o)) { o.voucher = v; v.used++; n--; } } };
force('HETLUOT', 3, () => true);
force('HETHAN', 2, (o) => o.placed > 30 * 1440);
for (const o of orders) if (!o.voucher && chance(0.35)) { const v = pick(vouchers.filter((x) => voucherOk(x, o) && x.code !== 'HETLUOT' && x.code !== 'HETHAN')); if (v) { o.voucher = v; if (o.status !== 'CANCELLED') v.used++; } }
for (const v of vouchers) if (v.limit === 'AUTO') { assert(v.used > 0, 'voucher AUTO chưa có lượt dùng'); v.limit = v.used; }
for (const o of orders) { o.discount = o.voucher ? discountOf(o.voucher, o.subtotal) : 0; o.total = o.subtotal - o.discount + o.shipping; assert(o.total > 0, `tổng đơn ${o.code}`); }

// thanh toán + dòng thời gian trạng thái
let completedSeen = 0;
for (const o of orders) {
  const st = o.status, i = o.idx;
  o.method = chance(0.6) ? 'COD' : 'VNPAY'; o.pay = 'UNPAID'; o.refundRequired = 0;
  if (st === 'PENDING') { if (i === 0) { o.method = 'VNPAY'; o.pay = 'PENDING'; } else if (i === 1) { o.method = 'VNPAY'; o.pay = 'FAILED'; } else o.method = 'COD'; }
  else if (st === 'CANCELLED') { if (i < 2) { o.method = 'VNPAY'; o.pay = 'PAID'; o.refundRequired = 1; } else if (i === 2) { o.method = 'VNPAY'; o.pay = 'FAILED'; } else o.method = 'COD'; }
  else if (st === 'DELIVERED' || st === 'COMPLETED') o.pay = 'PAID';
  else if (o.method === 'VNPAY') o.pay = 'PAID';
  if (st === 'COMPLETED') { if (completedSeen === 2) { o.method = 'VNPAY'; o.pay = 'REFUNDED'; o.ret = 'APPROVED'; } else if (completedSeen === 5) o.ret = 'REQUESTED'; completedSeen++; }
  if (st === 'DELIVERED' && i === 0) o.ret = 'REQUESTED';
  const P = o.placed, h = [['PENDING', P, 'CUSTOMER', o.customer[0], 'Khách đặt hàng']];
  let t = P;
  if (['CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st)) { t -= ri(30, 600); h.push(['CONFIRMED', t, 'SALES', SALES, 'Đã xác nhận đơn']); o.confirmedAt = t; }
  if (['PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st)) { t -= ri(60, 300); h.push(['PREPARING', t, 'SALES', SALES, 'Đang chuẩn bị hàng']); }
  if (['SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st)) { t -= ri(120, 600); h.push(['SHIPPING', t, 'SALES', SALES, 'Bàn giao vận chuyển']); o.packedAt = t; o.shippedAt = t; }
  if (['DELIVERED', 'COMPLETED'].includes(st)) { t -= ri(1440, 4320); h.push(['DELIVERED', t, 'SALES', SALES, 'Giao thành công']); o.deliveredAt = t; }
  if (st === 'COMPLETED') { t -= ri(4320, 7200); h.push(['COMPLETED', t, 'CUSTOMER', o.customer[0], 'Khách xác nhận hoàn tất']); o.completedAt = t; }
  if (st === 'CANCELLED') { t = Math.max(1, P - ri(20, 1500)); const byCustomer = chance(0.6); h.push(['CANCELLED', t, byCustomer ? 'CUSTOMER' : 'SALES', byCustomer ? o.customer[0] : SALES, pick(['Khách đổi ý', 'Đặt nhầm sản phẩm', 'Không liên lạc được để giao hàng', 'Thanh toán VNPay không hoàn tất'])]); o.cancelAt = t; }
  o.history = h; o.version = h.length;
  o.paidAt = o.pay === 'PAID' || o.pay === 'REFUNDED' ? (o.method === 'COD' ? o.deliveredAt : P - ri(3, 10)) : null;
  o.inv = st === 'CANCELLED' ? 'RELEASED' : ['SHIPPING', 'DELIVERED', 'COMPLETED'].includes(st) ? 'CONSUMED' : 'RESERVED';
  o.address = pick(o.customer[3]);
}

// sự kiện kho theo thời gian để tính trước/sau chính xác
const events = [];
for (const o of orders) for (const l of o.lines) {
  events.push({ at: o.placed, o, l, sku: l.v.sku, delta: -l.qty, type: 'export', ref: `SEED-ORD-${o.code}-${l.v.sku}`, note: `Giữ hàng cho đơn ${o.code}`, by: o.customer[0] });
  if (o.status === 'CANCELLED') events.push({ at: o.cancelAt, o, l, sku: l.v.sku, delta: l.qty, type: 'release', ref: `SEED-REL-${o.code}-${l.v.sku}`, note: `Hoàn kho do hủy đơn ${o.code}`, by: o.history.at(-1)[3] === o.customer[0] ? o.customer[0] : SALES });
}
events.sort((a, b) => b.at - a.at);
const level = new Map(allVariants.map((v) => [v.sku, v.stock]));
for (const e of events) { e.before = level.get(e.sku); e.after = e.before + e.delta; assert(e.after >= 0, `tồn âm ${e.sku}`); level.set(e.sku, e.after); }

// ---------- 007: voucher ----------
emit('007_vouchers.sql', HEAD('Seed 007 — 8 voucher (đang chạy, hết lượt, hết hạn, chưa bắt đầu, tắt). discount_type: PERCENT | FIXED (giả định, chờ nhóm chốt). used_count chỉ gán khi tạo, khớp các đơn ở 008.')
  + vouchers.map((v) => `INSERT INTO vouchers (code, discount_type, discount_value, min_order_amount, max_discount, starts_at, ends_at, usage_limit, used_count, is_active) VALUES (${q(v.code)}, ${q(v.type)}, ${v.value}, ${v.min}, ${v.max ?? 'NULL'}, ${dayRel(v.from)}, ${dayRel(v.to)}, ${v.limit}, ${v.used}, ${v.active}) ON DUPLICATE KEY UPDATE discount_type = VALUES(discount_type), discount_value = VALUES(discount_value), min_order_amount = VALUES(min_order_amount), max_discount = VALUES(max_discount), usage_limit = VALUES(usage_limit), is_active = VALUES(is_active), is_deleted = 0;`).join('\n') + '\n');

// ---------- 008: đơn hàng, thanh toán, vận chuyển, kho, giỏ ----------
{
  let s = HEAD('Seed 008 — 48 đơn trải ~90 ngày, đủ trạng thái, thanh toán COD/VNPAY, vận chuyển, trả hàng, biến động kho, giỏ hàng. Cần 001–007 và migration 008_order_runtime. Thời gian tính từ lúc nạp (UTC_TIMESTAMP).');
  for (const o of orders) {
    const a = o.address, ship = `${a[2]}, ${a[3]}, ${a[4]}, ${a[5]}`, pk = o.packedAt != null;
    s += `\n-- ${o.code} · ${o.status} · ${o.method}/${o.pay}\n`;
    s += `INSERT IGNORE INTO orders (order_code, customer_id, voucher_id, recipient_name, recipient_phone, shipping_address, delivery_method, subtotal, discount_amount, shipping_fee, total_amount, payment_method, payment_status, order_status, packing_status, packed_by, packed_at, confirmed_by, confirmed_at, customer_note, placed_at, version, inventory_state, refund_required) SELECT ${q(o.code)}, c.id, ${o.voucher ? `(SELECT id FROM vouchers WHERE code = ${q(o.voucher.code)})` : 'NULL'}, ${q(a[0])}, ${q(a[1])}, ${q(ship)}, 'STANDARD', ${o.subtotal}, ${o.discount}, ${o.shipping}, ${o.total}, ${q(o.method)}, ${q(o.pay)}, ${q(o.status)}, ${pk ? "'PACKED'" : "'WAITING'"}, ${pk ? uid(WH) : 'NULL'}, ${pk ? ago(o.packedAt) : 'NULL'}, ${o.confirmedAt != null ? uid(SALES) : 'NULL'}, ${o.confirmedAt != null ? ago(o.confirmedAt) : 'NULL'}, ${chance(0.3) ? q('Gọi trước khi giao 30 phút.') : 'NULL'}, ${ago(o.placed)}, ${o.version}, ${q(o.inv)}, ${o.refundRequired} FROM users c WHERE c.email = ${q(o.customer[0])};\n`;
    for (const l of o.lines) s += `INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months, image_url) SELECT o.id, v.id, p.name, v.sku, v.variant_name, ${l.price}, ${l.qty}, ${l.price * l.qty}, p.warranty_months, (SELECT i.image_url FROM product_images i WHERE i.product_id = p.id AND i.is_deleted = 0 ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) FROM orders o JOIN product_variants v ON v.sku = ${q(l.v.sku)} JOIN products p ON p.id = v.product_id WHERE o.order_code = ${q(o.code)} AND NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id AND x.sku = v.sku);\n`;
    o.history.forEach(([status, at, role, who, note], k) => {
      s += `INSERT INTO order_status_history (order_id, changed_by, status, note, changed_at, from_status, actor_role) SELECT o.id, ${uid(who)}, ${q(status)}, ${q(note)}, ${ago(at)}, ${k ? q(o.history[k - 1][0]) : 'NULL'}, ${q(role)} FROM orders o WHERE o.order_code = ${q(o.code)} AND NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.status = ${q(status)});\n`;
    });
    if (!(o.status === 'CANCELLED' && o.method === 'COD')) {
      const pst = o.pay === 'UNPAID' ? 'PENDING' : o.pay;
      s += `INSERT IGNORE INTO payments (order_id, payment_code, provider_transaction_code, payment_method, amount, status, paid_at) SELECT o.id, ${q(`PAY-${o.code}`)}, ${o.method === 'VNPAY' && o.paidAt != null ? q(`VNP${hash32(o.code).slice(0, 12).toUpperCase()}`) : 'NULL'}, ${q(o.method)}, ${o.total}, ${q(pst)}, ${o.paidAt != null ? ago(o.paidAt) : 'NULL'} FROM orders o WHERE o.order_code = ${q(o.code)};\n`;
    }
    if (o.shippedAt != null) s += `INSERT IGNORE INTO shipments (order_id, carrier, tracking_code, status, shipped_at, delivered_at) SELECT o.id, ${q(pick(CARRIERS))}, ${q(`TRK${hash32(`t${o.code}`).slice(0, 10).toUpperCase()}`)}, ${o.deliveredAt != null ? "'DELIVERED'" : "'IN_TRANSIT'"}, ${ago(o.shippedAt)}, ${o.deliveredAt != null ? ago(o.deliveredAt) : 'NULL'} FROM orders o WHERE o.order_code = ${q(o.code)};\n`;
    if (o.ret) s += `INSERT IGNORE INTO order_return_requests (order_id, customer_id, status, reason, created_at) SELECT o.id, o.customer_id, ${q(o.ret)}, ${q(pick(['Sản phẩm có tiếng ồn bất thường khi chạy.', 'Giao sai màu so với đơn đặt.', 'Không còn nhu cầu sử dụng.']))}, ${ago((o.deliveredAt ?? 1000) - ri(300, 1200))} FROM orders o WHERE o.order_code = ${q(o.code)};\n`;
  }
  s += '\n-- Biến động kho theo đơn (tính theo thứ tự thời gian; hủy đơn hoàn kho đúng một lần nhờ reference_code UNIQUE)\n';
  for (const e of events) s += `INSERT IGNORE INTO inventory_movements (variant_id, order_item_id, movement_type, quantity_change, quantity_before, quantity_after, reference_code, note, performed_by, created_at) SELECT v.id, oi.id, ${q(e.type)}, ${e.delta}, ${e.before}, ${e.after}, ${q(e.ref)}, ${q(e.note)}, ${uid(e.by)}, ${ago(e.at)} FROM product_variants v JOIN orders o ON o.order_code = ${q(e.o.code)} JOIN order_items oi ON oi.order_id = o.id AND oi.sku = v.sku WHERE v.sku = ${q(e.sku)};\n`;
  s += `UPDATE inventory_movements SET created_at = UTC_TIMESTAMP() - INTERVAL 130 DAY WHERE reference_code LIKE 'SEED-%' AND reference_code NOT LIKE 'SEED-ORD-%' AND reference_code NOT LIKE 'SEED-REL-%' AND created_at > UTC_TIMESTAMP() - INTERVAL 130 DAY;\n`; // phiếu nhập seed phải có trước đơn cũ nhất (~84 ngày) để chuỗi tồn đúng thời gian
  const touched = [...new Set(events.map((e) => e.sku))];
  s += `UPDATE product_variants v SET v.stock_quantity = (SELECT COALESCE(SUM(m.quantity_change), 0) FROM inventory_movements m WHERE m.variant_id = v.id) WHERE v.sku IN (${touched.map(q).join(', ')});\n`;
  s += '\n-- Giỏ hàng của 3 khách (không phải đơn)\n';
  for (const email of [CUSTOMERS[0][0], CUSTOMERS[1][0], CUSTOMERS[4][0]]) {
    s += `INSERT IGNORE INTO carts (user_id) SELECT id FROM users WHERE email = ${q(email)};\n`;
    for (const v of [pick(allVariants.filter((x) => x.stock >= 10)), pick(allVariants.filter((x) => x.stock >= 10))].filter((x, i, a) => a.indexOf(x) === i))
      s += `INSERT IGNORE INTO cart_items (cart_id, variant_id, quantity) SELECT c.id, v.id, ${ri(1, 2)} FROM carts c JOIN users u ON u.id = c.user_id AND u.email = ${q(email)} JOIN product_variants v ON v.sku = ${q(v.sku)};\n`;
  }
  emit('008_orders_payments.sql', s);
}

// ---------- 009: đánh giá + audit log ----------
{
  let s = HEAD('Seed 009 — đánh giá (chỉ cho dòng hàng của đơn COMPLETED, mỗi dòng tối đa một lần) và audit log. Cần 008.');
  let nReview = 0;
  for (const o of orders.filter((x) => x.status === 'COMPLETED')) for (const l of o.lines) {
    if (!chance(0.7)) continue;
    const r = rnd(), rating = r < 0.5 ? 5 : r < 0.8 ? 4 : r < 0.9 ? 3 : r < 0.95 ? 2 : 1;
    const visible = rating <= 2 && chance(0.5) ? 0 : 1, at = Math.max(60, o.completedAt - ri(1440, 10000));
    s += `INSERT IGNORE INTO product_reviews (order_item_id, customer_id, rating, content, is_visible, created_at) SELECT oi.id, o.customer_id, ${rating}, ${q(pick(REVIEW_TEXT[rating]))}, ${visible}, ${ago(at)} FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.order_code = ${q(o.code)} AND oi.sku = ${q(l.v.sku)};\n`;
    nReview++;
  }
  const completed = orders.filter((x) => x.status === 'COMPLETED'), cancelled = orders.filter((x) => x.status === 'CANCELLED');
  const audit = [
    ['admin@example.test', 'PRODUCT_CREATE', 'product', `(SELECT id FROM products WHERE product_code = 'TL-011')`, { code: 'TL-011' }, 90000],
    ['admin@example.test', 'PRODUCT_PRICE_UPDATE', 'product_variant', `(SELECT id FROM product_variants WHERE sku = 'TL-013-01')`, { sku: 'TL-013-01', from: 12990000, to: 12490000 }, 60000],
    ['admin@example.test', 'PRODUCT_PRICE_UPDATE', 'product_variant', `(SELECT id FROM product_variants WHERE sku = 'ML-012-01')`, { sku: 'ML-012-01', from: 13490000, to: 12990000 }, 40000],
    ['admin@example.test', 'BANNER_CREATE', 'banner', `(SELECT id FROM banners WHERE title = ${q(BANNERS[0][0])} LIMIT 1)`, { title: BANNERS[0][0] }, 14400],
    ['admin@example.test', 'VOUCHER_CREATE', 'voucher', `(SELECT id FROM vouchers WHERE code = 'KHAITRUONG10')`, { code: 'KHAITRUONG10' }, 120000],
    ['admin@example.test', 'VOUCHER_DISABLE', 'voucher', `(SELECT id FROM vouchers WHERE code = 'TAMTAT')`, { code: 'TAMTAT', reason: 'Tạm dừng chương trình' }, 20000],
    ['admin@example.test', 'USER_STATUS_CHANGE', 'user', uid('hung.le@example.test'), { email: 'hung.le@example.test', from: 'ACTIVE', to: 'ACTIVE', note: 'Kiểm tra định kỳ' }, 30000],
    ['warehouse@example.test', 'INVENTORY_ADJUST', 'product_variant', `(SELECT id FROM product_variants WHERE sku = 'TL-012-B')`, { sku: 'TL-012-B', reason: 'Kiểm kê định kỳ', before: 4, after: 3 }, 50000],
    ['warehouse@example.test', 'INVENTORY_ADJUST', 'product_variant', `(SELECT id FROM product_variants WHERE sku = 'ML-015-01')`, { sku: 'ML-015-01', reason: 'Hàng lỗi bao bì', before: 4, after: 3 }, 25000],
    ...completed.slice(0, 4).map((o, i) => ['sales@example.test', 'ORDER_STATUS_CHANGE', 'order', `(SELECT id FROM orders WHERE order_code = ${q(o.code)})`, { orderCode: o.code, from: 'DELIVERED', to: 'COMPLETED' }, o.completedAt + i]),
    ...cancelled.slice(0, 3).map((o) => ['sales@example.test', 'ORDER_CANCEL', 'order', `(SELECT id FROM orders WHERE order_code = ${q(o.code)})`, { orderCode: o.code, refundRequired: Boolean(o.refundRequired) }, o.cancelAt]),
  ];
  audit.forEach(([actor, action, type, entity, details, at], i) => {
    const key = `SEED-AUD-${String(i + 1).padStart(3, '0')}`;
    s += `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, created_at) SELECT ${uid(actor)}, ${q(action)}, ${q(type)}, ${entity}, JSON_OBJECT('seedKey', ${q(key)}, 'data', CAST(${q(JSON.stringify(details))} AS JSON)), ${ago(at)} FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE JSON_UNQUOTE(JSON_EXTRACT(details, '$.seedKey')) = ${q(key)});\n`;
  });
  emit('009_reviews_audit.sql', s);
  console.log(`reviews=${nReview} audit=${audit.length}`);
}

// ---------- kiểm tra chéo ----------
for (const o of orders) { assert(o.total === o.lines.reduce((n, l) => n + l.price * l.qty, 0) - o.discount + o.shipping, `tổng ${o.code}`); assert(o.history.every((h, i, a) => !i || h[1] <= a[i - 1][1]), `thứ tự thời gian ${o.code}`); }
for (const v of vouchers) assert(v.used === orders.filter((o) => o.voucher === v && o.status !== 'CANCELLED').length, `used_count ${v.code}`);
const counts = Object.fromEntries(PLAN.map(([s]) => [s, orders.filter((o) => o.status === s).length]));
console.log(`products=${products.length} variants=${allVariants.length} orders=${orders.length}`, counts, 'movements=', events.length);
console.log('vouchers used:', vouchers.map((v) => `${v.code}=${v.used}/${v.limit}`).join(' '));
