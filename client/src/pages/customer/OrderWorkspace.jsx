import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import CustomerRoute from '../../routes/CustomerRoute.jsx';
import { getCustomerOrders } from '../../services/order-ui-data.js';
import OrderHistory from './OrderHistory.jsx';
import Checkout from './Checkout.jsx';
import SalesOrders from '../sales/SalesOrders.jsx';
import './order-workspace.css';

// Dùng layout storefront cho khách; checkout và nhân viên là các trang độc lập.
export default function OrderWorkspace({ orders, cart } = {}) {
  const location = useLocation();
  const { orderId } = useParams();
  const { user } = useCustomerAuth();
  const isSales = location.pathname.startsWith('/sales/');
  const isCheckout = location.pathname === '/checkout';
  // Snapshot tùy chọn chỉ phục vụ SSR/test; App thật tải dữ liệu qua service.
  const customerOrders = orders ? getCustomerOrders(orders, user?.id) : undefined;

  useEffect(() => {
    document.title = `${isSales ? 'Xử lý đơn hàng' : isCheckout ? 'Thanh toán' : 'Đơn hàng của tôi'} · HomeCare`;
    window.scrollTo(0, 0);
  }, [location.pathname, isSales, isCheckout]);

  if (isSales) return <div className="order-app">
    <header className="oc-header"><div className="oc-header-inner">
      <Link className="oc-brand" to="/internal/login"><strong>HomeCare</strong></Link>
      <span className="oc-staff-label">Không gian nhân viên · Xử lý đơn hàng</span>
      <Link className="oc-account" to="/internal/login">Tài khoản nhân viên</Link>
    </div></header>
    <SalesOrders initialOrders={orders} />
  </div>;

  return <><Header /><div className="order-app order-app--storefront">
    <div key={location.pathname} className="oc-route-panel oc-route-panel--forward">
      <CustomerRoute>{isCheckout ? <Checkout key={user?.id} initialCart={cart} /> :
        <OrderHistory key={`${user?.id ?? 'guest'}-${orderId ?? 'list'}`} initialOrders={customerOrders} detail={Boolean(orderId)} />
      }</CustomerRoute>
    </div>
  </div><Footer /></>;
}
