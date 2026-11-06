import { requestApi } from './http-client.js';

// Customer device records and maintenance cycles always use the authenticated session on the server.
export const careService = {
  listDevices: ({ status = 'ACTIVE', page = 1, pageSize = 20 } = {}) => requestApi(`/api/owned-devices?${new URLSearchParams({ status, page, pageSize })}`),
  getDevice: id => requestApi(`/api/owned-devices/${encodeURIComponent(id)}`),
  updateDevice: (id, values) => requestApi(`/api/owned-devices/${encodeURIComponent(id)}`, { method: 'PATCH', body: values }),
  listTasks: deviceId => requestApi(`/api/owned-devices/${encodeURIComponent(deviceId)}/care-tasks`),
  completeTask: taskId => requestApi(`/api/care-tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', body: {} }),
  postponeTask: (taskId, values) => requestApi(`/api/care-tasks/${encodeURIComponent(taskId)}/postpone`, { method: 'POST', body: values }),
  listRules: () => requestApi('/api/admin/care-rules'),
  listSupplyOptions: query => requestApi(`/api/admin/care-supply-options${query ? `?${new URLSearchParams({ q: query })}` : ''}`),
  createRule: values => requestApi('/api/admin/care-rules', { method: 'POST', body: values }),
  updateRule: (id, values) => requestApi(`/api/admin/care-rules/${encodeURIComponent(id)}`, { method: 'PATCH', body: values }),
};
