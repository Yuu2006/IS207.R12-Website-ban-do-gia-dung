import { Routes, Route, Outlet, Navigate, Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import ChatbotWidget from '../components/chatbot/ChatbotWidget.jsx';
import HomePage from '../pages/public/HomePage.jsx';
import ProductListPage from '../pages/public/ProductListPage.jsx';
import ProductDetailPage from '../pages/public/ProductDetailPage.jsx';
import ComparePage from '../pages/public/ComparePage.jsx';
import LoginForm from '../pages/login-form/LoginForm.jsx';
import StaffLogin from '../pages/staff-login/StaffLogin.jsx';
import OrderWorkspace from '../pages/customer/OrderWorkspace.jsx';
import ProfilePage from '../pages/customer/ProfilePage.jsx';
import AddressesPage from '../pages/customer/AddressesPage.jsx';
import DecisionToolsPage from '../pages/customer/DecisionToolsPage.jsx';
import FitRulesPreviewPage from '../pages/admin/FitRulesPreviewPage.jsx';
import DashboardPreviewPage from '../pages/admin/DashboardPreviewPage.jsx';
import WorkspacePage from '../pages/auth/WorkspacePage.jsx';
import CatalogAdminPage from '../pages/admin/CatalogAdminPage.jsx';
import StaffOverviewPage from '../pages/auth/StaffOverviewPage.jsx';
import VoucherAdminPage from '../pages/admin/VoucherAdminPage.jsx';
import UserAdminPage from '../pages/admin/UserAdminPage.jsx';
import ReportAdminPage from '../pages/admin/ReportAdminPage.jsx';
import InventoryPage from '../pages/warehouse/InventoryPage.jsx';
import InventoryHistoryPage from '../pages/warehouse/InventoryHistoryPage.jsx';
import AppShell from '../layouts/AppShell.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

function PublicLayout() { return <><Header /><Outlet /><Footer /><ChatbotWidget /></>; }

// Giữ route đã tích hợp và đặt guard theo role trước mọi workspace.
export default function AppRoutes() {
  // Trang đơn hàng khách tự dựng header storefront và CustomerRoute; nhân viên dùng AppShell; tải dữ liệu qua OrderServiceProvider.
  const orderWorkspace = <OrderWorkspace />;
  return <Routes>
    <Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /><Route path="/products" element={<ProductListPage />} /><Route path="/products/:id" element={<ProductDetailPage />} /><Route path="/compare" element={<ComparePage />} /></Route>
    <Route path="/login" element={<LoginForm key="login" />} /><Route path="/register" element={<LoginForm key="register" initialScreen="register" />} /><Route path="/internal/login" element={<StaffLogin />} /><Route path="/forgot-password" element={<StaffLogin audience="customer" />} /><Route path="/internal" element={<Navigate to="/internal/login" replace />} />
    {['/checkout', '/orders', '/orders/:orderId'].map(path => <Route key={path} path={path} element={orderWorkspace} />)}
    <Route element={<ProtectedRoute roles={['SALES', 'ADMIN']} />}><Route element={<AppShell />}><Route path="/sales/orders" element={orderWorkspace} /><Route path="/sales/returns" element={<WorkspacePage />} /></Route></Route>
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="/profile" element={<ProfilePage />} />
      <Route element={<ProtectedRoute roles={['CUSTOMER']} />}><Route path="/customer" element={<WorkspacePage />} /><Route path="/addresses" element={<AddressesPage />} /><Route path="/customer/decision-tools" element={<DecisionToolsPage />} /></Route>
      <Route element={<ProtectedRoute roles={['ADMIN']} />}><Route path="/admin" element={<WorkspacePage />} /><Route path="/admin/dashboard-preview" element={<DashboardPreviewPage />} /><Route path="/admin/fit-rules" element={<FitRulesPreviewPage />} /><Route path="/admin/products" element={<CatalogAdminPage />} /><Route path="/admin/users" element={<UserAdminPage />} /><Route path="/admin/vouchers" element={<VoucherAdminPage />} /><Route path="/admin/reports" element={<ReportAdminPage />} /></Route>
      <Route element={<ProtectedRoute roles={['SALES']} />}><Route path="/sales" element={<StaffOverviewPage />} /></Route>
      <Route element={<ProtectedRoute roles={['WAREHOUSE']} />}><Route path="/warehouse" element={<StaffOverviewPage />} /></Route>
      <Route element={<ProtectedRoute roles={['WAREHOUSE', 'ADMIN']} />}><Route path="/warehouse/inventory" element={<InventoryPage />} /><Route path="/warehouse/history" element={<InventoryHistoryPage />} /></Route>
    </Route></Route>
    <Route path="*" element={<div className="hc-status"><h1>Không tìm thấy trang</h1><Link to="/">Về trang chủ</Link></div>} />
  </Routes>;
}
