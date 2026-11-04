import { useEffect, useRef, useState } from 'react';
import { getSession, logout } from '../services/auth-service.js';
import { AuthContext } from './auth-context.js';

// Dùng chung phiên cho shell, guard và đăng nhập; tự xóa trạng thái khi hết hạn.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshRequest = useRef(null);

  // Đọc lại phiên sau đăng nhập hoặc cập nhật hồ sơ để shell hiển thị dữ liệu mới.
  async function refreshSession() {
    if (refreshRequest.current) return refreshRequest.current;
    setLoading(true);
    setError('');
    const request = getSession().then(next => {
      setSession(next);
      return next;
    }).catch(failure => {
      setSession(null);
      setError(failure.message || 'Chưa thể kiểm tra phiên đăng nhập.');
      throw failure;
    }).finally(() => {
      refreshRequest.current = null;
      setLoading(false);
    });
    refreshRequest.current = request;
    return request;
  }

  useEffect(() => {
    let active = true;
    getSession().then(next => { if (active) setSession(next); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session?.user || !session.expiresAt) return undefined;
    const timer = setTimeout(() => setSession(null), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  // Chỉ xóa trạng thái UI sau khi service đã vô hiệu hóa phiên thành công.
  async function signOut() { await logout(); setSession(null); }

  return <AuthContext.Provider value={{ user: session?.user || null, loading, error, refreshSession, signOut }}>{children}</AuthContext.Provider>;
}
