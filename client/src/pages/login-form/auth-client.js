import { demoMode } from '../../services/auth-service.js';
export { requestCustomerOtp, verifyCustomerOtp } from '../../services/auth-service.js';
export const isDemoAuth = () => demoMode;
