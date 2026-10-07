import { useEffect, useState } from 'react';
import { Icon, StatusBadge } from '../../components/order/OrderParts.jsx';
import { money, nextStatus, orderTotal, paymentLabel, statusLabels } from '../../services/order-ui-data.js';
import { OrderDetailContent } from '../customer/OrderHistory.jsx';
import { canCancelOrder } from '../../utils/order-state.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import OrderApiState from '../../components/order/OrderApiState.jsx';

// Tổ chức luồng tra cứu và xử lý trạng thái đơn hàng trên giao diện.
export default function SalesOrders({ initialOrders }) {
  const service = useOrderService();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState('');
  const [collected, setCollected] = useState(false);
  const [notice, setNotice] = useState('');
  const action = useOrderAction();
  const busy = action.busy;
  useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [query]);
  const resource = useOrderQuery(signal => service.listSalesOrders({ status: filter === 'all' ? undefined : filter, search, page, signal }), [service, filter, search, page],
    { initialData: initialOrders ? { items: initialOrders, pagination: { page: 1, totalPages: 1, totalItems: initialOrders.length } } : null });
  const detail = useOrderQuery(signal => service.getSalesOrder(selectedId, { signal }), [service, selectedId], { enabled: selectedId !== null });
  const selected = detail.data;
  const orders = resource.data?.items ?? [];
  const visible = orders;

  async function update(status) {
    if (!selected || busy) return;
    const request = { toStatus: status, expectedVersion: selected.version,
      ...(status === 'cancelled' ? { reason } : {}),
      ...(selected.method === 'COD' && status === 'delivered' ? { codCollected: collected } : {}),
    };
    const result = await action.run(`status:${selected.id}`, request, options => service.updateSalesStatus(selected.id, request, options));
    if (!result) return;
    detail.setData(result);
    resource.reload();
    setNotice('Trạng thái đơn hàng đã được cập nhật.');
  }

  const next = selected && nextStatus[selected.status];
  const nextAllowed = next && (selected.method.toUpperCase() === 'VNPAY' ? selected.payment === 'paid' : next === 'delivered' ? collected && selected.payment === 'unpaid' : selected.status === 'delivered' ? selected.payment === 'paid' : selected.payment === 'unpaid');
  return <main className="oc-main oc-main--staff"><div className="oc-title-row"><div><span className="oc-eyebrow">KHÔNG GIAN NHÂN VIÊN</span><h1>Xử lý đơn hàng</h1><p>Tra cứu, xác nhận và theo dõi hành trình giao hàng.</p></div><span className="oc-staff-label"><Icon name="user" size={17} />Nhân viên bán hàng</span></div>
    <p className="oc-muted">Kết quả tra cứu được lọc và phân trang theo trạng thái đơn.</p>
    <div className="oc-staff-grid"><section className="oc-card oc-staff-list">
      <div className="oc-toolbar"><label className="oc-search"><Icon name="search" size={18} /><input aria-label="Tìm mã đơn, tên hoặc số điện thoại" placeholder="Tìm mã đơn, tên, số điện thoại…" value={query} maxLength={100} disabled={busy || action.uncertain} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Lọc trạng thái đơn" value={filter} disabled={busy || action.uncertain} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <OrderApiState {...resource} retry={resource.reload} />
      <div key={filter} className="oc-table-scroll oc-table-scroll--filtered"><table className="oc-order-table"><caption className="oc-sr-only">Danh sách đơn hàng</caption><thead><tr><th>Đơn hàng / khách hàng</th><th>Trạng thái</th><th>Tổng tiền</th><th><span className="oc-sr-only">Thao tác</span></th></tr></thead><tbody>{visible.map(order => <tr key={order.id} className={String(selectedId) === String(order.id) ? 'is-selected' : ''}><td><strong>#{order.code || order.id}</strong><span>{order.customer.name}</span><small>{order.date} · {order.customer.phone}</small></td><td><StatusBadge status={order.status} /><small>{paymentLabel(order.payment)}</small></td><td><strong>{money(orderTotal(order))}</strong><small>{order.method}</small></td><td><button className="oc-button oc-button--outline" disabled={busy || action.uncertain} onClick={() => { setSelectedId(order.id); setNotice(''); setCollected(false); setReason(''); }}>Xử lý</button></td></tr>)}</tbody></table></div>
      {!resource.loading && !resource.error && !visible.length && <div className="oc-empty"><Icon name="search" size={36} /><h2>{search || filter !== 'all' ? 'Không tìm thấy đơn hàng' : 'Chưa có đơn hàng cần xử lý'}</h2><p>Thử đổi từ khóa hoặc trạng thái.</p></div>}<div className="oc-table-foot">{resource.data?.pagination.totalItems ?? 0} đơn hàng</div>
      {resource.data?.pagination.totalPages > 1 && <nav className="oc-detail-actions" aria-label="Phân trang đơn nhân viên"><button className="oc-button oc-button--outline" disabled={page <= 1 || busy || action.uncertain} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page} / {resource.data.pagination.totalPages}</span><button className="oc-button oc-button--outline" disabled={page >= resource.data.pagination.totalPages || busy || action.uncertain} onClick={() => setPage(value => value + 1)}>Sau</button></nav>}
    </section><aside key={selectedId ?? 'empty'} className="oc-staff-detail">{detail.loading || detail.error ? <OrderApiState {...detail} retry={detail.reload} /> : selected ? <><div className="oc-card oc-form-section">
      <span className="oc-eyebrow">ĐƠN ĐANG XỬ LÝ</span><h2>#{selected.code || selected.id}</h2><StatusBadge status={selected.status} />
      {notice && <p className="oc-notice" role="status">{notice}</p>}
      {action.error && <p className="oc-error" role="alert">{action.error.message}{action.error.status === 409 && !action.uncertain && <button className="oc-text-action" onClick={detail.reload}>Tải lại đơn</button>}</p>}
      {next && <div className="oc-staff-actions">
        {selected.method === 'COD' && next === 'delivered' && <label className="oc-checkbox"><input type="checkbox" checked={collected} disabled={busy || action.uncertain} onChange={event => setCollected(event.target.checked)} />Đã xác nhận giao hàng và thu đủ tiền COD</label>}
        <button className="oc-button oc-button--full" disabled={busy || !nextAllowed} onClick={() => update(next)}>{busy ? 'Đang cập nhật…' : `Chuyển sang: ${statusLabels[next]}`}</button>
        {!nextAllowed && <p className="oc-muted">Chưa đủ điều kiện thanh toán hoặc xác nhận thu tiền COD.</p>}
      </div>}
      {canCancelOrder(selected.status) && <form className="oc-cancel-form" onSubmit={event => { event.preventDefault(); update('cancelled'); }}><label className="oc-field">Lý do hủy<textarea required value={reason} disabled={busy || action.uncertain} onChange={event => setReason(event.target.value)} maxLength={500} /></label><button className="oc-button oc-button--danger" disabled={!reason.trim() || busy}>Hủy đơn</button></form>}
    </div><div className="oc-stack"><OrderDetailContent order={selected} /></div></> : <div className="oc-card oc-empty"><Icon name="box" size={42} /><h2>Chọn một đơn hàng</h2><p>Thông tin nhận hàng, thanh toán và lịch sử xử lý sẽ xuất hiện tại đây.</p></div>}</aside></div>
  </main>;
}
