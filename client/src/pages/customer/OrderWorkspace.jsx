import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import CustomerRoute from '../../routes/CustomerRoute.jsx';
import { getCustomerOrders } from '../../services/order-ui-data.js';
import OrderHistory from './OrderHistory.jsx';
import Checkout from './Checkout.jsx';
import PaymentResult from './PaymentResult.jsx';
import Cart from './Cart.jsx';
import SalesOrders from '../sales/SalesOrders.jsx';
import './order-workspace.css';

// Dùng layout storefront cho khách; trang nhân viên nằm trong AppShell (route riêng).
export default function OrderWorkspace({ orders, cart } = {}) {
  const location = useLocation();
  const { orderId } = useParams();
  const { user } = useCustomerAuth();
  const isSales = location.pathname.startsWith('/sales/');
  const isCheckout = location.pathname === '/checkout';
  const isPaymentResult = location.pathname === '/payment/result';
  const isCart = location.pathname === '/cart';
  // Snapshot tùy chọn chỉ phục vụ SSR/test; App thật tải dữ liệu qua service.
  const customerOrders = orders ? getCustomerOrders(orders, user?.id) : undefined;

  useEffect(() => {
    document.title = `${isSales ? 'Xử lý đơn hàng' : isCheckout ? 'Thanh toán' : 'Đơn hàng của tôi'} · HomeCare`;
    window.scrollTo(0, 0);
  }, [location.pathname, isSales, isCheckout]);

  if (isSales) return <div className="order-app"><SalesOrders initialOrders={orders} /></div>;

  return <><Header /><div className="order-app order-app--storefront">
    <div key={location.pathname} className="oc-route-panel oc-route-panel--forward">
      <CustomerRoute>{isCart ? <Cart /> : isPaymentResult ? <PaymentResult /> : isCheckout ? <Checkout key={user?.id} initialCart={cart} /> :
        <OrderHistory key={`${user?.id ?? 'guest'}-${orderId ?? 'list'}`} initialOrders={customerOrders} detail={Boolean(orderId)} />
      }</CustomerRoute>
    </div>
  </div><Footer /></>;
}
