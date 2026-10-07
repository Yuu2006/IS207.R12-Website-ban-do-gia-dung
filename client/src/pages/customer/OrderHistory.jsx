import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon, ProductLines, StatusBadge, Totals } from '../../components/order/OrderParts.jsx';
import { money, orderTotal, paymentLabel } from '../../services/order-ui-data.js';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { canCancelOrder } from '../../utils/order-state.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import OrderApiState from '../../components/order/OrderApiState.jsx';
import { isUncertainApiError } from '../../services/api-client.js';

const filters = [['all', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['processing', 'Đang chuẩn bị'], ['shipping', 'Đang giao'], ['delivered', 'Đã giao'], ['cancelled', 'Đã hủy']];
const canCancel = canCancelOrder;

// Hiển thị snapshot đơn hàng, trạng thái thanh toán và lịch sử xử lý.
export function OrderDetailContent({ order }) {
  const subtotal = order.totals?.subtotal ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <><div className="oc-detail-grid">
    <section className="oc-card oc-form-section"><h2><Icon name="pin" />Địa chỉ nhận hàng</h2><strong>{order.customer.name}</strong><p>{order.customer.phone}</p><p>{order.customer.address}</p>{order.note && <p className="oc-muted">Ghi chú: {order.note}</p>}</section>
    <section className="oc-card oc-form-section"><h2><Icon name="card" />Thanh toán</h2><strong>{order.method}</strong><p><span className={`oc-payment-state ${order.payment === 'paid' ? 'is-paid' : ''}`}>{paymentLabel(order.payment)}</span></p><small className="oc-muted">Trạng thái thanh toán độc lập với trạng thái đơn.</small></section>
  </div><section className="oc-card oc-form-section"><h2><Icon name="box" />Sản phẩm trong đơn</h2><ProductLines items={order.items} /><Totals subtotal={subtotal} discount={order.discount} shipping={order.shipping} /></section>
  <section className="oc-card oc-form-section"><h2><Icon name="clock" />Hành trình đơn hàng</h2><ol className="oc-timeline">{order.history.map((entry, index) => <li key={`${entry.status}-${index}`}><span className={`oc-timeline-dot ${entry.status === 'cancelled' ? 'is-cancelled' : ''}`}><Icon name="check" size={13} /></span><div><StatusBadge status={entry.status} /><p>{entry.date} · {entry.actor}</p>{entry.reason && <small>Lý do: {entry.reason}</small>}</div></li>)}</ol></section></>;
}

export default function OrderHistory({ initialOrders, detail = false }) {
  const { user, refreshSession } = useCustomerAuth();
  const service = useOrderService();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const action = useOrderAction({ onUnauthorized: () => refreshSession().catch(() => {}) });
  const busy = action.busy;
  const [tabDirection, setTabDirection] = useState('forward');
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabListRef = useRef(null);
  const tabRefs = useRef({});
  const reorderAttempt = useRef(null);
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const apiStatus = filter === 'all' ? undefined : filter === 'processing' ? 'confirmed,preparing' : filter === 'delivered' ? 'delivered,completed' : filter;
  const resource = useOrderQuery(signal => detail ? service.getCustomerOrder(orderId, { signal }) : service.listCustomerOrders({ status: apiStatus, page, signal }),
    [service, user?.id, detail, orderId, apiStatus, page], { initialData: initialOrders === undefined ? null : detail ? initialOrders.find(order => String(order.id) === orderId) ?? null : { items: initialOrders, pagination: { page: 1, totalPages: 1, totalItems: initialOrders.length } } });
  const selected = detail ? resource.data : null;
  const customerOrders = detail ? [] : resource.data?.items ?? [];

  useLayoutEffect(() => {
    const activeTab = tabRefs.current[filter];
    if (!activeTab) return undefined;

    const updateIndicator = () => {
      setIndicator({ left: activeTab.offsetLeft, width: activeTab.offsetWidth });
    };
    updateIndicator();
    activeTab.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });

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
    setPage(1);
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

  async function buyAgain(order) {
    const result = await action.run(`reorder:${order.id}`, { id: order.id }, async options => {
      if (!reorderAttempt.current || reorderAttempt.current.id !== order.id) {
        const cart = await service.getCart();
        reorderAttempt.current = { id: order.id, expectedCartVersion: cart.cartVersion };
      }
      try { return await service.reorder(order.id, { expectedCartVersion: reorderAttempt.current.expectedCartVersion }, options); }
      catch (failure) { if (!isUncertainApiError(failure)) reorderAttempt.current = null; throw failure; }
    });
    if (result) { reorderAttempt.current = null; navigate('/checkout'); }
  }

  async function cancelOrder(event) {
    event.preventDefault();
    if (!selected || busy) return;
    const request = { expectedVersion: selected.version, reason: reason.trim() };
    const result = await action.run(`cancel:${selected.id}`, request, options => service.cancelOrder(selected.id, request, options));
    if (!result) return;
    resource.setData(result);
    setCancelling(false);
    setNotice('Yêu cầu hủy đơn đã được ghi nhận.');
  }

  if (detail) return <main className="oc-main"><Link className="oc-back-link" to="/orders">← Tất cả đơn hàng</Link>
    {resource.loading || (resource.error && resource.error.status !== 404) ? <OrderApiState {...resource} retry={resource.reload} /> : !selected ? <div className="oc-empty"><Icon name="box" size={40} /><h1>Không tìm thấy đơn hàng</h1><p>Đơn hàng không tồn tại hoặc không thuộc tài khoản của bạn.</p><Link className="oc-button" to="/orders">Xem đơn hàng</Link></div> : <>
      <div className="oc-title-row"><div><span className="oc-eyebrow">CHI TIẾT ĐƠN HÀNG</span><h1>#{selected.code || selected.id}</h1><p>Đặt ngày {selected.date}</p></div><StatusBadge status={selected.status} /></div>
      {location.state?.created && <div className="oc-notice" role="status">Đặt hàng thành công.</div>}
      {notice && <div className="oc-notice" role="status">{notice}</div>}
      {action.error && <div className="oc-error" role="alert">{action.error.message}{action.error.status === 409 && !action.uncertain && <button type="button" className="oc-text-action" onClick={resource.reload}>Tải lại đơn hàng</button>}</div>}
      <div className="oc-stack"><OrderDetailContent order={selected} /><div className="oc-detail-actions">
        {canCancel(selected.status) && <button className="oc-button oc-button--danger" disabled={busy || action.uncertain} onClick={() => setCancelling(!cancelling)}>Yêu cầu hủy đơn</button>}
        {['delivered', 'completed', 'cancelled'].includes(selected.status) && <button className="oc-button oc-button--outline" disabled={busy} onClick={() => buyAgain(selected)}>Mua lại</button>}
      </div>
      {cancelling && <form className="oc-card oc-form-section" onSubmit={cancelOrder}><h2>Lý do hủy đơn</h2><label className="oc-field">Vui lòng cho biết lý do<textarea value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} disabled={busy || action.uncertain} /></label><div className="oc-detail-actions"><button type="button" className="oc-button oc-button--outline" disabled={busy || action.uncertain} onClick={() => setCancelling(false)}>Giữ đơn hàng</button><button className="oc-button oc-button--danger" disabled={!reason.trim() || busy}>{busy ? 'Đang gửi…' : action.uncertain ? 'Thử lại yêu cầu hủy' : 'Xác nhận hủy'}</button></div></form>}</div>
    </>}
  </main>;

  const visible = customerOrders.filter(order => filter === 'all' || (filter === 'processing' ? ['confirmed', 'preparing'].includes(order.status) : filter === 'delivered' ? ['delivered', 'completed'].includes(order.status) : order.status === filter));
  return <main className="oc-main"><nav className="oc-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Đơn hàng</span></nav><div className="oc-title-row"><div><h1>Đơn hàng của tôi</h1><p>Theo dõi trạng thái và thông tin các đơn hàng của bạn.</p></div></div>
    <div className="oc-filter-tabs" ref={tabListRef} role="tablist" aria-label="Lọc đơn theo trạng thái" onKeyDown={handleTabKey}>{filters.map(([value, label]) => <button id={`orders-filter-${value}`} key={value} ref={element => { tabRefs.current[value] = element; }} type="button" role="tab" tabIndex={filter === value ? 0 : -1} aria-selected={filter === value} aria-controls="orders-panel" className={filter === value ? 'is-selected' : ''} onClick={() => selectFilter(value)}>{label}</button>)}<span className="oc-filter-indicator" aria-hidden="true" style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }} /></div>
    {action.error && <p className="oc-error" role="alert">{action.error.message}</p>}
    <div id="orders-panel" key={filter} className={`oc-order-list oc-order-list--${tabDirection}`} role="tabpanel" aria-labelledby={`orders-filter-${filter}`}>{resource.loading || resource.error ? <OrderApiState {...resource} retry={resource.reload} /> : visible.length ? visible.map(order => <article className="oc-card oc-order-card" key={order.id}>
      <Link to={`/orders/${order.id}`} className="oc-order-header"><span className="oc-section-icon"><Icon name="box" size={18} /></span><span className="oc-order-meta"><strong>#{order.code || order.id}</strong><small>Đặt ngày {order.date}</small></span><StatusBadge status={order.status} /><Icon name="arrow" size={16} /></Link>
      <ProductLines items={order.items} /><div className="oc-order-footer"><div><span className="oc-total-line"><span>Tổng cộng</span><strong>{money(orderTotal(order))}</strong></span><small>{order.method} · {paymentLabel(order.payment)}</small></div><div className="oc-order-buttons">{['completed', 'delivered', 'cancelled'].includes(order.status) && <button className="oc-button oc-button--outline" disabled={busy} onClick={() => buyAgain(order)}>Mua lại</button>}<Link className={order.status === 'shipping' ? 'oc-button' : 'oc-text-action'} to={`/orders/${order.id}`} aria-label={`${order.status === 'shipping' ? 'Theo dõi' : 'Xem chi tiết'} đơn hàng ${order.id}`}>{order.status === 'shipping' ? 'Theo dõi đơn hàng' : 'Xem chi tiết'}</Link></div></div>
    </article>) : <div className="oc-card oc-empty"><Icon name="box" size={42} /><h2>{filter !== 'all' ? 'Chưa có đơn hàng ở trạng thái này' : 'Bạn chưa có đơn hàng'}</h2><p>Đơn hàng của bạn sẽ xuất hiện tại đây sau khi đặt thành công.</p>{filter !== 'all' ? <button className="oc-button oc-button--outline" onClick={() => selectFilter('all')}>Xem tất cả đơn hàng</button> : <Link className="oc-button" to="/products">Khám phá sản phẩm</Link>}</div>}</div>
    {!resource.loading && !resource.error && resource.data?.pagination.totalPages > 1 && <nav className="oc-detail-actions" aria-label="Phân trang đơn hàng"><button className="oc-button oc-button--outline" disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Trang trước</button><span>Trang {page} / {resource.data.pagination.totalPages}</span><button className="oc-button oc-button--outline" disabled={page >= resource.data.pagination.totalPages || busy} onClick={() => setPage(value => value + 1)}>Trang sau</button></nav>}
  </main>;
}
