import { ArrowUpRight } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { roleHome, roleLabels, useAuth } from '../../context/auth-context.js';
import { workspaceMenus } from '../../layouts/AppShell.jsx';

// Trang tổng quan và placeholder ghi đúng mức hoàn thành của từng menu.
export default function WorkspacePage() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const menu = workspaceMenus[user.role];
  const title = menu.find(([path]) => path === pathname)?.[1] || 'Không gian của tôi';
  const overview = pathname === roleHome[user.role];
  useEffect(() => { document.title = `${title} · HomeCare`; }, [title]);
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">{roleLabels[user.role]}</span><h1>{overview ? `Chào ${user.fullName}` : title}</h1><p>{overview ? 'Quản lý tài khoản và truy cập các chức năng dành cho bạn.' : 'Khung trang đã sẵn sàng. Nghiệp vụ của module này chưa được triển khai.'}</p></div><div className="hc-shortcuts">{menu.filter(([path]) => path !== pathname).map(([path, name]) => <Link key={path} to={path}><strong>{name}</strong><ArrowUpRight size={20} /><small>{['/profile', '/addresses'].includes(path) ? 'Quản lý dữ liệu tài khoản' : path.includes('orders') || path === '/checkout' ? 'Giao diện đơn hàng thử nghiệm' : ['/admin/products', '/warehouse/inventory', '/warehouse/history'].includes(path) ? 'Quản lý dữ liệu thật' : 'Khung chức năng'}</small></Link>)}</div></section>;
}
