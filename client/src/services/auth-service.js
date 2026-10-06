import { demoMode, requestApi } from './http-client.js';
import { getDemoSession, loginDemoStaff, logoutDemo, requestDemoOtp, verifyDemoOtp } from './demo-service.js';

export { demoMode };
export const getSession = () => demoMode ? getDemoSession() : requestApi('/auth/me');
export const loginStaff = values => demoMode ? loginDemoStaff(values) : requestApi('/auth/staff/login', { method: 'POST', body: values });
export const requestCustomerOtp = values => demoMode ? requestDemoOtp(values) : requestApi('/auth/customer/otp/request', { method: 'POST', body: values });
export const verifyCustomerOtp = values => demoMode ? verifyDemoOtp(values) : requestApi('/auth/customer/otp/verify', { method: 'POST', body: values });
export const logout = () => demoMode ? logoutDemo() : requestApi('/auth/logout', { method: 'POST' });
