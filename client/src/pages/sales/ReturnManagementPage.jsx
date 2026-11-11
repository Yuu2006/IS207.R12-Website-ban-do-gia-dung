import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, PackageCheck, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { createReturnRefundService } from '../../services/return-refund-service.js';
import './return-management.css';

const statusLabels = { requested: 'Chờ phân loại', pending_manager: 'Chờ quản lý duyệt', approved: 'Đã duyệt · chờ nhận hàng', rejected: 'Từ chối', refunded: 'Đã ghi nhận hoàn tiền' };
const severityLabels = { minor: 'Nhẹ', major: 'Nặng', critical: 'Nghiêm trọng' };
const categoryLabels = { SAFETY_HAZARD: 'Nguy cơ an toàn', DEFECTIVE: 'Lỗi chức năng', TRANSIT_DAMAGE: 'Hư hỏng khi vận chuyển', WRONG_ITEM: 'Giao sai sản phẩm', MISSING_COMPONENT: 'Thiếu phụ kiện', SPEC_MISMATCH: 'Sai thông số cam kết', COSMETIC_DAMAGE: 'Trầy xước nhẹ', PACKAGING_ONLY: 'Chỉ hư bao bì', BUYER_REMORSE: 'Đổi ý sau mua', CUSTOMER_MISUSE: 'Hư hỏng do sử dụng', OTHER: 'Vấn đề khác' };
const formatMoney = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫';
const formatDate = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const emptyChecklist = () => ({ packageReceived: false, orderMatched: false, allItemsPresent: false, conditionAssessed: false, notes: '' });
const newKey = () => 'return:' + crypto.randomUUID();

function Badge({ status }) {
  return <span className={'rr-badge rr-badge--' + status}>{statusLabels[status] || status}</span>;
}

// Staff workspace for triage, management approval and warehouse receipt.
export default function ReturnManagementPage() {
  const { user } = useAuth();
  const service = useMemo(() => createReturnRefundService(), []);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [severityInput, setSeverityInput] = useState('MAJOR');
  const [triageNote, setTriageNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [checklist, setChecklist] = useState(emptyChecklist);
  const pendingMutation = useRef(null);
  const activeReturnId = useRef('');
  activeReturnId.current = selectedId;
  const salesCanTriage = user?.role === 'SALES';
  const adminCanDecide = user?.role === 'ADMIN';
  const warehouseCanReceive = user?.role === 'WAREHOUSE';
  const checklistReady = ['packageReceived', 'orderMatched', 'allItemsPresent', 'conditionAssessed'].every(field => checklist[field]) && checklist.notes.trim();

  // Load filtered queue from the API; list filters and pagination are enforced server-side.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    service.list({ status, severity, search, page, signal: controller.signal })
      .then(result => {
        setRows(result.items);
        setPagination(result.pagination);
        setSelectedId(current => result.items.some(item => item.id === current) ? current : (result.items[0]?.id || ''));
      })
      .catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [service, status, severity, search, page, refresh]);

  // Load request detail independently so action forms are based on the current server state.
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailLoading(false); return undefined; }
    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(true);
    setSeverityInput('MAJOR');
    setTriageNote('');
    setDecisionReason('');
    setChecklist(emptyChecklist());
    service.detail(selectedId, { signal: controller.signal })
      .then(setDetail)
      .catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [service, selectedId]);

  async function submitMutation(kind, body, apply) {
    if (!detail || busy) return;
    const fingerprint = kind + ':' + detail.id + ':' + JSON.stringify(body);
    const key = pendingMutation.current?.fingerprint === fingerprint ? pendingMutation.current.key : newKey();
    pendingMutation.current = { fingerprint, key };
    setBusy(true);
    setError('');
    try {
      const returnId = detail.id;
      const updated = await apply({ idempotencyKey: key });
      pendingMutation.current = null;
      if (activeReturnId.current === returnId) {
        setDetail(updated);
        setTriageNote('');
        setDecisionReason('');
        setChecklist(emptyChecklist());
      }
      setRefresh(value => value + 1);
    } catch (failure) {
      if (!(failure.status === 0 || failure.status >= 500 || failure.code === 'INVALID_API_RESPONSE')) pendingMutation.current = null;
      setError(failure.message);
    } finally { setBusy(false); }
  }

  function searchQueue(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  const selectedStatus = detail?.status;

  return <section className="rr-page">
    <header className="rr-heading">
      <div><span className="rr-eyebrow">VẬN HÀNH ĐƠN HÀNG</span><h1>Yêu cầu trả hàng</h1><p>Phân loại sự cố, duyệt theo mức độ và ghi nhận nhận hàng trước khi hoàn tiền mô phỏng.</p></div>
      <div className="rr-queue-count"><strong>{pagination.totalItems}</strong><span>yêu cầu</span></div>
    </header>
    <div className="rr-toolbar">
      <label><span>Trạng thái</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Mức độ</span><select value={severity} onChange={event => { setSeverity(event.target.value); setPage(1); }}><option value="">Tất cả mức độ</option>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <form className="rr-search" onSubmit={searchQueue}><label htmlFor="rr-search-input">Tìm mã đơn hoặc khách hàng</label><div><Search size={17} aria-hidden="true" /><input id="rr-search-input" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Mã đơn, tên khách hàng" /><button type="submit">Tìm</button></div></form>
    </div>
    {error && <div className="rr-alert" role="alert"><AlertTriangle size={18} />{error}<button type="button" onClick={() => setError('')} aria-label="Đóng thông báo">×</button></div>}
    <div className="rr-workspace">
      <aside className="rr-list" aria-label="Danh sách yêu cầu trả hàng">
        {loading ? <div className="rr-state"><RefreshCw size={20} className="rr-spin" />Đang tải yêu cầu…</div> : rows.length === 0 ? <div className="rr-state"><PackageCheck size={28} /><strong>Không có yêu cầu phù hợp</strong><span>Thử bỏ bớt bộ lọc để xem yêu cầu khác.</span></div> : rows.map(item => <button key={item.id} type="button" className={'rr-list-item' + (selectedId === item.id ? ' is-active' : '')} onClick={() => { setSelectedId(item.id); setChecklist(emptyChecklist()); }}>
          <span className="rr-list-top"><strong>#{item.orderCode}</strong><small>{formatDate(item.createdAt)}</small></span>
          <span className="rr-list-customer">{item.customerName}</span>
          <span className="rr-list-bottom"><Badge status={item.status} />{item.severity && <span className={'rr-severity rr-severity--' + item.severity}>{severityLabels[item.severity]}</span>}</span>
        </button>)}
        {!loading && pagination.totalPages > 1 && <div className="rr-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>{page}/{pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
      </aside>
      <main className="rr-detail">
        {detailLoading ? <div className="rr-state"><RefreshCw size={20} className="rr-spin" />Đang tải chi tiết…</div> : !detail ? <div className="rr-state rr-state--large"><ClipboardCheck size={36} /><strong>Chọn một yêu cầu</strong><span>Chi tiết và các bước xử lý hiển thị tại đây.</span></div> : <>
          <div className="rr-detail-head"><div><span className="rr-eyebrow">ĐƠN HÀNG #{detail.order.code}</span><h2>{detail.customer.name}</h2><p>{detail.customer.phone} · gửi lúc {formatDate(detail.createdAt)}</p></div><Badge status={selectedStatus} /></div>
          <div className="rr-summary-grid">
            <div><span>Nhóm vấn đề</span><strong>{categoryLabels[detail.issueCategory] || detail.issueCategory}</strong></div>
            <div><span>Mức độ</span><strong>{detail.severity ? severityLabels[detail.severity] : 'Chưa phân loại'}</strong></div>
            <div><span>Giá trị đơn</span><strong>{formatMoney(detail.order.totalAmount)}</strong></div>
            <div><span>Thanh toán</span><strong>{detail.order.paymentMethod} · {detail.order.paymentStatus}</strong></div>
          </div>
          <section className="rr-section"><h3>Mô tả của khách</h3><p className="rr-reason">{detail.reason}</p>{detail.triageNote && <p className="rr-staff-note"><strong>Nhận định của SALES:</strong> {detail.triageNote}</p>}{detail.decisionReason && <p className="rr-staff-note"><strong>Quyết định:</strong> {detail.decisionReason}</p>}</section>
          <section className="rr-section"><h3>Sản phẩm trong đơn</h3><ul className="rr-products">{detail.order.items.map(item => <li key={item.orderItemId}><span><strong>{item.productName}</strong><small>{item.skuCode}{item.variantName ? ' · ' + item.variantName : ''} · SL {item.quantity}</small></span><strong>{formatMoney(item.lineTotal)}</strong></li>)}</ul><div className="rr-order-total"><span>Tổng đơn</span><strong>{formatMoney(detail.order.totalAmount)}</strong></div></section>
          {salesCanTriage && selectedStatus === 'requested' && <form className="rr-action-card" onSubmit={event => { event.preventDefault(); const body = { severity: severityInput, note: triageNote.trim() }; submitMutation('triage', body, options => service.triage(detail.id, body, options)); }}>
            <h3><ShieldCheck size={19} />Phân loại sự cố</h3>
            <p className="rr-guidance">Gợi ý: nguy cơ cháy/điện/đứt vỡ nguy hiểm thường là nghiêm trọng; không hoạt động, giao sai hoặc hư hỏng ảnh hưởng sử dụng là nặng; trầy xước nhỏ hoặc chỉ hư bao bì là nhẹ. SALES cần đối chiếu chứng cứ và sản phẩm thực tế.</p>
            <label>Mức độ<select value={severityInput} onChange={event => setSeverityInput(event.target.value)} disabled={busy}><option value="MINOR">Nhẹ · không chuyển duyệt hoàn hàng</option><option value="MAJOR">Nặng · gửi ADMIN duyệt</option><option value="CRITICAL">Nghiêm trọng · gửi ADMIN duyệt</option></select></label>
            <label>Nhận định và lý do<textarea value={triageNote} onChange={event => setTriageNote(event.target.value)} maxLength={500} required disabled={busy} placeholder="Mô tả căn cứ phân loại và thông tin đã xác minh" /></label>
            <button className="rr-primary" type="submit" disabled={busy || !triageNote.trim()}>{busy ? 'Đang lưu…' : severityInput === 'MINOR' ? 'Ghi nhận phân loại' : 'Chuyển ADMIN duyệt'}</button>
          </form>}
          {adminCanDecide && selectedStatus === 'pending_manager' && <form className="rr-action-card" onSubmit={event => event.preventDefault()}>
            <h3><ShieldCheck size={19} />Quản lý xem xét</h3><p>Yêu cầu mức {severityLabels[detail.severity]} đang chờ quyết định. Chỉ ADMIN có quyền duyệt.</p>
            <label>Lý do quyết định<textarea value={decisionReason} onChange={event => setDecisionReason(event.target.value)} maxLength={500} required disabled={busy} placeholder="Ghi căn cứ duyệt hoặc từ chối" /></label>
            <div className="rr-actions">
              <button className="rr-secondary rr-danger" type="button" disabled={busy || !decisionReason.trim()} onClick={() => { const body = { decision: 'REJECT', reason: decisionReason.trim() }; submitMutation('decision', body, options => service.decide(detail.id, body, options)); }}>Từ chối</button>
              <button className="rr-primary" type="button" disabled={busy || !decisionReason.trim()} onClick={() => { const body = { decision: 'APPROVE', reason: decisionReason.trim() }; submitMutation('decision', body, options => service.decide(detail.id, body, options)); }}>{busy ? 'Đang lưu…' : 'Duyệt yêu cầu'}</button>
            </div>
          </form>}
          {warehouseCanReceive && selectedStatus === 'approved' && <form className="rr-action-card" onSubmit={event => { event.preventDefault(); const body = { checklist }; submitMutation('receive', body, options => service.receive(detail.id, body, options)); }}>
            <h3><ClipboardCheck size={19} />Nhận hàng và kiểm tra</h3><p>Hoàn tất checklist sau khi đối chiếu hàng thực nhận. Hoàn tiền được ghi nhận mô phỏng toàn bộ đơn sau bước này; không tự động nhập lại tồn kho.</p>
            <div className="rr-checklist">{[['packageReceived', 'Đã nhận kiện hàng trả'], ['orderMatched', 'Sản phẩm khớp với đơn hàng'], ['allItemsPresent', 'Đã nhận đủ sản phẩm/phụ kiện theo đơn'], ['conditionAssessed', 'Đã kiểm tra và ghi nhận tình trạng']].map(([field, label]) => <label key={field}><input type="checkbox" checked={checklist[field]} disabled={busy} onChange={event => setChecklist(current => ({ ...current, [field]: event.target.checked }))} /><span><Check size={14} aria-hidden="true" />{label}</span></label>)}</div>
            <label>Ghi chú kiểm tra<textarea value={checklist.notes} onChange={event => setChecklist(current => ({ ...current, notes: event.target.value }))} maxLength={500} required disabled={busy} placeholder="Tình trạng thực tế và phụ kiện đã đối chiếu" /></label>
            <button className="rr-primary" type="submit" disabled={busy || !checklistReady}>{busy ? 'Đang ghi nhận…' : 'Xác nhận nhận hàng & hoàn tiền mô phỏng'}</button>
          </form>}
          {detail.refundStatus && <div className="rr-refund-result"><PackageCheck size={20} /><div><strong>Đã ghi nhận hoàn tiền mô phỏng</strong><span>{formatMoney(detail.refundAmount)} · {formatDate(detail.refundCreatedAt)} · Không gọi ngân hàng</span></div></div>}
          <section className="rr-section rr-history"><h3>Lịch sử xử lý</h3><ol>{detail.history.map((entry, index) => <li key={entry.action + '-' + index}><span className="rr-history-dot" /><div><strong>{statusLabels[entry.toStatus] || entry.toStatus}</strong><small>{entry.actorName} · {entry.actorRole} · {formatDate(entry.changedAt)}</small>{entry.note && <p>{entry.note}</p>}</div></li>)}</ol></section>
        </>}
      </main>
    </div>
  </section>;
}
