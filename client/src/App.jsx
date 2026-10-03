import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import LoginForm from "./pages/login-form/LoginForm.jsx";
import StaffLogin from "./pages/staff-login/StaffLogin.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/internal/login" element={<StaffLogin />} />
        <Route path="/internal" element={<Navigate to="/internal/login" replace />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}