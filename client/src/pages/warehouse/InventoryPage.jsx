import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StockSheetDialog from '../../components/admin/StockSheetDialog.jsx';
import { Chips, DataTable, EmptyCard, KpiCard, PageHead, SearchBox } from '../../components/admin/ui.jsx';
import { listInventory } from '../../services/catalog-service.js';

const statusBadges = { in_stock: ['Còn hàng', 'in'], low_stock: ['Sắp hết', 'warn'], out_of_stock: ['Hết hàng', 'out'] };
const meterTone = { in_stock: 'ok', low_stock: 'warn', out_of_stock: 'bad' };
const sheetKinds = [['in', 'Nhập'], ['out', 'Xuất'], ['adjust', 'Kiểm kê']];
const filterOptions = [['all', 'Tất cả'], ['low', 'Sắp hết'], ['out', 'Hết hàng']];
// Lối tắt từ trang tổng quan: /warehouse/inventory?form=stock-in|stock-out|stock-adjust.
const formKinds = { 'stock-in': 'in', 'stock-out': 'out', 'stock-adjust': 'adjust' };

// Thanh mức tồn: đầy khi tồn gấp đôi ngưỡng cảnh báo trở lên.
const meterWidth = item => { const threshold = Number(item.low_stock_threshold); return threshold > 0 ? Math.min(100, Math.round(item.stock_quantity / (threshold * 2) * 100)) : item.stock_quantity > 0 ? 100 : 0; };

// WH-01..04: xem tồn/ngưỡng theo SKU, lọc hàng sắp hết, lập phiếu nhập/xuất/kiểm kê kèm lý do (ADMIN, WAREHOUSE).
export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [version, setVersion] = useState(0);
  const [sheet, setSheet] = useState(() => formKinds[params.get('form')] ? { kind: formKinds[params.get('form')] } : null);
  const [notice, setNotice] = useState('');

  useEffect(() => { document.title = 'Tồn kho · HomeCare'; }, []);
  useEffect(() => { if (params.has('form')) setParams({}, { replace: true }); }, []);
  useEffect(() => {
    let active = true;
    setItems(null); setError('');
    listInventory().then(data => { if (active) setItems(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [version]);

  function openSheet(kind, sku) { setNotice(''); setSheet({ kind, sku }); }
  function closeSheet(written) {
    setSheet(null);
    if (written) { setNotice(`Đã ghi ${written} dòng vào kho. Xem Nhật ký kho để đối chiếu.`); setVersion(current => current + 1); }
  }

  const count = status => items?.filter(item => item.stock_status === status).length ?? 0;
  const text = keyword.trim().toLowerCase();
  const rows = items?.filter(item => (filter === 'all' || item.stock_status === (filter === 'out' ? 'out_of_stock' : 'low_stock'))
    && (!text || `${item.product_name} ${item.variant_name} ${item.sku}`.toLowerCase().includes(text)));
  const columns = [
    { key: 'name', label: 'Sản phẩm', width: 'minmax(0, 2fr)', render: item => <div><b className="ad-strong">{item.product_name} · {item.variant_name}</b><span className="ad-sub">{item.sku} · {item.category_name}</span></div> },
    { key: 'qty', label: 'Tồn', width: '70px', render: item => <span className="ad-strong">{item.stock_quantity}</span> },
    { key: 'meter', label: 'Mức tồn so với ngưỡng', width: '190px', render: item => <div className="ad-meter"><div className="ad-track"><div className={`ad-fill ad-fill--${meterTone[item.stock_status]}`} style={{ width: `${meterWidth(item)}%` }} /></div><span className="ad-sub">Ngưỡng cảnh báo: {item.low_stock_threshold}</span></div> },
    { key: 'status', label: 'Trạng thái', width: '110px', render: item => { const [label, tone] = statusBadges[item.stock_status]; return <span className={`hc-badge hc-badge--${tone}`}>{label}</span>; } },
    { key: 'actions', label: 'Thao tác', width: '240px', render: item => <div className="ad-acts">{sheetKinds.map(([kind, label]) => <button key={kind} className="hc-button hc-button--outline ad-sm" type="button" aria-label={`${label === 'Kiểm kê' ? label : `${label} kho`} ${item.sku}`} onClick={() => openSheet(kind, item.sku)}>{label}</button>)}</div> },
  ];

  return <section>
    <PageHead title="Tồn kho" subtitle="Theo dõi số lượng thực tế theo SKU và ngưỡng cảnh báo. Không cho phép tồn âm.">
      <button className="hc-button hc-button--outline" type="button" onClick={() => openSheet('adjust')}>Kiểm kê</button>
      <button className="hc-button hc-button--outline" type="button" onClick={() => openSheet('out')}>Xuất kho</button>
      <button className="hc-button" type="button" onClick={() => openSheet('in')}><Plus size={18} aria-hidden="true" />Nhập kho</button>
    </PageHead>
    {notice && <p className="hc-success" role="status">{notice}</p>}
    {error && <p className="hc-error" role="alert">{error} {!items && <button className="hc-text-button" type="button" onClick={() => setVersion(current => current + 1)}>Thử lại</button>}</p>}
    {sheet && <StockSheetDialog key={sheet.kind + (sheet.sku ?? '')} kind={sheet.kind} initialSku={sheet.sku} onClose={closeSheet} />}
    <div className="ad-kpis" aria-label="Tóm tắt tồn kho">
      <div className="hc-card ad-kpi"><small>Tổng số SKU</small><b>{items ? items.length : '—'}</b></div>
      <div className="hc-card ad-kpi"><small>Sắp hết hàng</small><b>{items ? count('low_stock') : '—'}</b><span className="hc-badge hc-badge--warn">Dưới ngưỡng cảnh báo</span></div>
      <div className="hc-card ad-kpi"><small>Hết hàng</small><b>{items ? count('out_of_stock') : '—'}</b><span className="hc-badge hc-badge--out">Cần xử lý ngay</span></div>
      <KpiCard label="Giá trị tồn kho" pending />
    </div>
    <div className="ad-filters" role="search"><SearchBox label="Tìm trong tồn kho" placeholder="Tìm theo tên hoặc mã SKU" value={keyword} onChange={setKeyword} /><Chips label="Lọc theo mức tồn" options={filterOptions} value={filter} onChange={setFilter} /></div>
    {!items ? !error && <p role="status" className="hc-muted">Đang tải tồn kho…</p> : rows.length === 0 ? <EmptyCard>{items.length === 0 ? 'Chưa có SKU.' : 'Không có SKU phù hợp.'}</EmptyCard>
      : <div><DataTable label="Tồn kho theo SKU" cols={columns} rows={rows} rowKey={item => item.variant_id} /><p className="ad-foot">Hiển thị {rows.length} trên {items.length} SKU · <Link to="/warehouse/history">Xem nhật ký kho</Link></p></div>}
  </section>;
}
