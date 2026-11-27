import { requestApi } from './http-client.js';

// Load the signed-in account's inbox and unread count through the shared session client.
export async function getNotifications({ page = 1, pageSize = 20, unreadOnly = false } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), unreadOnly: String(unreadOnly) });
  const data = await requestApi(`/notifications?${query}`);
  if (!Array.isArray(data?.items) || !Number.isSafeInteger(data.unreadCount) || !data.pagination) throw new Error('Dữ liệu thông báo không đúng hợp đồng API.');
  return data;
}

// Mark one owned notification read; the API hides ids belonging to other accounts.
export async function markNotificationRead(id) {
  return requestApi(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} });
}

// Mark only the current account's unread notifications as read.
export async function markAllNotificationsRead() {
  return requestApi('/notifications/read-all', { method: 'POST', body: {} });
}

// Notify app shells to refresh the unread badge after an inbox mutation.
export function announceNotificationsUpdated() {
  window.dispatchEvent(new Event('hc:notifications-updated'));
}
