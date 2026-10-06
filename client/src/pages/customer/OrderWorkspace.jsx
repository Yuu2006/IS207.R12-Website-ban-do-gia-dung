import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import OrderHistory from './OrderHistory.jsx';
import Checkout from './Checkout.jsx';
import SalesOrders from '../sales/SalesOrders.jsx';
import './order-workspace.css';

// Giữ các thao tác đơn hàng mẫu và dùng shell/guard chung của ứng dụng.
export default function OrderWorkspace({ orders, setOrders, cart, setCart }) {
  const location = useLocation();
  const { orderId } = useParams();
  useEffect(() => {
    document.title = `${location.pathname.startsWith('/sales') ? 'Xử lý đơn hàng' : location.pathname === '/checkout' ? 'Thanh toán' : 'Đơn hàng của tôi'} · HomeCare`;
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const content = location.pathname === '/checkout' ? <Checkout cart={cart} orders={orders} /> : location.pathname === '/sales/orders' ? <SalesOrders orders={orders} setOrders={setOrders} /> : <OrderHistory orders={orders} setOrders={setOrders} setCart={setCart} detail={Boolean(orderId)} />;
  return <div className="order-app"><p className="hc-muted">Đơn hàng và thanh toán hiện là dữ liệu giao diện mẫu.</p><div key={location.pathname} className="oc-route-panel">{content}</div></div>;
}
