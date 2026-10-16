// Chỉ chấp nhận định danh khách hàng hợp lệ; role frontend không thay thế kiểm tra API.
export function isCustomerUser(user) {
  return Boolean(user && user.role === 'CUSTOMER' && (
    (typeof user.id === 'string' && user.id.trim().length > 0) ||
    (typeof user.id === 'number' && Number.isSafeInteger(user.id) && user.id > 0)
  ));
}

// Giới hạn nơi quay lại sau đăng nhập, không nhận URL bên ngoài hay trang nhân viên.
export function customerReturnPath(path) {
  return typeof path === 'string' && /^\/(?:orders(?:\/[A-Za-z0-9_-]+)?|checkout)(?:\?[^#\s]*)?(?:#[^\s]*)?$/.test(path)
    ? path
    : '/orders';
}
