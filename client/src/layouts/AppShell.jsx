import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Boxes, ChartColumn, ClipboardList, CreditCard, History, LayoutDashboard, LogOut, MapPin, Package, ReceiptText, Store, Ticket, Undo2, UserRound, Users, Warehouse } from 'lucide-react';
import Header from '../components/Header.jsx';
import { roleLabels, useAuth } from '../context/auth-context.js';

export const workspaceMenus = {
  CUSTOMER: [['/customer', 'Tổng quan'], ['/profile', 'Hồ sơ của tôi'], ['/addresses', 'Địa chỉ nhận hàng'], ['/orders', 'Đơn hàng của tôi'], ['/checkout', 'Thanh toán']],
  ADMIN: [['/admin', 'Tổng quan'], ['/admin/products', 'Catalog sản phẩm'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Nhật ký kho'], ['/admin/users', 'Người dùng'], ['/admin/vouchers', 'Voucher'], ['/admin/reports', 'Báo cáo'], ['/profile', 'Hồ sơ của tôi']],
  SALES: [['/sales', 'Tổng quan'], ['/sales/orders', 'Xử lý đơn hàng'], ['/sales/returns', 'Trả hàng / hoàn tiền'], ['/profile', 'Hồ sơ của tôi']],
  WAREHOUSE: [['/warehouse', 'Tổng quan'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Nhật ký kho'], ['/profile', 'Hồ sơ của tôi']],
};

const roleIcons = { CUSTOMER: UserRound, ADMIN: LayoutDashboard, SALES: Store, WAREHOUSE: Warehouse };
export const pathIcons = { '/customer': LayoutDashboard, '/admin': LayoutDashboard, '/sales': LayoutDashboard, '/warehouse': LayoutDashboard, '/admin/products': Package, '/warehouse/inventory': Boxes, '/warehouse/history': History, '/admin/users': Users, '/admin/vouchers': Ticket, '/admin/reports': ChartColumn, '/profile': UserRound, '/addresses': MapPin, '/orders': ReceiptText, '/checkout': CreditCard, '/sales/orders': ClipboardList, '/sales/returns': Undo2 };

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

  const content = <main className="hc-main"><Outlet /></main>;
  return <div className={`hc-app${staff ? ' hc-app--staff' : ''}`}>{!staff && <Header />}<div className="hc-app-body">
    <aside className="hc-sidebar"><div className="hc-role"><span className="hc-role-icon" aria-hidden="true"><RoleIcon size={22} /></span><span><small>KHÔNG GIAN LÀM VIỆC</small><strong>{roleLabels[user.role]}</strong></span></div><nav aria-label={`Menu ${roleLabels[user.role]}`}>{workspaceMenus[user.role].map(([path, title]) => { const Icon = staff && pathIcons[path]; return <NavLink key={path} end={['/customer', '/admin', '/sales', '/warehouse'].includes(path)} to={path}>{Icon && <Icon size={18} aria-hidden="true" />}{title}</NavLink>; })}</nav><button className="hc-logout" type="button" disabled={busy} onClick={handleLogout}><LogOut size={17} aria-hidden="true" />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>{error && <p className="hc-error" role="alert">{error}</p>}</aside>
    {staff ? <div className="hc-stage"><header className="hc-topbar"><span className="hc-topbar-avatar" aria-hidden="true">{user.fullName.trim().charAt(0).toUpperCase()}</span><span className="hc-topbar-user"><strong>{user.fullName}</strong><small>{roleLabels[user.role]}</small></span><Link className="hc-topbar-link" to="/profile">Hồ sơ</Link></header>{content}</div> : content}
  </div></div>;
}
