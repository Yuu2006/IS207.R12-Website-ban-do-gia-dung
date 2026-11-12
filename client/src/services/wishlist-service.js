import { createApiClient } from './api-client.js';

const request = createApiClient();

// Lấy danh sách sản phẩm yêu thích.
export function getWishlist({ signal } = {}) {
    return request('/wishlist', { signal });
}

// Thêm sản phẩm vào danh sách yêu thích.
export function addWishlist(productId, options = {}) {
    return request('/wishlist', {
        ...options,
        method: 'POST',
        body: { productId: String(productId) }
    });
}

// Xóa sản phẩm khỏi danh sách yêu thích.
export function removeWishlist(productId, options = {}) {
    return request(`/wishlist/${productId}`, {
        ...options,
        method: 'DELETE',
        body: {}
    });
}

// Chuyển sản phẩm yêu thích sang giỏ hàng.
export function moveWishlistToCart(
    productId,
    skuId,
    quantity,
    options = {}
) {
    return request(`/wishlist/${productId}/move-to-cart`, {
        ...options,
        method: 'POST',
        body: {
            skuId: String(skuId),
            quantity
        }
    });
}
