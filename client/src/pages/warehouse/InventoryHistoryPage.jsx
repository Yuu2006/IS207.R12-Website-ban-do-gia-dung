import { useEffect, useState } from 'react';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { listMovements } from '../../services/catalog-service.js';

// WH-04: lịch sử tồn kho gồm SKU, loại, thay đổi, tồn trước/sau, chứng từ, lý do, người và thời gian.
export default function InventoryHistoryPage() {
  const [filters, setFilters] = useState({ sku: '', movement_type: '' });
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => { document.title = 'Lịch sử kho · HomeCare'; }, []);
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

  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Kho hàng</span><h1>Lịch sử tồn kho</h1><p>Mới nhất trước, 20 dòng mỗi trang; lọc theo mã SKU chính xác hoặc loại giao dịch.</p></div>
    <div className="hc-card hc-form">
      <div className="hc-inline-form" role="search">
        <AdminField field={{ name: 'history-sku', label: 'Mã SKU' }} value={filters.sku} onChange={sku => filter('sku', sku)} />
        <AdminField field={{ name: 'history-type', label: 'Loại', type: 'select', options: [['import', 'Tăng'], ['export', 'Giảm']], placeholder: 'Tất cả' }} value={filters.movement_type} onChange={movement_type => filter('movement_type', movement_type)} />
      </div>
      {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setVersion(current => current + 1)}>Thử lại</button></p>}
      {!items ? !error && <p role="status" className="hc-muted">Đang tải lịch sử…</p> : items.length === 0 ? <p className="hc-muted">Chưa có biến động phù hợp.</p>
        : <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">Thời gian</th><th scope="col">SKU</th><th scope="col">Loại</th><th scope="col">Thay đổi</th><th scope="col">Trước → Sau</th><th scope="col">Chứng từ</th><th scope="col">Lý do</th><th scope="col">Người thực hiện</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.id}><td>{item.created_at}</td><td>{item.sku}</td><td>{item.movement_type === 'import' ? 'Tăng' : item.movement_type === 'export' ? 'Giảm' : item.movement_type}</td><td>{item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}</td><td>{item.quantity_before} → {item.quantity_after}</td><td>{item.reference_code}</td><td>{item.note || '—'}</td><td>{item.performed_by_name || 'Hệ thống'}</td></tr>)}</tbody></table></div>}
      {pagination?.totalPages > 1 && <nav className="hc-pagination" aria-label="Phân trang lịch sử kho"><button className="hc-button hc-button--outline" type="button" disabled={page <= 1 || !items} onClick={() => setPage(current => current - 1)}>Trước</button><span>Trang {pagination.page}/{pagination.totalPages} · {pagination.totalItems} dòng</span><button className="hc-button hc-button--outline" type="button" disabled={page >= pagination.totalPages || !items} onClick={() => setPage(current => current + 1)}>Sau</button></nav>}
    </div>
  </section>;
}
