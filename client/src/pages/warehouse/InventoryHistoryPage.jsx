import { useEffect, useState } from 'react';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { listMovements } from '../../services/catalog-service.js';

// WH-04: nhật ký kho kiểu audit log — ai, lúc nào, nhập/xuất gì, tồn trước/sau, chứng từ và lý do.
const actions = { import: ['Nhập kho', 'in'], export: ['Xuất kho', 'out'] };
// created_at lưu UTC (không kèm múi giờ); hiển thị theo giờ máy.
const formatTime = value => new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('vi-VN', { hour12: false });

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

  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Kho hàng</span><h1>Nhật ký tồn kho</h1><p>Mọi lần nhập/xuất đều được ghi lại, không sửa được: mới nhất trước, 20 dòng mỗi trang. Lọc theo mã SKU chính xác hoặc hành động.</p></div>
    <div className="hc-card hc-form">
      <div className="hc-inline-form" role="search">
        <AdminField field={{ name: 'history-sku', label: 'Mã SKU' }} value={filters.sku} onChange={sku => filter('sku', sku)} />
        <AdminField field={{ name: 'history-type', label: 'Hành động', type: 'select', options: [['import', 'Nhập kho'], ['export', 'Xuất kho']], placeholder: 'Tất cả' }} value={filters.movement_type} onChange={movement_type => filter('movement_type', movement_type)} />
      </div>
      {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setVersion(current => current + 1)}>Thử lại</button></p>}
      {!items ? !error && <p role="status" className="hc-muted">Đang tải nhật ký…</p> : items.length === 0 ? <p className="hc-muted">Chưa có bản ghi phù hợp.</p>
        : <div className="hc-table-wrap"><table className="hc-table hc-audit"><thead><tr><th scope="col">Thời gian</th><th scope="col">Người thực hiện</th><th scope="col">Hành động</th><th scope="col">SKU</th><th scope="col">Số lượng</th><th scope="col">Tồn kho</th><th scope="col">Lý do / chứng từ</th></tr></thead>
          <tbody>{items.map(item => { const [label, tone] = actions[item.movement_type] || [item.movement_type, 'in']; const actor = item.performed_by_name || 'Hệ thống'; const change = Number(item.quantity_change);
            return <tr key={item.id}><td className="hc-audit-time">{formatTime(item.created_at)}</td><td><span className="hc-audit-actor"><span className="hc-audit-avatar" aria-hidden="true">{actor.trim().charAt(0).toUpperCase()}</span>{actor}</span></td><td><span className={`hc-badge hc-badge--${tone}`}>{label}</span></td><td>{item.sku}</td><td className={`hc-audit-${change > 0 ? 'in' : 'out'}`}>{change > 0 ? `+${change}` : change}</td><td>{item.quantity_before} → <strong>{item.quantity_after}</strong></td><td>{item.note || '—'}<code className="hc-audit-ref">{item.reference_code}</code></td></tr>; })}</tbody></table></div>}
      {pagination?.totalPages > 1 && <nav className="hc-pagination" aria-label="Phân trang nhật ký kho"><button className="hc-button hc-button--outline" type="button" disabled={page <= 1 || !items} onClick={() => setPage(current => current - 1)}>Trước</button><span>Trang {pagination.page}/{pagination.totalPages} · {pagination.totalItems} bản ghi</span><button className="hc-button hc-button--outline" type="button" disabled={page >= pagination.totalPages || !items} onClick={() => setPage(current => current + 1)}>Sau</button></nav>}
    </div>
  </section>;
}
