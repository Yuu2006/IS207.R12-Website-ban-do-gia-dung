import { ApiError, createApiClient } from './api-client.js';

const statuses = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'completed', 'cancelled'];
const payments = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
const badResponse = () => { throw new ApiError('Dữ liệu máy chủ không đúng hợp đồng đơn hàng.', 200, 'INVALID_API_RESPONSE'); };
const isId = value => typeof value === 'string' && value.trim().length > 0;
const isMoney = value => Number.isSafeInteger(value) && value >= 0;
const dateLabel = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

// API SKU là variant ID string; chỉ đổi tên tại biên service, không tính lại giá mua.
export function mapLine(item) {
  if (!isId(item?.skuId) || !isId(item.skuCode) || typeof item.productName !== 'string' || !isMoney(item.unitPrice) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) badResponse();
  return { sku_id: item.skuId, sku: item.skuCode, name: item.productName, variant: item.variantName || '', price: item.unitPrice, quantity: item.quantity, warranty: item.warrantyMonths ?? 0, image: item.imageUrl || '', lineDiscount: item.discount ?? 0 };
}

export function validateTotals(totals) {
  if (!totals || !['subtotal', 'discount', 'shipping', 'total'].every(key => isMoney(totals[key])) || totals.total !== totals.subtotal - totals.discount + totals.shipping) badResponse();
  return totals;
}

// A return request is separate from order/refund status; never infer approval from creation.
export function mapReturnRequest(dto) {
  if (!isId(dto?.id) || !isId(dto.orderId) || !['requested', 'approved', 'rejected', 'received', 'resolved'].includes(dto.status) || typeof dto.reason !== 'string' || !dto.reason.trim() || Number.isNaN(Date.parse(dto.createdAt))) badResponse();
  return { ...dto };
}

// Giữ id database cho URL, code cho hiển thị; summary không giả địa chỉ/history.
export function mapOrder(dto, detail = false) {
  if (!isId(dto?.id) || !isId(dto.code) || !Number.isSafeInteger(dto.version) || dto.version < 1 || !statuses.includes(dto.orderStatus) || !payments.includes(dto.paymentStatus) || !['COD', 'VNPAY'].includes(dto.paymentMethod) || Number.isNaN(Date.parse(dto.createdAt)) || !Array.isArray(dto.items)) badResponse();
  const totals = validateTotals(dto.totals);
  if (detail && (!dto.shippingAddress || !['recipientName', 'phone', 'addressLine'].every(key => typeof dto.shippingAddress[key] === 'string') || !Array.isArray(dto.history))) badResponse();
  if (dto.returnRequest != null && mapReturnRequest(dto.returnRequest).orderId !== dto.id) badResponse();
  return {
    id: dto.id, code: dto.code, version: dto.version, status: dto.orderStatus, payment: dto.paymentStatus, method: dto.paymentMethod,
    date: dateLabel(dto.createdAt), items: dto.items.map(mapLine), totals, discount: totals.discount, shipping: totals.shipping,
    note: dto.note || '', refundRequired: Boolean(dto.refundRequired),
    returnRequest: dto.returnRequest == null ? null : mapReturnRequest(dto.returnRequest),
    customer: { name: dto.shippingAddress?.recipientName || dto.customerName || '', phone: dto.shippingAddress?.phone || dto.customerPhone || '', address: dto.shippingAddress?.addressLine || '' },
    history: (dto.history || []).map(entry => {
      if (!entry || !statuses.includes(entry.toStatus) || !['CUSTOMER', 'SALES', 'ADMIN', 'SYSTEM'].includes(entry.actorRole) || Number.isNaN(Date.parse(entry.createdAt))) badResponse();
      return { ...entry, status: entry.toStatus, date: dateLabel(entry.createdAt), actor: { CUSTOMER: 'Khách hàng', SALES: 'Nhân viên bán hàng', ADMIN: 'Quản trị viên' }[entry.actorRole] || 'Hệ thống' };
    }),
  };
}

export function mapCart(dto) {
  if (!Number.isSafeInteger(dto?.cartVersion) || dto.cartVersion < 1 || !Array.isArray(dto.items)) badResponse();
  return { cartVersion: dto.cartVersion, items: dto.items.map(mapLine) };
}

export function mapQuote(dto) {
  if (!isId(dto?.quoteFingerprint) || !dto.shippingAddress) badResponse();
  return { ...mapCart(dto), quoteFingerprint: dto.quoteFingerprint, shippingAddress: dto.shippingAddress, totals: validateTotals(dto.totals) };
}

function mapPage(dto) {
  const pagination = dto?.pagination;
  if (!Array.isArray(dto?.items) || !pagination || !['page', 'pageSize', 'totalItems', 'totalPages'].every(key => Number.isSafeInteger(pagination[key]) && pagination[key] >= 0) || pagination.page < 1 || pagination.pageSize < 1 || pagination.pageSize > 50 || dto.items.length > pagination.pageSize || pagination.totalPages !== Math.ceil(pagination.totalItems / pagination.pageSize)) badResponse();
  return { items: dto.items.map(item => mapOrder(item)), pagination };
}

// Không chuyển token/actor/customerId/giá/tồn từ component thành căn cứ xác thực.
export function createOrderService(request = createApiClient()) {
  const idPath = id => encodeURIComponent(String(id));
  const list = async (path, { status, search, page = 1, pageSize = 10, signal } = {}) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) query.set('status', status);
    if (search) query.set('search', search.trim());
    return mapPage(await request(`${path}?${query}`, { signal }));
  };
  const mutation = (path, method, body, { idempotencyKey, signal } = {}) => {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new ApiError('Thiếu mã chống gửi lặp.', 422, 'IDEMPOTENCY_KEY_REQUIRED');
    return request(path, { method, body, idempotencyKey, signal });
  };
  const checkoutBody = input => ({ cartVersion: input.cartVersion, addressId: input.addressId, paymentMethod: input.paymentMethod, voucherCode: input.voucherCode || null });
  return {
    mode: 'http',
    listCustomerOrders: options => list('/orders', options),
    getCustomerOrder: async (id, options) => mapOrder(await request(`/orders/${idPath(id)}`, options), true),
    listSalesOrders: options => list('/sales/orders', options),
    getSalesOrder: async (id, options) => mapOrder(await request(`/sales/orders/${idPath(id)}`, options), true),
    cancelOrder: async (id, input, options) => mapOrder(await mutation(`/orders/${idPath(id)}/cancel`, 'POST', { expectedVersion: input.expectedVersion, reason: input.reason }, options), true),
    createReturnRequest: async (id, input, options) => {
      const result = mapReturnRequest(await mutation(`/orders/${idPath(id)}/returns`, 'POST', { expectedVersion: input.expectedVersion, reason: input.reason }, options));
      if (result.orderId !== String(id)) badResponse();
      return result;
    },
    updateSalesStatus: async (id, input, options) => mapOrder(await mutation(`/sales/orders/${idPath(id)}/status`, 'PATCH', { expectedVersion: input.expectedVersion, toStatus: input.toStatus, ...(input.reason !== undefined ? { reason: input.reason } : {}), ...(input.codCollected !== undefined ? { codCollected: input.codCollected } : {}) }, options), true),
    reorder: async (id, input, options) => mapCart(await mutation(`/orders/${idPath(id)}/reorder`, 'POST', { expectedCartVersion: input.expectedCartVersion }, options)),
    getCart: async options => mapCart(await request('/cart', options)),
    getAddresses: async options => {
      const result = await request('/addresses', options);
      if (!Array.isArray(result?.items) || !result.items.every(item => isId(item.id) && typeof item.recipientName === 'string' && typeof item.phone === 'string' && typeof item.addressLine === 'string')) badResponse();
      return result.items;
    },
    quoteCheckout: async (input, options) => mapQuote(await request('/checkout/quote', { ...options, method: 'POST', body: checkoutBody(input) })),
    createOrder: async (input, options) => {
      const result = await mutation('/checkout/orders', 'POST', { ...checkoutBody(input), quoteFingerprint: input.quoteFingerprint, note: input.note || '' }, options);
      const order = mapOrder(result?.order, true);
      if (result.payment !== null && (!result.payment || !isId(result.payment.attemptReference) || Number.isNaN(Date.parse(result.payment.expiresAt)))) badResponse();
      if (order.method === 'VNPAY' && !result.payment) badResponse();
      if (result.payment) {
        let url;
        try { url = new URL(result.payment.redirectUrl); } catch { badResponse(); }
        if (url.protocol !== 'https:' || url.hostname !== 'sandbox.vnpayment.vn') badResponse();
      }
      return { order, payment: result.payment };
    },
  };
}
