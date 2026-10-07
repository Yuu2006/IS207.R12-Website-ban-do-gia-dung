import { Link, Navigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { isCustomerUser } from '../utils/customer-session.js';

// Chặn render dữ liệu đơn khi chưa xác nhận phiên; giữ URL để quay lại sau đăng nhập.
export default function CustomerRoute({ children }) {
  const { user, status, error, refreshSession } = useCustomerAuth();
  const location = useLocation();
  if (status === 'loading') return <main className="oc-main"><div className="oc-empty" role="status"><h1>Đang kiểm tra đăng nhập…</h1></div></main>;
  if (status === 'error') return <main className="oc-main"><div className="oc-card oc-empty" role="alert">
    <h1>Chưa thể tải đơn hàng</h1><p>{error}</p>
    <button className="oc-button" onClick={() => refreshSession().catch(() => {})}>Thử lại</button>
    <Link className="oc-text-action" to="/login" state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }}>Đăng nhập</Link>
  </div></main>;
  if (status !== 'authenticated' || !isCustomerUser(user)) return <Navigate to="/login" replace state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }} />;
  return children;
}
