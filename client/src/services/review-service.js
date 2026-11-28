import { API_URL, requestApi, uploadImage } from './http-client.js';

export const listProductReviews = (productId, filters = {}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
  return requestApi(`/api/products/${encodeURIComponent(productId)}/reviews${query.size ? `?${query}` : ''}`);
};

export const listEligibleReviews = productId => requestApi(`/api/reviews/eligible?productId=${encodeURIComponent(productId)}`);
export const submitReview = payload => requestApi('/api/reviews', { method: 'POST', body: payload });
export const submitReviewFollowup = (reviewId, payload) => requestApi(`/api/reviews/${encodeURIComponent(reviewId)}/followups`, { method: 'POST', body: payload });
export const listAdminReviews = filters => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
  return requestApi(`/api/admin/reviews${query.size ? `?${query}` : ''}`);
};
export const setReviewVisibility = (id, payload) => requestApi(`/api/admin/reviews/${encodeURIComponent(id)}/visibility`, { method: 'PATCH', body: payload });
export async function uploadReviewPhoto(file) {
  const uploaded = await uploadImage(file, 'reviews');
  const target = new URL(uploaded, API_URL);
  const apiOrigin = new URL(API_URL).origin;
  if (target.origin !== apiOrigin) throw new Error('Ảnh đánh giá phải được tải lên máy chủ HomeCare.');
  return target.pathname;
}
