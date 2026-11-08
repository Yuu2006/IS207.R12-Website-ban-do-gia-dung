import { requestApi } from './http-client.js';

// Mọi thao tác quản trị dùng cùng cookie/CSRF và lỗi theo trường của HTTP client.
const query = values => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString();

export const getFitRuleOptions = categoryId => requestApi(`/api/admin/fit-rules/options${categoryId ? `?${query({ categoryId })}` : ''}`);
export const listFitRules = filters => requestApi(`/api/admin/fit-rules?${query(filters)}`);
export const getFitRuleVersions = id => requestApi(`/api/admin/fit-rules/${encodeURIComponent(id)}/versions`);
export const createFitRule = values => requestApi('/api/admin/fit-rules', { method: 'POST', body: values });
export const updateFitRule = (id, values) => requestApi(`/api/admin/fit-rules/${encodeURIComponent(id)}`, { method: 'PATCH', body: values });
export const deactivateFitRule = id => requestApi(`/api/admin/fit-rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
