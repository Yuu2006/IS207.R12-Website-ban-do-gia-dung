import { ApiError } from './api-client.js';
import { initialCart, initialOrders, getCustomerOrders } from './order-ui-data.js';
import { applyOrderTransition } from '../utils/order-state.js';

const copy = value => structuredClone(value);
const fail = (status, code, message) => { throw new ApiError(message, status, code); };
const staff = { id: 'preview:sales', role: 'SALES' };

// Bộ nhớ development riêng: không ghi MySQL, không ký VNPay, không giả lập thanh toán thành công.
export function createMockOrderService({ getCustomer, getStaff = async () => staff, delayMs = 180 } = {}) {
  let orders = initialOrders().map(order => ({ ...order, code: order.id }));
  const carts = new Map();
  const replay = new Map();
  const wait = async signal => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  const customer = async () => {
    const user = await getCustomer?.();
    if (!user?.id) fail(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.');
    if (user.role !== 'CUSTOMER') fail(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện.');
    return user;
  };
  const sales = async () => {
    const user = await getStaff();
    if (!user?.id) fail(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập nhân viên.');
    if (!['SALES', 'ADMIN'].includes(user.role)) fail(403, 'FORBIDDEN', 'Tài khoản không có quyền xử lý đơn.');
    return user;
  };
  const cartFor = user => {
    if (!carts.has(user.id)) carts.set(user.id, { cartVersion: 1, items: initialCart() });
    return carts.get(user.id);
  };
  const addressesFor = user => [{ id: `address:${user.id}`, recipientName: user.fullName || 'Khách hàng', phone: '0900000000', addressLine: '12 Nguyễn Văn Bảo, TP. Hồ Chí Minh', isDefault: true }];
  const find = (id, user) => {
    const order = orders.find(item => String(item.id) === String(id) && (user.role !== 'CUSTOMER' || String(item.customerId) === String(user.id)));
    if (!order) fail(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    return order;
  };
  const list = (items, { status, search = '', page = 1, pageSize = 10 } = {}) => {
    const term = search.toLocaleLowerCase('vi');
    const filtered = items.filter(order => (!status || status.split(',').includes(order.status)) && `${order.code} ${order.customer.name} ${order.customer.phone}`.toLocaleLowerCase('vi').includes(term));
    return copy({ items: filtered.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, totalItems: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) } });
  };
  const mutate = (user, operation, input, options, apply) => {
    const key = options?.idempotencyKey;
    if (typeof key !== 'string' || key.length < 16 || key.length > 128) fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu mã chống gửi lặp.');
    const scope = JSON.stringify([user.id, operation, key]);
    const hash = JSON.stringify(input);
    if (replay.has(scope)) {
      const previous = replay.get(scope);
      if (previous.hash !== hash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Mã gửi lặp đã được dùng cho yêu cầu khác.');
      return copy(previous.result);
    }
    const result = apply();
    replay.set(scope, { hash, result: copy(result) });
    return copy(result);
  };
  const transition = (order, input, actor) => {
    const result = applyOrderTransition(order, { ...input, actor });
    if (!result.ok) fail(['FORBIDDEN'].includes(result.code) ? 403 : ['INVALID_INPUT', 'REASON_REQUIRED', 'COD_COLLECTION_REQUIRED'].includes(result.code) ? 422 : 409, result.code, result.message);
    orders = orders.map(item => item.id === order.id ? result.order : item);
    return result.order;
  };
  const quote = (user, input) => {
    const cart = cartFor(user);
    if (input.cartVersion !== cart.cartVersion) fail(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại.');
    if (!cart.items.length) fail(422, 'EMPTY_CART', 'Giỏ hàng đang trống.');
    const address = addressesFor(user).find(item => item.id === input.addressId);
    if (!address) fail(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ.');
    if (!['COD', 'VNPAY'].includes(input.paymentMethod)) fail(422, 'INVALID_INPUT', 'Phương thức thanh toán không hợp lệ.');
    if (input.voucherCode && input.voucherCode !== 'HOMECARE') fail(422, 'VOUCHER_INVALID', 'Mã ưu đãi không hợp lệ.');
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = input.voucherCode ? Math.min(100000, subtotal) : 0;
    const shipping = subtotal >= 500000 ? 0 : 30000;
    return copy({ ...cart, shippingAddress: address, totals: { subtotal, discount, shipping, total: subtotal - discount + shipping }, quoteFingerprint: JSON.stringify([user.id, cart.cartVersion, input.addressId, input.paymentMethod, input.voucherCode || null, subtotal, discount, shipping]) });
  };
  return {
    mode: 'mock',
    async listCustomerOrders(options = {}) { await wait(options.signal); const user = await customer(); return list(getCustomerOrders(orders, user.id), options); },
    async getCustomerOrder(id, options = {}) { await wait(options.signal); return copy(find(id, await customer())); },
    async listSalesOrders(options = {}) { await wait(options.signal); await sales(); return list(orders, options); },
    async getSalesOrder(id, options = {}) { await wait(options.signal); return copy(find(id, await sales())); },
    async getCart(options = {}) { await wait(options.signal); return copy(cartFor(await customer())); },
    async getAddresses(options = {}) { await wait(options.signal); return copy(addressesFor(await customer())); },
    async quoteCheckout(input, options = {}) { await wait(options.signal); return quote(await customer(), input); },
    async cancelOrder(id, input, options) {
      await wait(options?.signal); const user = await customer(); find(id, user);
      return mutate(user, `cancel:${id}`, input, options, () => transition(find(id, user), { expectedVersion: input.expectedVersion, toStatus: 'cancelled', reason: input.reason }, user));
    },
    async updateSalesStatus(id, input, options) {
      await wait(options?.signal); const user = await sales(); find(id, user);
      return mutate(user, `status:${id}`, input, options, () => transition(find(id, user), input, user));
    },
    async reorder(id, input, options) {
      await wait(options?.signal); const user = await customer(); find(id, user);
      return mutate(user, `reorder:${id}`, input, options, () => {
        const order = find(id, user);
        if (!['delivered', 'completed', 'cancelled'].includes(order.status)) fail(409, 'REORDER_UNAVAILABLE', 'Đơn chưa thể mua lại.');
        const cart = cartFor(user);
        if (cart.cartVersion !== input.expectedCartVersion) fail(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi.');
        const catalog = new Map(initialCart().map(item => [item.sku, item]));
        if (order.items.some(item => !catalog.has(item.sku))) fail(409, 'REORDER_UNAVAILABLE', 'Một số sản phẩm không còn khả dụng.');
        const items = copy(cart.items);
        order.items.forEach(item => {
          const existing = items.find(line => line.sku === item.sku);
          if (existing) existing.quantity += item.quantity;
          else items.push({ ...catalog.get(item.sku), quantity: item.quantity });
        });
        const result = { cartVersion: cart.cartVersion + 1, items };
        carts.set(user.id, result); return result;
      });
    },
    async createOrder(input, options) {
      await wait(options?.signal); const user = await customer();
      return mutate(user, 'create', input, options, () => {
        const current = quote(user, input);
        if (input.quoteFingerprint !== current.quoteFingerprint) fail(409, 'CHECKOUT_CHANGED', 'Thông tin thanh toán đã thay đổi. Hãy xác nhận lại.');
        if (input.paymentMethod === 'VNPAY') fail(409, 'PAYMENT_NOT_AVAILABLE', 'Thanh toán VNPay chưa sẵn sàng. Vui lòng chọn COD.');
        if (typeof input.note !== 'string' || input.note.length > 500) fail(422, 'INVALID_INPUT', 'Ghi chú tối đa 500 ký tự.');
        const id = `HC${Date.now()}${orders.length}`;
        const timestamp = new Date().toISOString();
        const order = { id, code: id, customerId: user.id, version: 1, status: 'pending', payment: 'unpaid', method: 'COD', items: current.items, totals: current.totals, shipping: current.totals.shipping, discount: current.totals.discount, customer: { name: current.shippingAddress.recipientName, phone: current.shippingAddress.phone, address: current.shippingAddress.addressLine }, note: input.note, refundRequired: false, date: new Date(timestamp).toLocaleString('vi-VN'), history: [{ fromStatus: null, toStatus: 'pending', status: 'pending', actorId: user.id, actorRole: 'CUSTOMER', actor: 'Khách hàng', createdAt: timestamp, date: new Date(timestamp).toLocaleString('vi-VN') }] };
        orders.unshift(order);
        carts.set(user.id, { cartVersion: current.cartVersion + 1, items: [] });
        return { order, payment: null };
      });
    },
  };
}
