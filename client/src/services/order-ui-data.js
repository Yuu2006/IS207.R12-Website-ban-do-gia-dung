export const statusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const nextStatus = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'shipping',
  shipping: 'delivered',
  delivered: 'completed',
};

export const money = value => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
}).format(value);

export const orderTotal = order => order.items.reduce(
  (total, item) => total + item.price * item.quantity,
  0,
) + order.shipping - order.discount;

export const paymentLabel = value => ({
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  pending: 'Chờ thanh toán',
}[value] || 'Chưa cập nhật');

const products = [
  { sku: 'SS-RT38-382', sku_id: 1, name: 'Tủ lạnh Samsung Inverter 382L', variant: 'RT38CG6584S9SV · Bạc', price: 8990000, quantity: 1, warranty: 24, image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=320&auto=format&fit=crop' },
  { sku: 'LG-FV1409-9', sku_id: 2, name: 'Máy giặt LG Inverter 9kg', variant: 'FV1409S2V · Trắng', price: 6490000, quantity: 1, warranty: 24, image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=320&auto=format&fit=crop' },
  { sku: 'TS-RC18-18', sku_id: 3, name: 'Nồi cơm điện Toshiba 1.8L', variant: 'RC-18NMFVN · Trắng', price: 1290000, quantity: 2, warranty: 12, image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=320&auto=format&fit=crop' },
  { sku: 'DK-FTKB35-35', sku_id: 4, name: 'Điều hòa Daikin Inverter 1.5 HP', variant: 'FTKB35XVMV · Trắng', price: 9290000, quantity: 1, warranty: 36, image: 'https://images.unsplash.com/photo-1631545806609-2d56c7b20bb6?w=320&auto=format&fit=crop' },
];

const customer = {
  name: 'Nguyễn Minh',
  phone: '090 123 4567',
  address: '12 Nguyễn Văn Bảo, Phường Hạnh Thông, TP. Hồ Chí Minh',
};

export function initialCart() {
  return [products[0], products[1]].map(item => ({ ...item }));
}

export function initialOrders() {
  return [
    { id: 'HC2026100001', date: '01/10/2026', status: 'completed', payment: 'paid', method: 'VNPay', items: [{ ...products[0] }], customer: { ...customer }, shipping: 0, discount: 0, note: '', history: [{ status: 'pending', date: '01/10/2026 · 08:30', actor: 'Khách hàng' }, { status: 'confirmed', date: '01/10/2026 · 09:00', actor: 'Nhân viên bán hàng' }, { status: 'shipping', date: '02/10/2026 · 08:00', actor: 'Nhân viên bán hàng' }, { status: 'completed', date: '02/10/2026 · 16:00', actor: 'Nhân viên bán hàng' }] },
    { id: 'HC2026100002', date: '02/10/2026', status: 'shipping', payment: 'unpaid', method: 'COD', items: [{ ...products[1] }, { ...products[2], quantity: 1 }], customer: { ...customer }, shipping: 0, discount: 0, note: 'Vui lòng gọi trước khi giao.', history: [{ status: 'pending', date: '02/10/2026 · 08:30', actor: 'Khách hàng' }, { status: 'shipping', date: '02/10/2026 · 11:00', actor: 'Nhân viên bán hàng' }] },
    { id: 'HC2026100003', date: '02/10/2026', status: 'pending', payment: 'unpaid', method: 'COD', items: [{ ...products[0] }, { ...products[1] }], customer: { ...customer }, shipping: 0, discount: 0, note: '', history: [{ status: 'pending', date: '02/10/2026 · 10:15', actor: 'Khách hàng' }] },
    { id: 'HC2026090098', date: '28/09/2026', status: 'cancelled', payment: 'unpaid', method: 'COD', items: [{ ...products[3] }], customer: { ...customer }, shipping: 0, discount: 0, note: '', history: [{ status: 'pending', date: '28/09/2026 · 09:00', actor: 'Khách hàng' }, { status: 'cancelled', date: '28/09/2026 · 10:00', actor: 'Khách hàng', reason: 'Thay đổi nhu cầu mua hàng.' }] },
  ];
}
