import { API_URL } from './http-client.js';
import {
  getProduct,
  getProductAttributes,
  listProducts,
  categories,
  brands,
  searchProducts
} from './catalog-service.js';
// Đọc catalog công khai (GET /api/products*) và đổi sang dạng mà ProductCard/trang khách đang dùng.
// API chưa có đánh giá/xếp hạng nên rating = null; trang hiển thị "chưa có đánh giá" thay vì số giả.
const NO_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#F1F5F9"/><text x="200" y="205" font-family="Arial" font-size="18" fill="#94A3B8" text-anchor="middle">Chưa có ảnh</text></svg>');
const imageUrl = path => (path ? (/^https?:/.test(path) ? path : `${API_URL}${path}`) : NO_IMAGE);
const CATEGORY_ICON = { 'Tủ lạnh': '🧊', 'Máy giặt': '🧺', 'Máy lạnh': '❄️' };
const toCard = (p) => ({
  id: String(p.id),
  name: p.name,
  brand: p.brand_name,
  brandId: p.brand_id,
  category: p.category_name,
  categoryId: p.category_id,

  price: Number(p.min_price),
  originalPrice: Number(p.min_price),
  discount: 0,

  rating: p.rating_average == null
    ? null
    : Number(p.rating_average),

  reviews: Number(p.review_count ?? 0),
  reviewCount: Number(p.review_count ?? 0),
  soldQuantity: Number(p.sold_quantity ?? 0),

  inStock: Number(p.total_stock) > 0,
  variant_count: Number(p.variant_count ?? 0),
  warranty: `${p.warranty_months} tháng`,

  image: imageUrl(p.primary_image),
  images: [],
  specs: {},
});
let listPromise;
export function loadStorefront() {
  listPromise ??= listProducts({ is_active: 1 }).then(rows => {
    const products = rows.map(toCard);
    const counts = new Map();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    const categories = [...counts].map(([name, count]) => ({ id: name, name, count, icon: CATEGORY_ICON[name] ?? '🏠' }));
    return { products, categories };
  }).catch(error => { listPromise = undefined; throw error; });
  return listPromise;
}
export async function loadProductListing(filters = {}) {
  const [result, categoryData, brandData] = await Promise.all([
    searchProducts(filters),
    categories.list(),
    brands.list(),
  ]);

  return {
    products: result.items.map(toCard),
    categories: categoryData,
    brands: brandData,
    pagination: result.pagination,
  };
}

const attributeText = a => (a.data_type === 'boolean' ? (a.value_boolean ? 'Có' : 'Không')
  : a.data_type === 'number' ? `${Number(a.value_number).toLocaleString('vi-VN')}${a.unit ? ` ${a.unit}` : ''}`
    : a.value_text);

export async function loadProductDetail(id) {
  const [p, attributes] = await Promise.all([getProduct(id), getProductAttributes(id)]);
  const variants = p.variants.filter(v => v.is_active);
  const pool = variants.some(v => Number(v.stock_quantity) > 0) ? variants.filter(v => Number(v.stock_quantity) > 0) : variants;
  const best = pool.reduce((a, b) => (Number(b.effective_price) < Number(a.effective_price) ? b : a), pool[0]);
  const price = Number(best?.effective_price ?? 0), originalPrice = Number(best?.price ?? price);
  let year; try { year = JSON.parse(p.specifications ?? '{}')['Năm sản xuất']; } catch { /* specifications không phải JSON hợp lệ: bỏ qua */ }
  return {
    ...toCard({ ...p, min_price: price, total_stock: variants.reduce((n, v) => n + Number(v.stock_quantity), 0), primary_image: null }),
    price, originalPrice, discount: originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0,
    images: p.images.length ? p.images.map(i => imageUrl(i.image_url)) : [NO_IMAGE], image: imageUrl(p.images[0]?.image_url),
    specs: {
      'Thương hiệu': p.brand_name,
      ...Object.fromEntries(attributes.map(a => [a.name, attributeText(a)])),
      ...(year ? { 'Năm sản xuất': String(year) } : {}),
      'Bảo hành': `${p.warranty_months} tháng`,
    },
  };
}
