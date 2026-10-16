import { createContext, useContext } from 'react';
import { AuthContext } from './auth-context.js';

// Test SSR có thể cấp giá trị trực tiếp; ứng dụng dùng chung phiên AuthProvider (TV1), không có phiên khách riêng.
export const CustomerAuthContext = createContext(null);

// Adapter giữ API cũ { user, status, error, refreshSession, signOut } cho trang đơn hàng.
export function useCustomerAuth() {
  const override = useContext(CustomerAuthContext);
  const auth = useContext(AuthContext);
  if (override) return override;
  if (!auth) throw new Error('AuthProvider is required.');
  const status = auth.loading ? 'loading' : auth.error ? 'error' : auth.user ? 'authenticated' : 'anonymous';
  return { user: auth.user, status, error: auth.error, refreshSession: auth.refreshSession, signOut: auth.signOut };
}
