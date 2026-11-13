import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LowStockCard, useLowStock } from '../../components/admin/LowStockAlert.jsx';
import { Card, ChartPending, DataTable, KpiCard, PageHead } from '../../components/admin/ui.jsx';
import { useAuth } from '../../context/auth-context.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { createReturnRefundService } from '../../services/return-refund-service.js';
import { listMovements } from '../../services/catalog-service.js';

// created_at lưu UTC (không kèm múi giờ); hiển thị theo giờ máy.
const formatTime = value => new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const movementBadges = { import: ['Nhập kho', 'in'], export: ['Xuất kho', 'mute'] };
const movementColumns = [
  { key: 'time', label: 'Thời gian', width: '130px', render: item => <span className="ad-muted">{formatTime(item.created_at)}</span> },
  { key: 'product', label: 'Sản phẩm', width: 'minmax(0, 2fr)', render: item => <div><b className="ad-strong">{item.sku}</b><span className="ad-sub">{item.variant_name}</span></div> },
  { key: 'type', label: 'Loại', width: '110px', render: item => { const [label, tone] = movementBadges[item.movement_type] || [item.movement_type, 'mute']; return <span className={`hc-badge hc-badge--${tone}`}>{label}</span>; } },
  { key: 'change', label: 'Số lượng', width: '90px', render: item => { const change = Number(item.quantity_change); return <span className={change > 0 ? 'ad-plus' : 'ad-minus'}>{change > 0 ? `+${change}` : change}</span>; } },
  { key: 'actor', label: 'Người thực hiện', width: 'minmax(0, 1fr)', render: item => item.performed_by_name || 'Hệ thống' },
];

// Năm dòng nhập/xuất mới nhất lấy từ nhật ký kho thật.
function RecentMovements() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setItems(null); setError('');
    listMovements({ page: 1, pageSize: 5 }).then(data => { if (active) setItems(data.items); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [attempt]);
  return <section className="hc-card ad-card" aria-labelledby="recent-moves-title">
    <div className="ad-card-head ad-pad"><h2 id="recent-moves-title">Hoạt động kho gần đây</h2><Link className="ad-link" to="/warehouse/history">Xem nhật ký kho</Link></div>
    {error && <p className="hc-error ad-pad" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></p>}
    {!items && !error && <p className="hc-muted ad-pad" role="status">Đang tải hoạt động kho…</p>}
    {items?.length === 0 && <p className="hc-muted ad-pad">Chưa có phiếu nhập xuất nào.</p>}
    {items?.length > 0 && <DataTable bare label="Hoạt động kho gần đây" cols={movementColumns} rows={items} rowKey={item => item.id} />}
  </section>;
}

// Hai chỉ số của SALES lấy từ tổng số bản ghi của API danh sách (pageSize=1 để chỉ tải một dòng).
function SalesKpis() {
  const orders = useOrderService();
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCounts(null); setError('');
    Promise.all([
      orders.listSalesOrders({ status: 'pending', pageSize: 1, signal: controller.signal }),
      createReturnRefundService().list({ status: 'requested', pageSize: 1, signal: controller.signal }),
    ]).then(([newOrders, returns]) => setCounts({ orders: newOrders.pagination.totalItems, returns: returns.pagination.totalItems }))
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Không tải được số liệu.'); });
    return () => controller.abort();
  }, [orders, attempt]);
  return <>
    <KpiCard label="Đơn hàng mới" value={counts?.orders}>{counts?.orders > 0 && <Link className="ad-link" to="/sales/orders">Xử lý ngay</Link>}</KpiCard>
    <KpiCard label="Yêu cầu trả hàng chờ phân loại" value={counts?.returns}>{counts?.returns > 0 && <Link className="ad-link" to="/sales/returns">Phân loại</Link>}</KpiCard>
    {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></p>}
  </>;
}

// Biểu đồ cột ngang một màu: mỗi nhóm có nhãn và số ngay trên cột nên không phụ thuộc vào màu.
// "Yêu cầu hoàn tiền" = yêu cầu trả hàng chưa xong (chờ phân loại, chờ quản lý duyệt, đã duyệt chờ nhận hàng); từ chối không tính.
function SalesOrderChart() {
  const orders = useOrderService();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const returns = createReturnRefundService();
    const total = result => result.pagination.totalItems;
    setData(null); setError('');
    Promise.all([
      orders.listSalesOrders({ status: 'completed', pageSize: 1, signal }),
      orders.listSalesOrders({ status: 'pending', pageSize: 1, signal }),
      ...['requested', 'pending_manager', 'approved', 'refunded'].map(status => returns.list({ status, pageSize: 1, signal })),
    ]).then(([completed, pending, requested, manager, approved, refunded]) => setData([
      ['Đã hoàn thành', total(completed), 'done'],
      ['Chờ xác nhận', total(pending), 'pending'],
      ['Yêu cầu hoàn tiền', total(requested) + total(manager) + total(approved), 'requested'],
      ['Đã hoàn tiền', total(refunded), 'refunded'],
    ])).catch(err => { if (!signal.aborted) setError(err.message || 'Không tải được số liệu.'); });
    return () => controller.abort();
  }, [orders, attempt]);
  const max = Math.max(1, ...(data ?? []).map(([, value]) => value));
  return <Card title="Đơn hàng theo nhóm xử lý" subtitle="Hoàn thành, chờ xác nhận, yêu cầu hoàn tiền, đã hoàn tiền">
    {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></p>}
    {!data && !error && <p className="hc-muted" role="status">Đang tải biểu đồ…</p>}
    {data && <ul className="ad-hbars" aria-label="Số đơn theo nhóm xử lý">
      {data.map(([label, value, tone]) => <li key={label}>
        <span className="ad-hbar-label">{label}</span>
        <span className="ad-hbar-track"><span className={`ad-hbar-fill ad-hbar-fill--${tone}`} style={{ width: `${(value / max) * 100}%` }} /></span>
        <b className="ad-hbar-value">{value}</b>
      </li>)}
    </ul>}
  </Card>;
}

// Tổng quan ADMIN/WAREHOUSE/SALES theo template: chỉ số, biểu đồ, cảnh báo tồn kho, hoạt động kho. Số liệu đơn hàng/doanh thu/voucher chưa có API nên giữ "—".
export default function StaffOverviewPage() {
  const { user } = useAuth();
  const lowStock = useLowStock();
  const admin = user.role === 'ADMIN';
  const sales = user.role === 'SALES';
  const { summary } = lowStock;
  useEffect(() => { document.title = 'Tổng quan · HomeCare'; }, []);
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const low = summary ? summary.total - summary.outOfStock : null;
  const stockKpi = <KpiCard label={admin ? 'Sản phẩm sắp hết hàng' : 'SKU sắp hết hàng'} value={low}>{summary && (low > 0 ? <span className="hc-badge hc-badge--warn">Cần nhập thêm</span> : null)}</KpiCard>;
  const outKpi = <KpiCard label="SKU hết hàng" value={summary?.outOfStock}>{summary?.outOfStock > 0 && <span className="hc-badge hc-badge--out">Cần xử lý ngay</span>}</KpiCard>;

  return <section>
    <PageHead title="Tổng quan" subtitle={`Tình hình cửa hàng hôm nay, ${today}`}>
      {admin && <><button className="hc-button hc-button--outline" type="button" disabled title="Chưa triển khai">7 ngày qua</button><Link className="hc-button" to="/admin/reports">Xem báo cáo</Link></>}
      {sales && <Link className="hc-button" to="/sales/orders">Xử lý đơn hàng</Link>}
      {!admin && !sales && <><Link className="hc-button hc-button--outline" to="/warehouse/inventory?form=stock-out">Xuất kho</Link><Link className="hc-button" to="/warehouse/inventory?form=stock-in">Nhập kho</Link></>}
    </PageHead>
    <div className="ad-kpis" aria-label="Chỉ số chính">
      {admin && <><KpiCard label="Doanh thu hôm nay" pending /><KpiCard label="Đơn hàng mới" pending />{stockKpi}<KpiCard label="Voucher đang chạy" pending /></>}
      {sales && <SalesKpis />}
      {!admin && !sales && <>{stockKpi}{outKpi}</>}
    </div>
    {admin && <div className="ad-cols">
      <div className="ad-grow2"><Card title="Doanh thu 7 ngày gần nhất" subtitle="So sánh với 7 ngày trước đó"><ChartPending height={230} /></Card></div>
      <LowStockCard state={lowStock} />
    </div>}
    {admin && <div className="ad-cols">
      <Card title="Đơn hàng theo giờ hôm nay" subtitle="Số đơn mới theo từng giờ"><ChartPending /></Card>
      <Card title="Trạng thái đơn hàng" subtitle="Hoàn tất, đang giao, chờ xác nhận, đã hủy"><ChartPending /></Card>
      <Card title="Doanh thu theo danh mục" subtitle="Tủ lạnh, máy giặt, máy lạnh"><ChartPending /></Card>
    </div>}
    {user.role === 'WAREHOUSE' && <LowStockCard state={lowStock} />}
    {sales && <SalesOrderChart />}
    {!sales && <RecentMovements />}
  </section>;
}
