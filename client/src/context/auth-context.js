import { createContext, useContext } from 'react';

// Giữ context tách khỏi component để Fast Refresh không tạo lại context của guard.
export const AuthContext = createContext(null);
export const roleLabels = { CUSTOMER: 'Khách hàng', ADMIN: 'Quản trị viên', SALES: 'Bán hàng', WAREHOUSE: 'Kho hàng' };
export const roleHome = { CUSTOMER: '/customer', ADMIN: '/admin', SALES: '/sales', WAREHOUSE: '/warehouse' };

// Chỉ dùng bên trong AuthProvider để đọc và cập nhật phiên hiện tại.
export function useAuth() { return useContext(AuthContext); }
