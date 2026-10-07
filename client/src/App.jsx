import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import LoginForm from "./pages/login-form/LoginForm.jsx";
import StaffLogin from "./pages/staff-login/StaffLogin.jsx";
import OrderWorkspace from "./pages/customer/OrderWorkspace.jsx";
import { CustomerAuthProvider } from "./context/CustomerAuthContext.jsx";
import { OrderServiceProvider } from "./context/OrderServiceContext.jsx";

export default function App() {
  const orderWorkspace = <OrderWorkspace />;

  return (
    <BrowserRouter><CustomerAuthProvider><OrderServiceProvider>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/internal/login" element={<StaffLogin />} />
        <Route path="/internal" element={<Navigate to="/internal/login" replace />} />
        <Route path="/checkout" element={orderWorkspace} />
        <Route path="/orders" element={orderWorkspace} />
        <Route path="/orders/:orderId" element={orderWorkspace} />
        <Route path="/sales/orders" element={orderWorkspace} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </OrderServiceProvider></CustomerAuthProvider></BrowserRouter>
  );
}
