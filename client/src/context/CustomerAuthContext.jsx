import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getCustomerSession, signOutCustomer } from '../pages/login-form/auth-client.js';

export const CustomerAuthContext = createContext(null);

// Chia sẻ phiên đã xác nhận với Header, đăng nhập và route đơn hàng.
export function CustomerAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const refreshSession = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus('loading');
    setError('');
    try {
      const current = await getCustomerSession();
      if (version !== requestVersion.current) return null;
      setSession(current);
      setStatus(current ? 'authenticated' : 'anonymous');
      return current;
    } catch (failure) {
      if (version !== requestVersion.current) return null;
      setSession(null);
      setStatus('error');
      setError(failure.message || 'Không thể kiểm tra phiên đăng nhập.');
      throw failure;
    }
  }, []);

  useEffect(() => {
    refreshSession().catch(() => {});
    return () => { requestVersion.current += 1; };
  }, [refreshSession]);

  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const timer = window.setTimeout(() => {
      setSession(null);
      setStatus('anonymous');
    }, Math.min(Math.max(0, session.expiresAt - Date.now()), 2147483647));
    return () => window.clearTimeout(timer);
  }, [session]);

  // Không xóa trạng thái đăng nhập thật nếu máy chủ chưa đăng xuất thành công.
  async function signOut() {
    await signOutCustomer();
    requestVersion.current += 1;
    setSession(null);
    setStatus('anonymous');
    setError('');
  }

  return <CustomerAuthContext.Provider value={{ user: session?.user ?? null, status, error, refreshSession, signOut }}>
    {children}
  </CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const auth = useContext(CustomerAuthContext);
  if (!auth) throw new Error('CustomerAuthProvider is required.');
  return auth;
}
