import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { Icon } from '../../components/order/OrderParts.jsx';
import OrderHistory from './OrderHistory.jsx';
import Checkout from './Checkout.jsx';
import SalesOrders from '../sales/SalesOrders.jsx';
import './order-workspace.css';

// Dựng các màn đơn hàng bằng state React để luồng giao diện có thể thao tác liền mạch.
export default function OrderWorkspace({ orders, setOrders, cart, setCart }) {
  const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0 });
  const [routeDirection, setRouteDirection] = useState('forward');
  const location = useLocation();
  const { orderId } = useParams();
  const navRef = useRef(null);
  const navLinks = useRef({});
  const previousPath = useRef(location.pathname);

  const sectionIndex = path => path.startsWith('/checkout') ? 0 : path.startsWith('/sales') ? 2 : 1;

  useLayoutEffect(() => {
    const activeKey = location.pathname.startsWith('/checkout') ? 'checkout' : location.pathname.startsWith('/sales') ? 'sales' : 'orders';
    const activeLink = navLinks.current[activeKey];
    if (!activeLink) return undefined;

    if (previousPath.current !== location.pathname) {
      setRouteDirection(sectionIndex(location.pathname) >= sectionIndex(previousPath.current) ? 'forward' : 'backward');
      previousPath.current = location.pathname;
    }

    const updateIndicator = () => setNavIndicator({ left: activeLink.offsetLeft, width: activeLink.offsetWidth });
    updateIndicator();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateIndicator);
    observer?.observe(navRef.current);
    observer?.observe(activeLink);
    window.addEventListener('resize', updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [location.pathname]);

  useEffect(() => {
    document.title = `${location.pathname.startsWith('/sales') ? 'Xử lý đơn hàng' : location.pathname === '/checkout' ? 'Thanh toán' : 'Đơn hàng của tôi'} · HomeCare`;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const content = location.pathname === '/checkout'
    ? <Checkout cart={cart} orders={orders} />
    : location.pathname === '/sales/orders'
      ? <SalesOrders orders={orders} setOrders={setOrders} />
      : <OrderHistory orders={orders} setOrders={setOrders} setCart={setCart} detail={Boolean(orderId)} />;

  return <div className="order-app">
    <div className="oc-announcement">Bản giao diện thử nghiệm <span>· Đơn hàng và trạng thái hiện là dữ liệu mẫu</span></div>
    <header className="oc-header"><div className="oc-header-inner">
      <Link className="oc-brand" to="/orders"><span className="oc-brand-mark"><i /><i /><i /><i /></span><span><strong>HomeCare</strong><small>Thiết bị tốt – Chăm sóc tận tâm</small></span></Link>
      <nav ref={navRef} aria-label="Điều hướng"><NavLink ref={element => { navLinks.current.checkout = element; }} to="/checkout"><Icon name="bag" size={17} />Thanh toán</NavLink><NavLink ref={element => { navLinks.current.orders = element; }} to="/orders"><Icon name="box" size={17} />Đơn hàng</NavLink><NavLink ref={element => { navLinks.current.sales = element; }} to="/sales/orders"><Icon name="user" size={17} />Nhân viên</NavLink><span className="oc-nav-indicator" aria-hidden="true" style={{ width: `${navIndicator.width}px`, transform: `translateX(${navIndicator.left}px)` }} /></nav>
      <Link className="oc-account" to="/login"><span><Icon name="user" size={17} /></span>Tài khoản</Link>
    </div></header>
    <div key={location.pathname} className={`oc-route-panel oc-route-panel--${routeDirection}`}>
      {content}
    </div>
    <footer className="oc-footer">
      <div><Link className="oc-brand" to="/orders"><span className="oc-brand-mark"><i /><i /><i /><i /></span><span><strong>HomeCare</strong><small>Thiết bị tốt – Chăm sóc tận tâm</small></span></Link><p>Chọn điều hữu ích cho tổ ấm của bạn.</p></div>
      <div><strong>MUA SẮM</strong><Link to="/checkout">Thanh toán</Link><Link to="/orders">Đơn hàng của tôi</Link></div>
      <div><strong>CHĂM SÓC KHÁCH HÀNG</strong><span>1800 6868</span><span>Thứ 2–Thứ 7 · 8:00–21:00</span></div>
      <small>© 2026 HomeCare</small>
    </footer>
  </div>;
}
