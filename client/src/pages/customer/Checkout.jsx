import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, ProductLines, Totals } from '../../components/order/OrderParts.jsx';

// Xây luồng checkout và trạng thái giao diện cho giỏ hàng hiện tại.
export default function Checkout({ cart, setCart, orders, setOrders }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [method, setMethod] = useState('COD');
  const [note, setNote] = useState('');
  const [voucher, setVoucher] = useState('');
  const [discount, setDiscount] = useState(0);
  const [voucherMessage, setVoucherMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function applyVoucher() {
    const valid = voucher.trim().toUpperCase() === 'HOMECARE';
    setDiscount(valid ? Math.min(100000, subtotal) : 0);
    setVoucherMessage(valid ? 'Mã ưu đãi đã được áp dụng.' : 'Mã ưu đãi không hợp lệ.');
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = {};
    if (customer.name.trim().length < 2) nextErrors.name = 'Nhập họ tên người nhận.';
    if (!/^(0\d{9}|\+84\d{9})$/.test(customer.phone.replace(/[\s.-]/g, ''))) nextErrors.phone = 'Nhập số điện thoại hợp lệ.';
    if (customer.address.trim().length < 10) nextErrors.address = 'Nhập địa chỉ giao hàng đầy đủ.';
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length || !cart.length) return;
    setBusy(true);
    const orderId = `HC${Date.now()}`;
    const date = new Date().toLocaleDateString('vi-VN');
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= 500000 ? 0 : 30000;
    const order = { id: orderId, date, customer: { ...customer }, items: cart.map(item => ({ ...item })), shipping, discount, note, method, status: 'pending', payment: method === 'COD' ? 'unpaid' : 'pending', history: [{ status: 'pending', date: `${date} · ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`, actor: 'Khách hàng' }] };
    setOrders(current => [order, ...current]);
    setCart([]);
    navigate(`/orders/${orderId}`, { state: { created: true } });
    setBusy(false);
  }

  const updateCustomer = (key, value) => {
    setCustomer(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
  };

  return <main className="oc-main oc-main--wide"><div className="oc-breadcrumb"><Link to="/orders">Đơn hàng</Link><span>/</span>Thanh toán</div>
    <div className="oc-title-row"><div><span className="oc-eyebrow">HOÀN TẤT MUA SẮM</span><h1>Thanh toán</h1><p>Một bước nữa để mang tiện nghi về nhà.</p></div><span className="oc-secure"><Icon name="check" size={17} />Thông tin rõ ràng, an tâm mua sắm</span></div>
    {!cart.length ? <div className="oc-empty"><Icon name="bag" size={40} /><h2>Giỏ hàng của bạn đang trống</h2><p>Thêm sản phẩm vào giỏ hàng để tiếp tục thanh toán.</p><Link className="oc-button oc-button--outline" to="/orders">Quay lại đơn hàng</Link></div> : <form className="oc-checkout-grid" noValidate onSubmit={placeOrder}>
      <div className="oc-stack"><section className="oc-card oc-form-section"><h2><span className="oc-section-icon"><Icon name="pin" /></span>Thông tin giao hàng</h2>
        <div className="oc-form-grid">{[['name', 'Họ tên người nhận', 'name'], ['phone', 'Số điện thoại', 'tel']].map(([key, label, autoComplete]) => <label className="oc-field" key={key}>{label}<input name={key} autoComplete={autoComplete} type={key === 'phone' ? 'tel' : 'text'} value={customer[key]} onChange={event => updateCustomer(key, event.target.value)} aria-invalid={!!errors[key]} required />{errors[key] && <small className="oc-error">{errors[key]}</small>}</label>)}</div>
        <label className="oc-field">Địa chỉ giao hàng<textarea name="address" autoComplete="street-address" rows={2} value={customer.address} onChange={event => updateCustomer('address', event.target.value)} aria-invalid={!!errors.address} required />{errors.address && <small className="oc-error">{errors.address}</small>}</label>
        <label className="oc-field">Ghi chú giao hàng <span className="oc-muted">(không bắt buộc)</span><textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: Gọi trước khi giao, giao trong giờ hành chính…" /></label>
        <div className="oc-info"><Icon name="truck" /><div><strong>Giao hàng tiêu chuẩn</strong><span>Thời gian và phí giao hàng được xác nhận khi tạo đơn.</span></div></div>
      </section><section className="oc-card oc-form-section"><h2><span className="oc-section-icon"><Icon name="card" /></span>Phương thức thanh toán</h2><fieldset className="oc-payment-options"><legend className="oc-sr-only">Chọn phương thức thanh toán</legend>{[['COD', 'Thanh toán khi nhận hàng', 'Thanh toán khi nhận sản phẩm.'], ['VNPAY', 'VNPay', 'Thanh toán trực tuyến qua VNPay.']].map(([value, title, text]) => <label key={value} className={`oc-payment-option ${method === value ? 'is-selected' : ''}`}><input type="radio" name="payment" checked={method === value} onChange={() => setMethod(value)} /><Icon name={value === 'COD' ? 'box' : 'card'} /><span><strong>{title}</strong><small>{text}</small></span></label>)}</fieldset></section></div>
      <aside className="oc-card oc-summary"><h2>Đơn hàng của bạn <span>{cart.length} sản phẩm</span></h2><ProductLines items={cart} />
        <div className="oc-voucher"><label htmlFor="voucher">Mã ưu đãi</label><div><input id="voucher" value={voucher} onChange={event => { setVoucher(event.target.value); setVoucherMessage(''); setDiscount(0); }} placeholder="Nhập mã ưu đãi" /><button className="oc-button oc-button--outline" type="button" onClick={applyVoucher}>Áp dụng</button></div><small role="status">{voucherMessage || 'Mỗi đơn hàng áp dụng một mã ưu đãi.'}</small></div>
        <Totals subtotal={subtotal} discount={discount} shipping={subtotal >= 500000 ? 0 : 30000} /><button className="oc-button oc-button--full" disabled={busy} type="submit">{busy ? 'Đang xử lý…' : 'Đặt hàng'}<Icon name="arrow" size={17} /></button>
        {message && <p className="oc-error" role="alert">{message}</p>}<Link className="oc-back-link" to="/orders">← Quay lại đơn hàng ({orders.length})</Link>
      </aside>
    </form>}
  </main>;
}
