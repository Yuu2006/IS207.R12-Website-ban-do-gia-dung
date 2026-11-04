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

// Hợp nhất tiêu chí động từ API; thuộc tính thiếu giữ dấu gạch thay vì suy đoán giá trị.
export function comparisonSpecs(first, second) {
  const rows = new Map();
  for (const [index, product] of [first, second].entries()) {
    for (const attribute of product?.attributes || []) {
      const key = attribute.attribute_key || attribute.name;
      if (!key) continue;
      if (['production_year', 'manufacture_year'].includes(key) || attribute.name === 'Năm sản xuất') continue;
      if (!rows.has(key)) rows.set(key, { key, label: attribute.name || key, values: [null, null] });
      rows.get(key).values[index] = attributeValue(attribute);
    }
    for (const [label, rawValue] of Object.entries(objectSpecifications(product))) {
      if (['Thương hiệu', 'Hãng sản xuất', 'Năm sản xuất', 'production_year'].includes(label)) continue;
      if (!hasValue(rawValue) || typeof rawValue === 'object') continue;
      const existing = [...rows.values()].find(row => row.label.toLocaleLowerCase('vi-VN') === label.toLocaleLowerCase('vi-VN'));
      const key = existing?.key || `spec:${label}`;
      if (!rows.has(key)) rows.set(key, { key, label, values: [null, null] });
      if (!hasValue(rows.get(key).values[index])) rows.get(key).values[index] = String(rawValue);
    }
  }
  return [...rows.values()];
}
