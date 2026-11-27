import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Circle, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { announceNotificationsUpdated, getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notification-service.js';
import '../../styles/notification-audit.css';

function formatUtcDateTime(value) {
  if (!value) return '—';
  const text = String(value).trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString('vi-VN');
}

// Display and update only the authenticated user's notification inbox.
export default function NotificationsPage() {
  const [inbox, setInbox] = useState(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  useEffect(() => { document.title = 'Thông báo · HomeCare'; }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await getNotifications({ page, pageSize: 20, unreadOnly });
      if (requestId !== requestIdRef.current) return;
      if (page > 1 && data.items.length === 0 && data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
        setPage(data.pagination.totalPages);
        return;
      }
      setInbox(data);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err.message || 'Không tải được thông báo.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      await markNotificationRead(id);
      announceNotificationsUpdated();
      await load();
    } catch (err) {
      setError(err.message || 'Không thể cập nhật thông báo.');
    } finally {
      setBusyId('');
    }
  }

  // Navigating away unmounts the inbox; fire mark-read without refreshing unmounted page state.
  function markReadOnNavigate(id) {
    void markNotificationRead(id).then(() => announceNotificationsUpdated()).catch(() => {});
  }

  async function markAllRead() {
    if (busyAll || !inbox?.unreadCount) return;
    setBusyAll(true);
    setError('');
    try {
      await markAllNotificationsRead();
      announceNotificationsUpdated();
      await load();
    } catch (err) {
      setError(err.message || 'Không thể cập nhật thông báo.');
    } finally {
      setBusyAll(false);
    }
  }

  const pagination = inbox?.pagination;
  return <section className="hc-notifications-page">
    <header className="hc-page-heading hc-notifications-heading">
      <div><span className="hc-eyebrow">TÀI KHOẢN</span><h1>Thông báo</h1><p>Theo dõi cập nhật đơn hàng và các hoạt động liên quan đến tài khoản.</p></div>
      <button className="hc-button hc-button--outline" type="button" disabled={busyAll || !inbox?.unreadCount} onClick={markAllRead}><CheckCheck size={17} aria-hidden="true" />Đánh dấu tất cả đã đọc</button>
    </header>

    <div className="hc-notifications-toolbar">
      <div className="hc-notification-summary"><Bell size={18} aria-hidden="true" /><span>{inbox?.unreadCount ?? '—'} chưa đọc</span></div>
      <label className="hc-checkbox-label"><input type="checkbox" checked={unreadOnly} onChange={event => { setPage(1); setUnreadOnly(event.target.checked); }} />Chỉ chưa đọc</label>
    </div>

    {error && <div className="hc-error" role="alert"><span>{error}</span><button className="hc-button hc-button--outline" type="button" onClick={load}>Thử lại</button></div>}
    {loading ? <div className="hc-card hc-notification-empty" aria-live="polite">Đang tải thông báo…</div>
      : inbox?.items.length ? <div className="hc-notification-list">{inbox.items.map(item => {
        const content = <><span className="hc-notification-icon" aria-hidden="true"><Bell size={18} /></span><span className="hc-notification-copy"><strong>{item.title}</strong><span>{item.message}</span><time dateTime={item.createdAt}>{formatUtcDateTime(item.createdAt)}</time></span>{!item.readAt && <Circle className="hc-notification-unread" size={10} fill="currentColor" aria-label="Chưa đọc" />}</>;
        return <article className={`hc-notification-item${item.readAt ? '' : ' is-unread'}`} key={item.id}>
          {item.targetUrl ? <Link to={item.targetUrl} className="hc-notification-link" onClick={() => { if (!item.readAt) markReadOnNavigate(item.id); }}>{content}</Link> : <div className="hc-notification-link">{content}</div>}
          {!item.readAt && <button className="hc-text-button" type="button" disabled={busyId === item.id} onClick={() => void markRead(item.id)}>{busyId === item.id ? 'Đang lưu…' : 'Đánh dấu đã đọc'}</button>}
        </article>;
      })}</div>
        : <div className="hc-card hc-notification-empty"><Inbox size={32} aria-hidden="true" /><strong>{unreadOnly ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}</strong><span>Các cập nhật mới sẽ xuất hiện tại đây.</span></div>}

    {pagination && pagination.totalPages > 1 && <nav className="hc-pagination" aria-label="Phân trang thông báo">
      <span>Trang {pagination.page}/{pagination.totalPages}</span>
      <button className="hc-button hc-button--outline" type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} aria-hidden="true" />Trước</button>
      <button className="hc-button hc-button--outline" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage(value => value + 1)}>Sau<ChevronRight size={16} aria-hidden="true" /></button>
    </nav>}
  </section>;
}
