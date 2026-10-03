import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import LoginForm from "./pages/login-form/LoginForm.jsx";
import StaffLogin from "./pages/staff-login/StaffLogin.jsx";
import OrderWorkspace from "./pages/customer/OrderWorkspace.jsx";
import { initialCart, initialOrders } from "./services/order-ui-data.js";

export default function App() {
  const [orders, setOrders] = useState(initialOrders);
  const [cart, setCart] = useState(initialCart);
  const orderWorkspace = <OrderWorkspace orders={orders} setOrders={setOrders} cart={cart} setCart={setCart} />;

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
