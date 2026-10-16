export const nextOrderStatus = Object.freeze({
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'shipping',
  shipping: 'delivered',
  delivered: 'completed',
});

const orderStatuses = [...Object.keys(nextOrderStatus), 'completed', 'cancelled'];
const paymentStatuses = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
const staffRoles = ['SALES', 'ADMIN'];
const hasId = id => (typeof id === 'string' && id.trim().length > 0) || (Number.isSafeInteger(id) && id > 0);
const failure = (code, message) => ({ ok: false, code, message });

// Hủy chỉ trước giao; helper này không quyết định hoặc thay đổi tồn kho.
export function canCancelOrder(status) {
  return ['pending', 'confirmed', 'preparing'].includes(status);
}

// Kiểm tra snapshot UI; backend phải kiểm tra lại với phiên, khóa order và dữ liệu thật.
export function validateOrderTransition(order, request) {
  if (!order || !request || !orderStatuses.includes(order.status) || !orderStatuses.includes(request.toStatus) ||
      !Array.isArray(order.history) || !paymentStatuses.includes(order.payment) || typeof order.method !== 'string' || !['COD', 'VNPAY'].includes(order.method.toUpperCase())) {
    return failure('INVALID_INPUT', 'Trạng thái đơn hoặc phương thức thanh toán không hợp lệ.');
  }
  const { actor, toStatus, expectedVersion, reason, codCollected } = request;
  if (!hasId(actor?.id) || !['CUSTOMER', ...staffRoles].includes(actor?.role)) {
    return failure('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
  }
  if (actor.role === 'CUSTOMER' && (toStatus !== 'cancelled' || !hasId(order.customerId) || String(actor.id) !== String(order.customerId))) {
    return failure('FORBIDDEN', 'Bạn chỉ được hủy đơn hàng của mình trước khi giao.');
  }
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !Number.isSafeInteger(order.version) || order.version < 1) {
    return failure('INVALID_INPUT', 'Thiếu phiên bản đơn hàng hợp lệ.');
  }
  if (order.version !== expectedVersion) return failure('ORDER_VERSION_CONFLICT', 'Đơn hàng đã thay đổi. Hãy tải lại trước khi thao tác.');
  if (toStatus === order.status || (toStatus === 'cancelled' ? !canCancelOrder(order.status) : nextOrderStatus[order.status] !== toStatus)) {
    return failure('INVALID_ORDER_TRANSITION', 'Không thể chuyển đơn hàng sang trạng thái này.');
  }
  if (toStatus === 'cancelled' && (typeof reason !== 'string' || !reason.trim())) {
    return failure('REASON_REQUIRED', 'Vui lòng nhập lý do hủy đơn.');
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 500)) {
    return failure('INVALID_INPUT', 'Lý do tối đa 500 ký tự.');
  }
  const isCodDelivery = order.method.toUpperCase() === 'COD' && order.status === 'shipping' && toStatus === 'delivered';
  if (codCollected !== undefined && (!isCodDelivery || typeof codCollected !== 'boolean')) {
    return failure('INVALID_INPUT', 'Xác nhận thu COD chỉ dùng khi chuyển từ đang giao sang đã giao.');
  }
  if (toStatus !== 'cancelled') {
    if (order.method.toUpperCase() === 'VNPAY' && order.payment !== 'paid') {
      return failure('PAYMENT_NOT_PAID', 'Chỉ xử lý đơn VNPay sau khi thanh toán đã được xác minh.');
    }
    if (order.method.toUpperCase() === 'COD') {
      if (order.status === 'delivered' && order.payment !== 'paid') return failure('PAYMENT_NOT_PAID', 'Đơn COD chưa được ghi nhận đã thu tiền.');
      if (order.status !== 'delivered' && order.payment !== 'unpaid') return failure('INVALID_INPUT', 'Trạng thái thanh toán COD không khớp bước giao hàng.');
      if (isCodDelivery && codCollected !== true) return failure('COD_COLLECTION_REQUIRED', 'Cần xác nhận đã giao hàng và thu đủ tiền COD.');
    }
  }
  return { ok: true, fromStatus: order.status, toStatus, paymentStatus: isCodDelivery ? 'paid' : order.payment, refundRequired: Boolean(order.refundRequired || (toStatus === 'cancelled' && order.payment === 'paid')) };
}

// Trả snapshot mới và một history entry; lỗi/retry version cũ giữ nguyên dữ liệu.
export function applyOrderTransition(order, request, now = new Date().toISOString()) {
  const result = validateOrderTransition(order, request);
  if (!result.ok) return { ...result, order };
  const timestamp = new Date(now);
  if (Number.isNaN(timestamp.getTime())) return { ...failure('INVALID_INPUT', 'Thời gian xử lý không hợp lệ.'), order };
  const entry = {
    fromStatus: result.fromStatus, toStatus: result.toStatus, status: result.toStatus,
    actorId: request.actor.id, actorRole: request.actor.role,
    actor: { CUSTOMER: 'Khách hàng', SALES: 'Nhân viên bán hàng', ADMIN: 'Quản trị viên' }[request.actor.role],
    createdAt: timestamp.toISOString(), date: timestamp.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    ...(request.reason?.trim() ? { reason: request.reason.trim() } : {}),
  };
  return { ...result, order: { ...order, status: result.toStatus, payment: result.paymentStatus, refundRequired: result.refundRequired, version: order.version + 1, history: [...order.history, entry] } };
}
