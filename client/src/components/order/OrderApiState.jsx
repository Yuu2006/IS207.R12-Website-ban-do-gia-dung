import { Link, useLocation } from 'react-router-dom';

// Lỗi API không được biến thành empty state hay thông báo thành công.
export default function OrderApiState({ loading, error, retry }) {
  const location = useLocation();
  const loginPath = location.pathname.startsWith('/sales/') ? '/internal/login' : '/login';
  if (loading) return <div className="oc-card oc-empty" role="status" aria-live="polite">Đang tải dữ liệu…</div>;
  if (!error) return null;
  return <div className="oc-card oc-empty" role="alert"><h2>Chưa thể tải dữ liệu</h2><p>{error.message}</p>
    {error.status === 401 ? <Link className="oc-button" to={loginPath} state={{ returnTo: location.pathname }}>Đăng nhập</Link> : retry && <button className="oc-button oc-button--outline" onClick={retry}>Thử lại</button>}
  </div>;
}
