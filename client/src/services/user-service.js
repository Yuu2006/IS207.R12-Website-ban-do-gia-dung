import { demoMode, requestApi } from './http-client.js';
import { getDemoProfile, updateDemoProfile, listDemoAddresses, saveDemoAddress, deleteDemoAddress } from './demo-service.js';

export { profileErrors, addressErrors } from './demo-service.js';
export const getProfile = () => demoMode ? getDemoProfile() : requestApi('/users/me');
export const updateProfile = values => demoMode ? updateDemoProfile(values) : requestApi('/users/me', { method: 'PATCH', body: values });
export const listAddresses = () => demoMode ? listDemoAddresses() : requestApi('/users/me/addresses');
export const saveAddress = (id, values) => demoMode ? saveDemoAddress(id, values) : requestApi(`/users/me/addresses${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: values });
export const deleteAddress = id => demoMode ? deleteDemoAddress(id) : requestApi(`/users/me/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
