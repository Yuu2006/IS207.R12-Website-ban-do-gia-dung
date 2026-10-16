import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { roleHome, useAuth } from '../context/auth-context.js';

// Guard giao diện chỉ hỗ trợ điều hướng; API vẫn kiểm tra quyền độc lập.
export default function ProtectedRoute({ roles }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <p className="hc-status" role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (error) return <div className="hc-status" role="alert"><p>{error}</p><Link to="/login">Về trang đăng nhập</Link></div>;
  if (!user) return <Navigate to={roles && !roles.includes('CUSTOMER') ? '/internal/login' : '/login'} replace state={{ from: location.pathname }} />;
  if (!roleHome[user.role] || (roles && !roles.includes(user.role))) return <div className="hc-status"><h1>Không có quyền truy cập</h1><p>Trang này dành cho vai trò khác.</p><Link to={roleHome[user.role] || '/'}>Về không gian của tôi</Link></div>;
  return <Outlet />;
}
