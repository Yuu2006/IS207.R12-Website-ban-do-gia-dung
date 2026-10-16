import { API_URL, requestApi } from './http-client.js';

// API quản trị catalog (Lan Chi + bổ sung task 12) và kho; quyền kiểm tra ở PHP.
const collection = name => ({
  list: () => requestApi(`/api/${name}`),
  save: (id, values) => requestApi(`/api/${name}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: values }),
  remove: id => requestApi(`/api/${name}/${id}`, { method: 'DELETE' }),
});

export const categories = collection('categories');
export const brands = collection('brands');
export const banners = { ...collection('banners'), list: () => requestApi('/api/admin/banners') };
export const products = collection('products');

export const listProducts = (filters = {}) => requestApi(`/api/products?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))}`);
export const listVariants = productId => requestApi(`/api/products/${productId}/variants`);
export const saveVariant = (productId, id, values) => requestApi(id ? `/api/variants/${id}` : `/api/products/${productId}/variants`, { method: id ? 'PUT' : 'POST', body: values });
export const listCategoryAttributes = categoryId => requestApi(`/api/categories/${categoryId}/attributes`);
export const createCategoryAttribute = (categoryId, values) => requestApi(`/api/categories/${categoryId}/attributes`, { method: 'POST', body: values });
export const getProductAttributes = productId => requestApi(`/api/products/${productId}/attributes`);
export const saveProductAttributes = (productId, attributes) => requestApi(`/api/products/${productId}/attributes`, { method: 'PUT', body: { attributes } });
export const setProductImage = (productId, imageUrl) => requestApi(`/api/products/${productId}/image`, { method: 'PUT', body: { image_url: imageUrl } });

// Upload trả đường dẫn tương đối; banner/brand/ảnh sản phẩm cần URL http(s) tuyệt đối.
export async function uploadImage(file, type) {
  const form = new FormData();
  form.append('image', file);
  form.append('type', type);
  const data = await requestApi('/api/uploads/images', { method: 'POST', body: form });
  return `${API_URL}${data.image_url}`;
}

export const listInventory = (lowStock = false) => requestApi(`/api/inventory${lowStock ? '?low_stock=1' : ''}`);
export const listMovements = (filters = {}) => requestApi(`/api/inventory/movements?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))}`);
export const adjustStock = values => requestApi('/api/inventory/movements', { method: 'POST', body: values });
