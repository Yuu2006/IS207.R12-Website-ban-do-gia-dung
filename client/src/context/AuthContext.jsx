import { useEffect, useState } from 'react';
import { getSession, logout } from '../services/auth-service.js';
import { AuthContext } from './auth-context.js';

// Dùng chung phiên cho shell, guard và đăng nhập; tự xóa trạng thái khi hết hạn.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Đọc lại phiên sau đăng nhập hoặc cập nhật hồ sơ để shell hiển thị dữ liệu mới.
  async function refreshSession() {
    const next = await getSession();
    setSession(next);
    setError('');
    return next;
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

  return <AuthContext.Provider value={{ user: session?.user || null, demo: Boolean(session?.demo), loading, error, refreshSession, signOut }}>{children}</AuthContext.Provider>;
}
