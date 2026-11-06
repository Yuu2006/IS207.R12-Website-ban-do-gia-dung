import { createApiClient } from './api-client.js';

const request = createApiClient();
export const paymentMethods = options => request('/payments/methods', options);
export const paymentStatus = (id, staff = false, options) => request(`/${staff ? 'sales/orders' : 'orders'}/${encodeURIComponent(id)}/payment`, options);
export const paymentByReference = (reference, options) => request(`/payments/reference/${encodeURIComponent(reference)}`, options);
export const confirmBankTransfer = (id, body, options) => request(`/sales/orders/${encodeURIComponent(id)}/payment/confirm-transfer`, { ...options, method: 'POST', body });
export const orderDocument = (id, staff, type) => request(`/${staff ? 'sales/orders' : 'orders'}/${encodeURIComponent(id)}/document${staff ? `/${type.toLowerCase()}` : ''}`);
