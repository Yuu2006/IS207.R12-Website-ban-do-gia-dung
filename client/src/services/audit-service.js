import { requestApi } from './http-client.js';

// Read the administrator-only, paginated audit log using the backend's allowlisted filters.
export async function getAuditLogs(filters = {}) {
  const query = new URLSearchParams();
  for (const key of ['action', 'entityType', 'actorId', 'from', 'to', 'page', 'pageSize']) {
    const value = filters[key];
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const data = await requestApi(`/admin/audit-logs${query.size ? `?${query}` : ''}`);
  if (!Array.isArray(data?.items) || !data.pagination) throw new Error('Dữ liệu nhật ký không đúng hợp đồng API.');
  return data;
}
