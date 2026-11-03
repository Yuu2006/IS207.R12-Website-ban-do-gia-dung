import { useEffect, useState } from 'react';
import { Chips, DataTable, EmptyCard, PageHead, SearchBox } from '../../components/admin/ui.jsx';
import { listMovements } from '../../services/catalog-service.js';

// WH-04: nhật ký kho kiểu audit log — ai, lúc nào, nhập/xuất gì, tồn trước/sau, chứng từ và lý do.
const actions = { import: ['Nhập kho', 'in'], export: ['Xuất kho', 'mute'] };
const typeOptions = [['', 'Tất cả'], ['import', 'Nhập kho'], ['export', 'Xuất kho']];
// created_at lưu UTC (không kèm múi giờ); hiển thị theo giờ máy.
const formatTime = value => new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const columns = [
  { key: 'time', label: 'Thời gian', width: '130px', render: item => <span className="ad-muted">{formatTime(item.created_at)}</span> },
  { key: 'ref', label: 'Mã phiếu', width: '150px', render: item => <span className="ad-strong">{item.reference_code}</span> },
  { key: 'sku', label: 'Sản phẩm', width: 'minmax(0, 1.4fr)', render: item => <div><b className="ad-strong">{item.sku}</b><span className="ad-sub">{item.variant_name}</span></div> },
  { key: 'type', label: 'Loại', width: '90px', render: item => { const [label, tone] = actions[item.movement_type] || [item.movement_type, 'mute']; return <span className={`hc-badge hc-badge--${tone}`}>{label}</span>; } },
  { key: 'change', label: 'Số lượng', width: '70px', render: item => { const change = Number(item.quantity_change); return <span className={change > 0 ? 'ad-plus' : 'ad-minus'}>{change > 0 ? `+${change}` : change}</span>; } },
  { key: 'stock', label: 'Tồn kho', width: '80px', render: item => <>{item.quantity_before} → <b>{item.quantity_after}</b></> },
  { key: 'actor', label: 'Người thực hiện', width: '140px', render: item => item.performed_by_name || 'Hệ thống' },
  { key: 'note', label: 'Ghi chú', width: 'minmax(0, 1.4fr)', render: item => item.note || '—' },
];

export default function InventoryHistoryPage() {
  const [filters, setFilters] = useState({ sku: '', movement_type: '' });
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => { document.title = 'Nhật ký kho · HomeCare'; }, []);
  // Debounce ô SKU và bỏ phản hồi cũ.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setItems(null); setError('');
      listMovements({ sku: filters.sku.trim(), movement_type: filters.movement_type, page, pageSize: 20 }).then(data => { if (active) { setItems(data.items); setPagination(data.pagination); } }).catch(err => { if (active) setError(err.message); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, version, page]);
  function filter(key, value) { setPage(1); setFilters(current => ({ ...current, [key]: value })); }

  return <section>
    <PageHead title="Nhật ký kho" subtitle="Mọi lần nhập/xuất đều được ghi lại, không sửa được: mới nhất trước, 20 dòng mỗi trang." />
    <div className="ad-filters" role="search"><SearchBox label="Lọc theo mã SKU" placeholder="Nhập mã SKU chính xác" value={filters.sku} onChange={sku => filter('sku', sku)} /></div>
    <Chips label="Lọc theo hành động" options={typeOptions} value={filters.movement_type} onChange={movement_type => filter('movement_type', movement_type)} />
    {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setVersion(current => current + 1)}>Thử lại</button></p>}
    {!items ? !error && <p role="status" className="hc-muted">Đang tải nhật ký…</p> : items.length === 0 ? <EmptyCard>Chưa có bản ghi phù hợp.</EmptyCard>
      : <DataTable label="Nhật ký nhập xuất kho" cols={columns} rows={items} rowKey={item => item.id} />}
    {pagination?.totalPages > 1 && <nav className="hc-pagination" aria-label="Phân trang nhật ký kho"><button className="hc-button hc-button--outline" type="button" disabled={page <= 1 || !items} onClick={() => setPage(current => current - 1)}>Trước</button><span>Trang {pagination.page}/{pagination.totalPages} · {pagination.totalItems} bản ghi</span><button className="hc-button hc-button--outline" type="button" disabled={page >= pagination.totalPages || !items} onClick={() => setPage(current => current + 1)}>Sau</button></nav>}
  </section>;
}
