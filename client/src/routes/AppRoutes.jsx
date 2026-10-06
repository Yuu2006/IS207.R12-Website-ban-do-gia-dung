import { useState } from 'react';
import { Routes, Route, Outlet, Navigate, Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import HomePage from '../pages/public/HomePage.jsx';
import ProductListPage from '../pages/public/ProductListPage.jsx';
import ProductDetailPage from '../pages/public/ProductDetailPage.jsx';
import LoginForm from '../pages/login-form/LoginForm.jsx';
import StaffLogin from '../pages/staff-login/StaffLogin.jsx';
import OrderWorkspace from '../pages/customer/OrderWorkspace.jsx';
import ProfilePage from '../pages/customer/ProfilePage.jsx';
import AddressesPage from '../pages/customer/AddressesPage.jsx';
import WorkspacePage from '../pages/auth/WorkspacePage.jsx';
import AppShell from '../layouts/AppShell.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import { initialCart, initialOrders } from '../services/order-ui-data.js';

function PublicLayout() { return <><Header /><Outlet /><Footer /></>; }

// Giữ route đã tích hợp và đặt guard theo role trước mọi workspace.
export default function AppRoutes() {
  const [orders, setOrders] = useState(initialOrders);
  const [cart, setCart] = useState(initialCart);
  const orderWorkspace = <OrderWorkspace orders={orders} setOrders={setOrders} cart={cart} setCart={setCart} />;
  return <Routes>
    <Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /><Route path="/products" element={<ProductListPage />} /><Route path="/products/:id" element={<ProductDetailPage />} /></Route>
    <Route path="/login" element={<LoginForm key="login" />} /><Route path="/register" element={<LoginForm key="register" initialScreen="register" />} /><Route path="/internal/login" element={<StaffLogin />} /><Route path="/internal" element={<Navigate to="/internal/login" replace />} />
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="/profile" element={<ProfilePage />} />
      <Route element={<ProtectedRoute roles={['CUSTOMER']} />}><Route path="/customer" element={<WorkspacePage />} /><Route path="/addresses" element={<AddressesPage />} />{['/checkout', '/orders', '/orders/:orderId'].map(path => <Route key={path} path={path} element={orderWorkspace} />)}</Route>
      <Route element={<ProtectedRoute roles={['ADMIN']} />}><Route path="/admin" element={<WorkspacePage />} />{['products', 'users', 'vouchers', 'reports'].map(name => <Route key={name} path={'/admin/' + name} element={<WorkspacePage />} />)}</Route>
      <Route element={<ProtectedRoute roles={['SALES']} />}><Route path="/sales" element={<WorkspacePage />} /><Route path="/sales/orders" element={orderWorkspace} /><Route path="/sales/returns" element={<WorkspacePage />} /></Route>
      <Route element={<ProtectedRoute roles={['WAREHOUSE']} />}><Route path="/warehouse" element={<WorkspacePage />} /><Route path="/warehouse/inventory" element={<WorkspacePage />} /><Route path="/warehouse/history" element={<WorkspacePage />} /></Route>
    </Route></Route>
    <Route path="*" element={<div className="hc-status"><h1>Không tìm thấy trang</h1><Link to="/">Về trang chủ</Link></div>} />
  </Routes>;
}
