import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon, ProductLines, StatusBadge, Totals } from '../../components/order/OrderParts.jsx';
import { money, orderTotal, paymentLabel } from '../../services/order-ui-data.js';

const filters = [['all', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['processing', 'Đang chuẩn bị'], ['shipping', 'Đang giao'], ['delivered', 'Đã giao'], ['cancelled', 'Đã hủy']];
const canCancel = status => ['pending', 'confirmed', 'preparing'].includes(status);

// Hiển thị snapshot đơn hàng, trạng thái thanh toán và lịch sử xử lý.
export function OrderDetailContent({ order }) {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <><div className="oc-detail-grid">
    <section className="oc-card oc-form-section"><h2><Icon name="pin" />Địa chỉ nhận hàng</h2><strong>{order.customer.name}</strong><p>{order.customer.phone}</p><p>{order.customer.address}</p>{order.note && <p className="oc-muted">Ghi chú: {order.note}</p>}</section>
    <section className="oc-card oc-form-section"><h2><Icon name="card" />Thanh toán</h2><strong>{order.method}</strong><p><span className={`oc-payment-state ${order.payment === 'paid' ? 'is-paid' : ''}`}>{paymentLabel(order.payment)}</span></p><small className="oc-muted">Trạng thái thanh toán độc lập với trạng thái đơn.</small></section>
  </div><section className="oc-card oc-form-section"><h2><Icon name="box" />Sản phẩm trong đơn</h2><ProductLines items={order.items} /><Totals subtotal={subtotal} discount={order.discount} shipping={order.shipping} /></section>
  <section className="oc-card oc-form-section"><h2><Icon name="clock" />Hành trình đơn hàng</h2><ol className="oc-timeline">{order.history.map((entry, index) => <li key={`${entry.status}-${index}`}><span className={`oc-timeline-dot ${entry.status === 'cancelled' ? 'is-cancelled' : ''}`}><Icon name="check" size={13} /></span><div><StatusBadge status={entry.status} /><p>{entry.date} · {entry.actor}</p>{entry.reason && <small>Lý do: {entry.reason}</small>}</div></li>)}</ol></section></>;
}

export default function OrderHistory({ orders, setOrders, setCart, detail = false }) {
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tabDirection, setTabDirection] = useState('forward');
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabListRef = useRef(null);
  const tabRefs = useRef({});
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selected = orders.find(order => String(order.id) === orderId);

  useLayoutEffect(() => {
    const activeTab = tabRefs.current[filter];
    if (!activeTab) return undefined;

    const updateIndicator = () => {
      setIndicator({ left: activeTab.offsetLeft, width: activeTab.offsetWidth });
    };
    updateIndicator();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateIndicator);
    observer?.observe(tabListRef.current);
    observer?.observe(activeTab);
    window.addEventListener('resize', updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [filter]);

  function selectFilter(nextFilter) {
    if (nextFilter === filter) return;
    setTabDirection(filters.findIndex(([value]) => value === nextFilter) > filters.findIndex(([value]) => value === filter) ? 'forward' : 'backward');
    setFilter(nextFilter);
  }

  function handleTabKey(event) {
    const currentIndex = filters.findIndex(([value]) => value === filter);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % filters.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + filters.length) % filters.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = filters.length - 1;
    else return;
    event.preventDefault();
    const nextFilter = filters[nextIndex][0];
    selectFilter(nextFilter);
    tabRefs.current[nextFilter]?.focus();
  }

  function buyAgain(order) {
    setCart(order.items.map(item => ({ ...item })));
    navigate('/checkout');
  }

  function cancelOrder(event) {
    event.preventDefault();
    if (!reason.trim() || !selected || !canCancel(selected.status) || busy) return;
    setOrders(current => current.map(order => order.id === selected.id ? { ...order, status: 'cancelled', history: [...order.history, { status: 'cancelled', date: new Date().toLocaleString('vi-VN'), actor: 'Khách hàng', reason: reason.trim() }] } : order));
    setCancelling(false);
    setNotice('Yêu cầu hủy đơn đã được ghi nhận.');
  }

  if (detail) return <main className="oc-main"><Link className="oc-back-link" to="/orders">← Tất cả đơn hàng</Link>
    {!selected ? <div className="oc-empty"><Icon name="box" size={40} /><h1>Không tìm thấy đơn hàng</h1><p>Đơn hàng không tồn tại.</p><Link className="oc-button" to="/orders">Xem đơn hàng</Link></div> : <>
      <div className="oc-title-row"><div><span className="oc-eyebrow">CHI TIẾT ĐƠN HÀNG</span><h1>#{selected.id}</h1><p>Đặt ngày {selected.date}</p></div><StatusBadge status={selected.status} /></div>
      {location.state?.created && <div className="oc-notice" role="status">Đặt hàng thành công.</div>}
      {notice && <div className="oc-notice" role="status">{notice}</div>}
      <div className="oc-stack"><OrderDetailContent order={selected} /><div className="oc-detail-actions">
        {canCancel(selected.status) && <button className="oc-button oc-button--danger" onClick={() => setCancelling(!cancelling)}>Yêu cầu hủy đơn</button>}
        {['delivered', 'completed', 'cancelled'].includes(selected.status) && <button className="oc-button oc-button--outline" disabled={busy} onClick={() => buyAgain(selected)}>Mua lại</button>}
      </div>
      {cancelling && <form className="oc-card oc-form-section" onSubmit={cancelOrder}><h2>Lý do hủy đơn</h2><label className="oc-field">Vui lòng cho biết lý do<textarea value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} /></label><div className="oc-detail-actions"><button type="button" className="oc-button oc-button--outline" onClick={() => setCancelling(false)}>Giữ đơn hàng</button><button className="oc-button oc-button--danger" disabled={!reason.trim() || busy}>{busy ? 'Đang gửi…' : 'Xác nhận hủy'}</button></div></form>}</div>
    </>}
  </main>;

  const visible = orders.filter(order => filter === 'all' || (filter === 'processing' ? ['confirmed', 'preparing'].includes(order.status) : filter === 'delivered' ? ['delivered', 'completed'].includes(order.status) : order.status === filter));
  return <main className="oc-main"><div className="oc-title-row"><div><span className="oc-eyebrow">TỔ ẤM, THÊM TIỆN NGHI</span><h1>Đơn hàng của tôi</h1><p>Theo dõi từng bước, an tâm chờ nhận hàng.</p></div><Link className="oc-button oc-button--outline" to="/checkout"><Icon name="bag" size={17} />Thanh toán</Link></div>
    <div className="oc-filter-tabs" ref={tabListRef} role="tablist" aria-label="Lọc đơn theo trạng thái" onKeyDown={handleTabKey}>{filters.map(([value, label]) => <button id={`orders-filter-${value}`} key={value} ref={element => { tabRefs.current[value] = element; }} type="button" role="tab" tabIndex={filter === value ? 0 : -1} aria-selected={filter === value} aria-controls="orders-panel" className={filter === value ? 'is-selected' : ''} onClick={() => selectFilter(value)}>{label}</button>)}<span className="oc-filter-indicator" aria-hidden="true" style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }} /></div>
    <div id="orders-panel" key={filter} className={`oc-order-list oc-order-list--${tabDirection}`} role="tabpanel" aria-labelledby={`orders-filter-${filter}`}>{visible.length ? visible.map(order => <article className="oc-card oc-order-card" key={order.id}>
      <Link to={`/orders/${order.id}`} className="oc-order-header"><span className="oc-section-icon"><Icon name="box" size={18} /></span><span className="oc-order-meta"><strong>#{order.id}</strong><small>Đặt ngày {order.date}</small></span><StatusBadge status={order.status} /><Icon name="arrow" size={16} /></Link>
      <ProductLines items={order.items} /><div className="oc-order-footer"><div><span className="oc-total-line"><span>Tổng cộng</span><strong>{money(orderTotal(order))}</strong></span><small>{order.method} · {paymentLabel(order.payment)}</small></div><div className="oc-order-buttons">{['completed', 'delivered', 'cancelled'].includes(order.status) && <button className="oc-button oc-button--outline" disabled={busy} onClick={() => buyAgain(order)}>Mua lại</button>}<Link className={order.status === 'shipping' ? 'oc-button' : 'oc-text-action'} to={`/orders/${order.id}`}>{order.status === 'shipping' ? 'Theo dõi đơn hàng' : 'Xem chi tiết'}</Link></div></div>
    </article>) : <div className="oc-empty"><Icon name="box" size={42} /><h2>{orders.length ? 'Chưa có đơn hàng ở trạng thái này' : 'Bạn chưa có đơn hàng'}</h2><p>Đơn hàng của bạn sẽ xuất hiện tại đây sau khi đặt thành công.</p>{orders.length > 0 && <button className="oc-button oc-button--outline" onClick={() => selectFilter('all')}>Xem tất cả đơn hàng</button>}</div>}</div>
  </main>;
}
