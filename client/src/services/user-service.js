import { requestApi } from './http-client.js';

export const getProfile = () => requestApi('/users/me');
export const updateProfile = values => requestApi('/users/me', { method: 'PATCH', body: values });
export const listAddresses = () => requestApi('/users/me/addresses');
export const saveAddress = (id, values) => requestApi(`/users/me/addresses${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: values });
export const deleteAddress = id => requestApi(`/users/me/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
