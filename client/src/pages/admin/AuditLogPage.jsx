import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileClock, Search } from 'lucide-react';
import { getAuditLogs } from '../../services/audit-service.js';
import '../../styles/notification-audit.css';

const emptyFilters = { action: '', entityType: '', actorId: '', from: '', to: '' };

const suggestedActions = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'LOGOUT',
  'USER_CREATE', 'USER_UPDATE', 'USER_DISABLE', 'USER_ENABLE',
  'CATALOG_CATEGORY_CREATED', 'CATALOG_CATEGORY_UPDATED', 'CATALOG_CATEGORY_DELETED',
  'CATALOG_BRAND_CREATED', 'CATALOG_BRAND_UPDATED', 'CATALOG_BRAND_DELETED',
  'CATALOG_PRODUCT_CREATED', 'CATALOG_PRODUCT_UPDATED', 'CATALOG_PRODUCT_DELETED', 'CATALOG_PRODUCT_ATTRIBUTES_UPDATED',
  'CATALOG_VARIANT_CREATED', 'CATALOG_VARIANT_UPDATED', 'CATALOG_VARIANT_DELETED',
  'CATALOG_IMAGE_CREATED', 'CATALOG_IMAGE_UPDATED', 'CATALOG_IMAGE_DELETED',
  'CATALOG_ATTRIBUTE_CREATED',
  'CATALOG_BANNER_CREATED', 'CATALOG_BANNER_UPDATED', 'CATALOG_BANNER_DELETED',
  'FIT_RULE_CREATED', 'FIT_RULE_UPDATED', 'FIT_RULE_DEACTIVATED', 'FIT_CHECK_COMPLETED',
  'CARE_RULE_CREATED', 'CARE_RULE_UPDATED',
  'ORDER_CREATED', 'ORDER_STATUS_CHANGED',
  'PAYMENT_PAID', 'PAYMENT_PAID_REQUIRES_REVIEW', 'PAYMENT_COD_COLLECTED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'PAYMENT_REFUND_SIMULATED',
  'RETURN_REQUESTED', 'RETURN_TRIAGED', 'RETURN_DECIDED', 'RETURN_REFUND_SIMULATED',
  'INVENTORY_ADJUSTED',
];

const suggestedEntityTypes = [
  'auth', 'user', 'order', 'payment', 'return_request',
  'category', 'brand', 'product', 'product_variant', 'product_image', 'product_attribute', 'banner',
  'fit_rule', 'decision_event', 'care_rule', 'inventory_movement',
];

function dateLabel(value) {
  if (!value) return '—';
  const text = String(value).trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString('vi-VN');
}

function normalizeFilters(raw) {
  return {
    action: raw.action.trim(),
    entityType: raw.entityType.trim(),
    actorId: raw.actorId.trim(),
    from: raw.from.trim(),
    to: raw.to.trim(),
  };
}

// Present immutable staff audit records with bounded server-side filters and pagination.
export default function AuditLogPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => { document.title = 'Nhật ký hoạt động · HomeCare'; }, []);

  async function load(nextPage = page, nextFilters = applied) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLogs({ ...nextFilters, page: nextPage, pageSize: 25 });
      if (requestId === requestIdRef.current) setResult(data);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err.message || 'Không tải được nhật ký hoạt động.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => { void load(1, emptyFilters); }, []);

  function submit(event) {
    event.preventDefault();
    const cleaned = normalizeFilters(filters);
    setFilters(cleaned);
    setApplied(cleaned);
    setPage(1);
    void load(1, cleaned);
  }

  const pagination = result?.pagination;
  return <section className="hc-audit-page">
    <header className="hc-page-heading"><span className="hc-eyebrow">QUẢN TRỊ</span><h1>Nhật ký hoạt động</h1><p>Lịch sử thao tác được ghi nhận trên hệ thống. Nhật ký chỉ đọc dành cho quản trị viên.</p></header>
    <form className="hc-card hc-audit-filters" onSubmit={submit}>
      <label className="hc-field"><span>Thao tác</span><input list="hc-audit-actions" value={filters.action} onChange={event => setFilters(value => ({ ...value, action: event.target.value }))} maxLength={80} placeholder="Ví dụ: USER_DISABLE" /></label>
      <label className="hc-field"><span>Loại dữ liệu</span><input list="hc-audit-entities" value={filters.entityType} onChange={event => setFilters(value => ({ ...value, entityType: event.target.value }))} maxLength={80} placeholder="Ví dụ: order" /></label>
      <label className="hc-field"><span>ID người thực hiện</span><input inputMode="numeric" value={filters.actorId} onChange={event => setFilters(value => ({ ...value, actorId: event.target.value }))} placeholder="ID tài khoản" /></label>
      <label className="hc-field"><span>Từ ngày</span><input type="date" value={filters.from} onChange={event => setFilters(value => ({ ...value, from: event.target.value }))} /></label>
      <label className="hc-field"><span>Đến ngày</span><input type="date" value={filters.to} onChange={event => setFilters(value => ({ ...value, to: event.target.value }))} /></label>
      <div className="hc-audit-filter-actions"><button className="hc-button" type="submit" disabled={loading}><Search size={16} aria-hidden="true" />Lọc nhật ký</button><button className="hc-button hc-button--outline" type="button" disabled={loading} onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(1); void load(1, emptyFilters); }}>Xóa lọc</button></div>
      <datalist id="hc-audit-actions">{suggestedActions.map(action => <option key={action} value={action} />)}</datalist>
      <datalist id="hc-audit-entities">{suggestedEntityTypes.map(entity => <option key={entity} value={entity} />)}</datalist>
    </form>
    {error && <div className="hc-error" role="alert"><span>{error}</span><button className="hc-button hc-button--outline" type="button" onClick={() => void load()}>Thử lại</button></div>}
    <div className="hc-card hc-audit-table-card">
      <div className="hc-audit-table-heading"><strong><FileClock size={18} aria-hidden="true" />Lịch sử</strong>{pagination && <span>{pagination.totalItems} sự kiện</span>}</div>
      <div className="hc-table-scroll"><table className="hc-audit-table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan="5" className="hc-table-state">Đang tải nhật ký…</td></tr> : result?.items.length ? result.items.map(item => <tr key={item.id}>
          <td className="hc-audit-time">{dateLabel(item.createdAt)}</td><td><span>{item.actorName}<small className="hc-audit-subtext">{item.actorRole || 'Không xác định'}{item.actorId ? ` · #${item.actorId}` : ''}</small></span></td><td><code>{item.action}</code></td><td><span>{item.entityType}{item.entityId ? <small className="hc-audit-subtext">#{item.entityId}</small> : ''}</span></td><td><details><summary>Xem chi tiết</summary><pre>{JSON.stringify(item.details, null, 2)}</pre></details></td>
        </tr>) : <tr><td colSpan="5" className="hc-table-state">Không có sự kiện phù hợp.</td></tr>}</tbody>
      </table></div>
      {pagination && pagination.totalPages > 0 && <nav className="hc-pagination" aria-label="Phân trang nhật ký"><span>Trang {pagination.page}/{pagination.totalPages}</span><button className="hc-button hc-button--outline" type="button" disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); void load(next); }}><ChevronLeft size={16} aria-hidden="true" />Trước</button><button className="hc-button hc-button--outline" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => { const next = page + 1; setPage(next); void load(next); }}>Sau<ChevronRight size={16} aria-hidden="true" /></button></nav>}
    </div>
  </section>;
}
