import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, ProductLines, Totals } from '../../components/order/OrderParts.jsx';
import OrderApiState from '../../components/order/OrderApiState.jsx';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';

// Nhận địa chỉ/giỏ/quote từ service; chỉ submit ID/version, không gửi giá/tồn từ JSX.
export default function Checkout({ initialCart }) {
  const service = useOrderService();
  const navigate = useNavigate();
  const { refreshSession } = useCustomerAuth();
  const [addressId, setAddressId] = useState('');
  const [method, setMethod] = useState('COD');
  const [note, setNote] = useState('');
  const [voucher, setVoucher] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const action = useOrderAction({ onUnauthorized: () => refreshSession().catch(() => {}) });
  const context = useOrderQuery(async signal => {
    const [cart, addresses] = await Promise.all([service.getCart({ signal }), service.getAddresses({ signal })]);
    return { cart, addresses };
  }, [service], { initialData: initialCart ? { cart: { cartVersion: 1, items: initialCart }, addresses: [] } : null });
  const cart = context.data?.cart;
  const addresses = context.data?.addresses ?? [];
  const selectedAddressId = addressId || addresses.find(address => address.isDefault)?.id || addresses[0]?.id || '';
  const request = { cartVersion: cart?.cartVersion, addressId: selectedAddressId, paymentMethod: method, voucherCode: appliedVoucher };
  const quote = useOrderQuery(signal => service.quoteCheckout(request, { signal }),
    [service, cart?.cartVersion, selectedAddressId, method, appliedVoucher], { enabled: Boolean(cart?.items.length && selectedAddressId) });
  const locked = action.busy || action.uncertain;

  async function placeOrder(event) {
    event.preventDefault();
    if (action.busy || quote.loading || !quote.data) return;
    const input = { ...request, quoteFingerprint: quote.data.quoteFingerprint, note };
    const result = await action.run('createOrder', input, options => service.createOrder(input, options));
    if (!result) return;
    if (result.payment) window.location.assign(result.payment.redirectUrl);
    else navigate(`/orders/${result.order.id}`, { state: { created: true } });
  }

  return <main className="oc-main oc-main--wide"><div className="oc-breadcrumb"><Link to="/orders">Đơn hàng</Link><span>/</span>Thanh toán</div>
    <div className="oc-title-row"><div><span className="oc-eyebrow">HOÀN TẤT MUA SẮM</span><h1>Thanh toán</h1><p>Một bước nữa để mang tiện nghi về nhà.</p></div><span className="oc-secure"><Icon name="check" size={17} />Thông tin rõ ràng, an tâm mua sắm</span></div>
    {context.loading || context.error ? <OrderApiState {...context} retry={context.reload} /> : !cart?.items.length ? <div className="oc-empty"><Icon name="bag" size={40} /><h2>Giỏ hàng của bạn đang trống</h2><p>Thêm sản phẩm vào giỏ hàng để tiếp tục thanh toán.</p><Link className="oc-button oc-button--outline" to="/products">Khám phá sản phẩm</Link></div> : <form className="oc-checkout-grid" noValidate onSubmit={placeOrder}>
      <div className="oc-stack"><section className="oc-card oc-form-section"><h2><span className="oc-section-icon"><Icon name="pin" /></span>Thông tin giao hàng</h2>
        {!addresses.length ? <p role="status">Bạn chưa có địa chỉ giao hàng. Vui lòng bổ sung địa chỉ trong hồ sơ tài khoản.</p> : <><label className="oc-field">Địa chỉ giao hàng<select value={selectedAddressId} onChange={event => setAddressId(event.target.value)} disabled={locked}>{addresses.map(address => <option key={address.id} value={address.id}>{address.recipientName} · {address.addressLine}</option>)}</select></label>
          {addresses.filter(address => address.id === selectedAddressId).map(address => <div key={address.id}><strong>{address.recipientName}</strong><p>{address.phone}</p><p>{address.addressLine}</p></div>)}</>}
        <label className="oc-field">Ghi chú giao hàng <span className="oc-muted">(không bắt buộc)</span><textarea rows={2} value={note} maxLength={500} disabled={locked} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: Gọi trước khi giao…" /></label>
        <div className="oc-info"><Icon name="truck" /><div><strong>Giao hàng tiêu chuẩn</strong><span>Phí giao hàng được tính trong thông tin thanh toán.</span></div></div>
      </section><section className="oc-card oc-form-section"><h2><span className="oc-section-icon"><Icon name="card" /></span>Phương thức thanh toán</h2><fieldset className="oc-payment-options" disabled={locked}><legend className="oc-sr-only">Chọn phương thức thanh toán</legend>{[['COD', 'Thanh toán khi nhận hàng', 'Thanh toán khi nhận sản phẩm.'], ['VNPAY', 'VNPay', 'Thanh toán trực tuyến qua VNPay.']].map(([value, title, text]) => <label key={value} className={`oc-payment-option ${method === value ? 'is-selected' : ''}`}><input type="radio" name="payment" checked={method === value} onChange={() => setMethod(value)} /><Icon name={value === 'COD' ? 'box' : 'card'} /><span><strong>{title}</strong><small>{text}</small></span></label>)}</fieldset></section></div>
      <aside className="oc-card oc-summary"><h2>Đơn hàng của bạn <span>{cart.items.length} sản phẩm</span></h2><ProductLines items={quote.data?.items ?? cart.items} />
        <div className="oc-voucher"><label htmlFor="voucher">Mã ưu đãi</label><div><input id="voucher" value={voucher} disabled={locked} maxLength={50} onChange={event => setVoucher(event.target.value)} placeholder="Nhập mã ưu đãi" /><button className="oc-button oc-button--outline" type="button" disabled={locked} onClick={() => setAppliedVoucher(voucher.trim().toUpperCase() || null)}>Áp dụng</button></div><small>Mỗi đơn hàng áp dụng một mã ưu đãi.</small></div>
        {quote.loading || quote.error ? <OrderApiState {...quote} retry={quote.reload} /> : quote.data && <Totals {...quote.data.totals} />}
        {action.error && <p className="oc-error" role="alert">{action.error.message}</p>}
        {action.uncertain && <p className="oc-muted">Kết quả yêu cầu trước chưa được xác nhận. Thử lại cùng yêu cầu để tránh tạo đơn trùng.</p>}
        <button className="oc-button oc-button--full" type="submit" disabled={action.busy || quote.loading || !!quote.error || !quote.data}>{action.busy ? 'Đang gửi…' : action.uncertain ? 'Thử lại đặt hàng' : 'Đặt hàng'}<Icon name="arrow" size={17} /></button>
        {action.error?.status === 409 && !action.uncertain && <button type="button" className="oc-text-action" onClick={() => { context.reload(); quote.reload(); }}>Tải lại giỏ và thông tin thanh toán</button>}
        <Link className="oc-back-link" to="/orders">← Quay lại đơn hàng</Link>
      </aside>
    </form>}
  </main>;
}
