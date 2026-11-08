const hasValue = value => value !== null && value !== undefined && value !== '';

// So sánh bằng ID danh mục của API, tránh ghép hai loại chỉ vì tên hiển thị gần giống.
export function sameCategory(first, second) {
  return Boolean(first && second && hasValue(first.category_id) && hasValue(second.category_id)
    && String(first.category_id) === String(second.category_id));
}

export function comparableCandidates(products, first) {
  if (!first) return [];
  return products.filter(product => sameCategory(first, product) && String(product.id) !== String(first.id));
}

// Giữ tối đa bốn ID hợp lệ, cùng danh mục và không trùng nhau khi đọc URL.
export function selectedComparisonProducts(products, ids) {
  const selected = [];
  const seen = new Set();
  for (const id of ids.slice(0, 4)) {
    const product = findRequestedProduct(products, id);
    const key = product && String(product.id);
    if (product && !seen.has(key) && (selected.length === 0 || sameCategory(selected[0], product))) {
      selected.push(product);
      seen.add(key);
    } else selected.push(null);
  }
  return selected;
}

// Trang chi tiết storefront hiện còn dữ liệu mẫu: tên giúp tránh chọn nhầm ID trùng với API.
export function findRequestedProduct(products, id, expectedName = '') {
  if (!hasValue(id)) return null;
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return null;
  return expectedName && product.name?.trim() !== expectedName.trim() ? null : product;
}

export function productPrice(product) {
  if (!product) return null;
  const variantPrices = (product.variants || [])
    .filter(variant => variant.is_active === undefined || Number(variant.is_active) === 1)
    .map(variant => Number(variant.effective_price ?? variant.price))
    .filter(Number.isFinite);
  if (variantPrices.length) return Math.min(...variantPrices);
  const listedPrice = Number(product.min_price);
  return hasValue(product.min_price) && Number.isFinite(listedPrice) && listedPrice > 0 ? listedPrice : null;
}

export function productImage(product) {
  if (!product) return '';
  return product.images?.find(image => Number(image.is_primary) === 1)?.image_url
    || product.images?.[0]?.image_url || product.primary_image || '';
}

function objectSpecifications(product) {
  const raw = product?.specifications;
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function productionYear(product) {
  const specs = objectSpecifications(product);
  const yearAttribute = product?.attributes?.find(attribute => ['production_year', 'manufacture_year'].includes(attribute.attribute_key)
    || attribute.name === 'Năm sản xuất');
  return product?.production_year ?? product?.manufacture_year ?? specs['Năm sản xuất'] ?? specs.production_year
    ?? yearAttribute?.value_number ?? yearAttribute?.value_text ?? null;
}

function attributeValue(attribute) {
  if (attribute.data_type === 'boolean') {
    if (!hasValue(attribute.value_boolean)) return null;
    return Number(attribute.value_boolean) === 1 ? 'Có' : 'Không';
  }
  const value = attribute.data_type === 'number' ? attribute.value_number : attribute.value_text;
  if (!hasValue(value)) return null;
  const formatted = attribute.data_type === 'number' && Number.isFinite(Number(value))
    ? new Intl.NumberFormat('vi-VN').format(Number(value)) : String(value);
  return `${formatted}${attribute.unit ? ` ${attribute.unit}` : ''}`;
}

// Hợp nhất tiêu chí động của 2–4 sản phẩm; thuộc tính thiếu giữ dấu gạch thay vì suy đoán.
export function comparisonSpecs(products) {
  const rows = new Map();
  for (const [index, product] of products.entries()) {
    for (const attribute of product?.attributes || []) {
      const key = attribute.attribute_key || attribute.name;
      if (!key) continue;
      if (['production_year', 'manufacture_year'].includes(key) || attribute.name === 'Năm sản xuất') continue;
      if (!rows.has(key)) rows.set(key, { key, label: attribute.name || key, values: Array(products.length).fill(null) });
      rows.get(key).values[index] = attributeValue(attribute);
    }
    for (const [label, rawValue] of Object.entries(objectSpecifications(product))) {
      if (['Thương hiệu', 'Hãng sản xuất', 'Năm sản xuất', 'production_year'].includes(label)) continue;
      if (!hasValue(rawValue) || typeof rawValue === 'object') continue;
      const existing = [...rows.values()].find(row => row.label.toLocaleLowerCase('vi-VN') === label.toLocaleLowerCase('vi-VN'));
      const key = existing?.key || `spec:${label}`;
      if (!rows.has(key)) rows.set(key, { key, label, values: Array(products.length).fill(null) });
      if (!hasValue(rows.get(key).values[index])) rows.get(key).values[index] = String(rawValue);
    }
  }
  return [...rows.values()];
}

const numericInput = value => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0
  ? null : Number(value);
const attributeNumber = (product, key) => {
  const value = product?.attributes?.find(attribute => attribute.attribute_key === key)?.value_number;
  return numericInput(value);
};

// Ước tính hiển thị; thành phần thiếu luôn giữ null, tổng không được suy ra từ số 0 giả.
export function estimateTco(product, assumptions) {
  if (!product) return null;
  const years = Number(assumptions.years);
  const purchase = productPrice(product);
  const electricityRate = numericInput(assumptions.electricityRate);
  const waterRate = numericInput(assumptions.waterRate);
  const usesPerWeek = numericInput(assumptions.usesPerWeek);
  const hoursPerUse = numericInput(assumptions.hoursPerUse);
  const consumablesPerYear = numericInput(assumptions.consumablesPerYear);
  const maintenancePerYear = numericInput(assumptions.maintenancePerYear);
  const annualKwh = attributeNumber(product, 'energy_kwh_year');
  const watts = attributeNumber(product, 'power_watts');
  const litersPerCycle = attributeNumber(product, 'water_liters_cycle');
  const yearlyUses = usesPerWeek === null ? null : usesPerWeek * 52;
  const electricityKwh = annualKwh !== null ? annualKwh * years
    : watts !== null && yearlyUses !== null && hoursPerUse !== null ? watts / 1000 * hoursPerUse * yearlyUses * years : null;
  const electricity = electricityRate !== null && electricityKwh !== null ? Math.round(electricityKwh * electricityRate) : null;
  // Các loại này không dùng nước vận hành; máy giặt cần số lít và tần suất sử dụng.
  const noWater = ['tu-lanh', 'may-lanh'].includes(product.category_slug);
  const waterM3 = noWater ? 0 : litersPerCycle !== null && yearlyUses !== null ? litersPerCycle / 1000 * yearlyUses * years : null;
  const water = noWater ? 0 : waterM3 !== null && waterRate !== null ? Math.round(waterM3 * waterRate) : null;
  const consumables = consumablesPerYear === null ? null : Math.round(consumablesPerYear * years);
  const maintenance = maintenancePerYear === null ? null : Math.round(maintenancePerYear * years);
  const parts = { purchase, electricity, water, consumables, maintenance };
  const missing = Object.entries(parts).filter(([, value]) => value === null).map(([key]) => key);
  return { ...parts, total: missing.length ? null : Object.values(parts).reduce((sum, value) => sum + value, 0), missing };
}
