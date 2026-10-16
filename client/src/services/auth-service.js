import { requestApi } from './http-client.js';

const post = (path, body) => requestApi(path, { method: 'POST', body });
export const getSession = () => requestApi('/auth/me');
export const login = values => post('/auth/login', values);
export const loginStaff = values => post('/auth/staff/login', values);
export const register = values => post('/auth/register', values);
export const changePassword = values => post('/auth/password/change', values);
export const requestPasswordReset = contact => post('/auth/password-reset/request', { contact });
export const verifyPasswordReset = values => post('/auth/password-reset/verify', values);
export const confirmPasswordReset = values => post('/auth/password-reset/confirm', values);
export const logout = () => post('/auth/logout');

// Tài khoản giả từ server/db/seeds/001_auth_demo_users.sql, chỉ gợi ý khi chạy Vite dev.
export const demoAccounts = import.meta.env?.DEV ? ['customer', 'admin', 'sales', 'warehouse'].map(role => ({ role: role.toUpperCase(), email: `${role}@example.test` })) : [];
export const demoPassword = 'Demo@1234567890!';
