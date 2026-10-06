import { Menu, ShoppingCart, User, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { roleHome, useAuth } from '../context/auth-context.js';

// Điều hướng công khai và tài khoản; menu mobile dùng state React.
export default function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return <header className="hc-header">
    <div className="hc-header-inner">
      <Link className="hc-brand" to="/" onClick={() => setOpen(false)}><span className="hc-brand-mark">H</span><span><strong>HomeCare</strong><small>Thiết bị tốt – Chăm sóc tận tâm</small></span></Link>
      <nav className="hc-shop-nav" aria-label="Mua sắm"><NavLink to="/" end>Trang chủ</NavLink><NavLink to="/products">Sản phẩm</NavLink><Link to={user ? roleHome[user.role] : '/login'}>Không gian của tôi</Link></nav>
      <div className="hc-header-actions">{(!user || user.role === 'CUSTOMER') && <Link to="/checkout" aria-label="Đến thanh toán"><ShoppingCart size={19} /></Link>}<Link to={user ? '/profile' : '/login'} aria-label={user ? `Hồ sơ của ${user.fullName}` : 'Đăng nhập'}><User size={18} /><span>{user ? user.fullName : 'Đăng nhập'}</span></Link><button type="button" className="hc-menu-toggle" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button></div>
    </div>
    {open && <nav className="hc-mobile-menu" id="mobile-menu" aria-label="Mua sắm trên điện thoại"><Link to="/" onClick={() => setOpen(false)}>Trang chủ</Link><Link to="/products" onClick={() => setOpen(false)}>Sản phẩm</Link><Link to={user ? roleHome[user.role] : '/login'} onClick={() => setOpen(false)}>Không gian của tôi</Link></nav>}
  </header>;
}
