import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Boxes, CalendarClock, ChartColumn, ClipboardList, CreditCard, Heart, History, House, LayoutDashboard, LogOut, MapPin, Menu, MessageCircleQuestion, Package, PackageCheck, ReceiptText, Ruler, Store, Ticket, Undo2, UserRound, Users, Warehouse, X } from 'lucide-react';
import Header from '../components/Header.jsx';
import { roleLabels, useAuth } from '../context/auth-context.js';

// Nguồn duy nhất cho menu và quyền xem tab; ProtectedRoute trong AppRoutes dùng cùng danh sách vai trò.
export const workspaceMenus = {
  CUSTOMER: [['/customer', 'Tổng quan'], ['/customer/decision-tools', 'Không gian & thiết bị'], ['/customer/devices', 'Thiết bị của tôi'], ['/profile', 'Hồ sơ của tôi'], ['/addresses', 'Địa chỉ nhận hàng'], ['/wishlist', 'Sản phẩm yêu thích'], ['/orders', 'Đơn hàng của tôi'], ['/checkout', 'Thanh toán']],
  ADMIN: [['/admin', 'Tổng quan'], ['/admin/fit-rules', 'Quy tắc FitCheck'], ['/admin/care-rules', 'Chu kỳ bảo trì'], ['/admin/chatbot-faqs', 'FAQ chatbot'], ['/admin/products', 'Catalog sản phẩm'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Nhật ký kho'], ['/admin/users', 'Người dùng'], ['/admin/vouchers', 'Voucher'], ['/admin/reports', 'Báo cáo'], ['/sales/orders', 'Xử lý đơn hàng'], ['/sales/returns', 'Trả hàng / hoàn tiền'], ['/profile', 'Hồ sơ của tôi']],
  SALES: [['/sales', 'Tổng quan'], ['/sales/orders', 'Xử lý đơn hàng'], ['/sales/returns', 'Trả hàng / hoàn tiền'], ['/profile', 'Hồ sơ của tôi']],
  WAREHOUSE: [['/warehouse', 'Tổng quan'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Nhật ký kho'], ['/warehouse/returns', 'Nhận hàng trả'], ['/profile', 'Hồ sơ của tôi']],
};

const roleIcons = { CUSTOMER: UserRound, ADMIN: LayoutDashboard, SALES: Store, WAREHOUSE: Warehouse };
export const pathIcons = { '/customer/decision-tools': House, '/customer/devices': PackageCheck, '/admin/care-rules': CalendarClock, '/admin/chatbot-faqs': MessageCircleQuestion, '/admin/fit-rules': Ruler, '/customer': LayoutDashboard, '/admin': LayoutDashboard, '/sales': LayoutDashboard, '/warehouse': LayoutDashboard, '/admin/products': Package, '/warehouse/inventory': Boxes, '/warehouse/history': History, '/warehouse/returns': Undo2, '/admin/users': Users, '/admin/vouchers': Ticket, '/admin/reports': ChartColumn, '/profile': UserRound, '/addresses': MapPin, '/wishlist': Heart, '/orders': ReceiptText, '/checkout': CreditCard, '/sales/orders': ClipboardList, '/sales/returns': Undo2 };
const overviewPaths = ['/customer', '/admin', '/sales', '/warehouse'];

// Font của template chỉ nạp khi vào khu nhân viên để giao diện khách không đổi.
function useStaffFont(enabled) {
  useEffect(() => {
    if (!enabled || document.getElementById('hc-staff-font')) return;
    const link = Object.assign(document.createElement('link'), { id: 'hc-staff-font', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap' });
    document.head.append(link);
  }, [enabled]);
}

// Shell dùng chung cho bốn vai trò; nhân viên không dùng thanh điều hướng cửa hàng, chỉ menu được phép.
export default function AppShell() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const staff = user.role !== 'CUSTOMER';
  const RoleIcon = roleIcons[user.role];
  useStaffFont(staff);
  useEffect(() => { setOpen(false); }, [pathname]);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try { await signOut(); navigate('/login', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const nav = <nav id="hc-side-nav" aria-label={`Menu ${roleLabels[user.role]}`}>{workspaceMenus[user.role].map(([path, title]) => { const Icon = staff && pathIcons[path]; return <NavLink key={path} end={overviewPaths.includes(path)} to={path}>{Icon && <Icon size={20} aria-hidden="true" />}{title}</NavLink>; })}</nav>;
  const logout = <div className={staff ? 'ad-logout' : undefined}><button className="hc-logout" type="button" disabled={busy} onClick={handleLogout}><LogOut size={staff ? 20 : 17} aria-hidden="true" />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div>;

  return <div className={`hc-app${staff ? ' hc-app--staff' : ''}`}>{!staff && <Header />}<div className="hc-app-body">
    <aside className={`hc-sidebar${open ? ' is-open' : ''}`}>{staff
      ? <div className="ad-brand"><span className="ad-brand-mark" aria-hidden="true"><House size={20} /></span><span><strong>{roleLabels[user.role]}</strong><small>Bảng điều khiển</small></span>
        <button className="ad-menu-toggle" type="button" aria-expanded={open} aria-controls="hc-side-nav" aria-label={open ? 'Đóng menu' : 'Mở menu'} onClick={() => setOpen(current => !current)}>{open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}</button></div>
      : <div className="hc-role"><span className="hc-role-icon" aria-hidden="true"><RoleIcon size={22} /></span><span><small>KHÔNG GIAN LÀM VIỆC</small><strong>{roleLabels[user.role]}</strong></span></div>}
      {staff ? <div className="ad-side-body">{nav}{logout}</div> : <>{nav}{logout}</>}
      {error && <p className="hc-error" role="alert">{error}</p>}</aside>
    <main className="hc-main"><Outlet /></main>
  </div></div>;
}
