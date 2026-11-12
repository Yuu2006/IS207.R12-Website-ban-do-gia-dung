import { requestApi } from './http-client.js';

// Admin account operations stay in the shared API client so session cookies and CSRF are handled consistently.
export function listManagedUsers(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== undefined) query.set(key, String(value));
  return requestApi(`/admin/users?${query}`);
}

export const createManagedUser = values => requestApi('/admin/users', { method: 'POST', body: values });
export const updateManagedUser = (id, values) => requestApi(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: values });
export const setManagedUserStatus = (id, status, reason) => requestApi(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, reason } });
