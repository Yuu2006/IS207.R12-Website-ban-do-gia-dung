import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import Header from '../components/Header.jsx';
import { roleLabels, useAuth } from '../context/auth-context.js';
import { demoMode } from '../services/auth-service.js';

export const workspaceMenus = {
  CUSTOMER: [['/customer', 'Tổng quan'], ['/profile', 'Hồ sơ của tôi'], ['/addresses', 'Địa chỉ nhận hàng'], ['/orders', 'Đơn hàng của tôi'], ['/checkout', 'Thanh toán']],
  ADMIN: [['/admin', 'Tổng quan'], ['/admin/products', 'Sản phẩm'], ['/admin/users', 'Người dùng'], ['/admin/vouchers', 'Voucher'], ['/admin/reports', 'Báo cáo'], ['/profile', 'Hồ sơ của tôi']],
  SALES: [['/sales', 'Tổng quan'], ['/sales/orders', 'Xử lý đơn hàng'], ['/sales/returns', 'Trả hàng / hoàn tiền'], ['/profile', 'Hồ sơ của tôi']],
  WAREHOUSE: [['/warehouse', 'Tổng quan'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Lịch sử tồn kho'], ['/profile', 'Hồ sơ của tôi']],
};

// Shell dùng chung cho bốn vai trò, hiển thị rõ mock và chỉ menu được phép.
export default function AppShell() {
  const { user, demo, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try { await signOut(); navigate('/login', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="hc-app"><Header /><div className="hc-app-body">
    <aside className="hc-sidebar"><div className="hc-role"><ShieldCheck size={21} /><span><small>KHÔNG GIAN LÀM VIỆC</small><strong>{roleLabels[user.role]}</strong></span></div><nav aria-label={`Menu ${roleLabels[user.role]}`}>{workspaceMenus[user.role].map(([path, title]) => <NavLink key={path} end={['/customer', '/admin', '/sales', '/warehouse'].includes(path)} to={path}>{title}</NavLink>)}</nav><button className="hc-logout" type="button" disabled={busy} onClick={handleLogout}><LogOut size={17} />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>{error && <p className="hc-error" role="alert">{error}</p>}</aside>
    <main className="hc-main">{demo && <div className="hc-demo-banner">Bản demo <span>· Hồ sơ và địa chỉ lưu {demoMode ? 'trong trình duyệt này' : 'trong phiên API mock'}. Dữ liệu chưa được lưu vào MySQL.</span></div>}<Outlet /></main>
  </div><footer className="hc-app-footer">HomeCare · Đồ gia dụng cho mọi nhà</footer></div>;
}
