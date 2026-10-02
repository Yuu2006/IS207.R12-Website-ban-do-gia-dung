import { useState } from 'react';
import { Icon, StatusBadge } from '../../components/order/OrderParts.jsx';
import { money, nextStatus, orderTotal, paymentLabel, statusLabels } from '../../services/order-ui-data.js';
import { OrderDetailContent } from '../customer/OrderHistory.jsx';

// Tổ chức luồng tra cứu và xử lý trạng thái đơn hàng trên giao diện.
export default function SalesOrders({ orders, setOrders }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState('');
  const [collected, setCollected] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = orders.find(order => String(order.id) === String(selectedId));
  const visible = orders.filter(order => (filter === 'all' || order.status === filter) && `${order.id} ${order.customer.name} ${order.customer.phone}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));

  function update(status) {
    if (!selected || busy || (status === 'cancelled' && !reason.trim()) || (selected.method === 'COD' && status === 'completed' && !collected)) return;
    setBusy(true);
    setOrders(current => current.map(order => order.id === selected.id ? { ...order, status, payment: order.method === 'COD' && status === 'completed' ? 'paid' : order.payment, history: [...order.history, { status, date: new Date().toLocaleString('vi-VN'), actor: 'Nhân viên bán hàng', reason: status === 'cancelled' ? reason.trim() : '' }] } : order));
    setNotice('Trạng thái đơn hàng đã được cập nhật.');
    setBusy(false);
  }

  const next = selected && nextStatus[selected.status];
  return <main className="oc-main oc-main--staff"><div className="oc-title-row"><div><span className="oc-eyebrow">KHÔNG GIAN NHÂN VIÊN</span><h1>Xử lý đơn hàng</h1><p>Tra cứu, xác nhận và theo dõi hành trình giao hàng.</p></div><span className="oc-staff-label"><Icon name="user" size={17} />Nhân viên bán hàng</span></div>
    <div className="oc-stats">{[['Đơn chờ xác nhận', orders.filter(order => order.status === 'pending').length, 'clock'], ['Đang giao hàng', orders.filter(order => order.status === 'shipping').length, 'truck'], ['Đã hoàn thành', orders.filter(order => order.status === 'completed').length, 'check']].map(([label, count, icon]) => <div className="oc-card oc-stat" key={label}><span className="oc-section-icon"><Icon name={icon} /></span><div><span>{label}</span><strong>{count.toString().padStart(2, '0')}</strong></div></div>)}</div>
    <div className="oc-staff-grid"><section className="oc-card oc-staff-list">
      <div className="oc-toolbar"><label className="oc-search"><Icon name="search" size={18} /><input aria-label="Tìm mã đơn, tên hoặc số điện thoại" placeholder="Tìm mã đơn, tên, số điện thoại…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Lọc trạng thái đơn" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div key={filter} className="oc-table-scroll oc-table-scroll--filtered"><table className="oc-order-table"><caption className="oc-sr-only">Danh sách đơn hàng</caption><thead><tr><th>Đơn hàng / khách hàng</th><th>Trạng thái</th><th>Tổng tiền</th><th><span className="oc-sr-only">Thao tác</span></th></tr></thead><tbody>{visible.map(order => <tr key={order.id} className={String(selectedId) === String(order.id) ? 'is-selected' : ''}><td><strong>#{order.id}</strong><span>{order.customer.name}</span><small>{order.date} · {order.customer.phone}</small></td><td><StatusBadge status={order.status} /><small>{paymentLabel(order.payment)}</small></td><td><strong>{money(orderTotal(order))}</strong><small>{order.method}</small></td><td><button className="oc-button oc-button--outline" onClick={() => { setSelectedId(order.id); setNotice(''); setCollected(false); setReason(''); }}>Xử lý</button></td></tr>)}</tbody></table></div>
      {!visible.length && <div className="oc-empty"><Icon name="search" size={36} /><h2>{orders.length ? 'Không tìm thấy đơn hàng' : 'Chưa có đơn hàng cần xử lý'}</h2><p>{orders.length ? 'Thử đổi từ khóa hoặc trạng thái.' : 'Đơn hàng mới sẽ xuất hiện tại đây.'}</p></div>}<div className="oc-table-foot">{visible.length} đơn hàng</div>
    </section><aside key={selectedId ?? 'empty'} className="oc-staff-detail">{selected ? <><div className="oc-card oc-form-section"><span className="oc-eyebrow">ĐƠN ĐANG XỬ LÝ</span><h2>#{selected.id}</h2><StatusBadge status={selected.status} />{notice && <p className="oc-notice" role="status">{notice}</p>}{next && <div className="oc-staff-actions">{selected.method === 'COD' && next === 'completed' && <label className="oc-checkbox"><input type="checkbox" checked={collected} onChange={event => setCollected(event.target.checked)} />Đã xác nhận giao hàng và thu đủ tiền COD</label>}<button className="oc-button oc-button--full" disabled={busy || (selected.method === 'COD' && next === 'completed' && !collected)} onClick={() => update(next)}>{busy ? 'Đang cập nhật…' : `Chuyển sang: ${statusLabels[next]}`}</button></div>}{['pending', 'confirmed', 'preparing'].includes(selected.status) && <form className="oc-cancel-form" onSubmit={event => { event.preventDefault(); update('cancelled'); }}><label className="oc-field">Lý do hủy<textarea required value={reason} onChange={event => setReason(event.target.value)} maxLength={500} /></label><button className="oc-button oc-button--danger" disabled={!reason.trim() || busy}>Hủy đơn</button></form>}</div><div className="oc-stack"><OrderDetailContent order={selected} /></div></> : <div className="oc-card oc-empty"><Icon name="box" size={42} /><h2>Chọn một đơn hàng</h2><p>Thông tin nhận hàng, thanh toán và lịch sử xử lý sẽ xuất hiện tại đây.</p></div>}</aside></div>
  </main>;
}
