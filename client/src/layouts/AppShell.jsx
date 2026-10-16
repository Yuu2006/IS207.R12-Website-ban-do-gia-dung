import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, LogOut, Store, UserRound, Warehouse } from 'lucide-react';
import Header from '../components/Header.jsx';
import { roleLabels, useAuth } from '../context/auth-context.js';

export const workspaceMenus = {
  CUSTOMER: [['/customer', 'Tổng quan'], ['/profile', 'Hồ sơ của tôi'], ['/addresses', 'Địa chỉ nhận hàng'], ['/orders', 'Đơn hàng của tôi'], ['/checkout', 'Thanh toán']],
  ADMIN: [['/admin', 'Tổng quan'], ['/admin/products', 'Catalog sản phẩm'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Lịch sử kho'], ['/admin/users', 'Người dùng'], ['/admin/vouchers', 'Voucher'], ['/admin/reports', 'Báo cáo'], ['/profile', 'Hồ sơ của tôi']],
  SALES: [['/sales', 'Tổng quan'], ['/sales/orders', 'Xử lý đơn hàng'], ['/sales/returns', 'Trả hàng / hoàn tiền'], ['/profile', 'Hồ sơ của tôi']],
  WAREHOUSE: [['/warehouse', 'Tổng quan'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Lịch sử tồn kho'], ['/profile', 'Hồ sơ của tôi']],
};

const roleIcons = { CUSTOMER: UserRound, ADMIN: LayoutDashboard, SALES: Store, WAREHOUSE: Warehouse };

// Shell dùng chung cho bốn vai trò; nhân viên không dùng thanh điều hướng cửa hàng, chỉ menu được phép.
export default function AppShell() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const staff = user.role !== 'CUSTOMER';
  const RoleIcon = roleIcons[user.role];

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try { await signOut(); navigate('/login', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className={`hc-app${staff ? ' hc-app--staff' : ''}`}>{!staff && <Header />}<div className="hc-app-body">
    <aside className="hc-sidebar"><div className="hc-role"><span className="hc-role-icon" aria-hidden="true"><RoleIcon size={22} /></span><span><small>KHÔNG GIAN LÀM VIỆC</small><strong>{roleLabels[user.role]}</strong></span></div><nav aria-label={`Menu ${roleLabels[user.role]}`}>{workspaceMenus[user.role].map(([path, title]) => <NavLink key={path} end={['/customer', '/admin', '/sales', '/warehouse'].includes(path)} to={path}>{title}</NavLink>)}</nav><button className="hc-logout" type="button" disabled={busy} onClick={handleLogout}><LogOut size={17} aria-hidden="true" />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>{error && <p className="hc-error" role="alert">{error}</p>}</aside>
    <main className="hc-main"><Outlet /></main>
  </div></div>;
}
