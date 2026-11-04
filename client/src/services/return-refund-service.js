import { ApiError, createApiClient } from './api-client.js';

const statuses = ['requested', 'pending_manager', 'approved', 'rejected', 'refunded'];
const severities = ['minor', 'major', 'critical'];
const isId = value => typeof value === 'string' && value.length > 0;
const badResponse = () => { throw new ApiError('Dữ liệu trả hàng từ máy chủ không đúng hợp đồng.', 200, 'INVALID_API_RESPONSE'); };

// Validate the API boundary so a stale or partial response cannot show a false approval/refund state.
function mapReturn(item, detail = false) {
  if (!isId(item?.id) || !isId(item.orderId) || !statuses.includes(item.status) || typeof item.reason !== 'string' || Number.isNaN(Date.parse(item.createdAt))) badResponse();
  if (item.severity !== null && !severities.includes(item.severity)) badResponse();
  if (detail && (!item.order || !Array.isArray(item.order.items) || !Array.isArray(item.history) || !item.customer)) badResponse();
  return item;
}

// Customer and staff return actions share the configured HTTP client and idempotency contract.
export function createReturnRefundService(request = createApiClient()) {
  const pathId = id => encodeURIComponent(String(id));
  const mutate = (path, body, { idempotencyKey, signal } = {}) => {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new ApiError('Thiếu mã chống gửi lặp.', 422, 'IDEMPOTENCY_KEY_REQUIRED');
    return request(path, { method: 'POST', body, idempotencyKey, signal });
  };
  return {
    list: async ({ status = '', severity = '', search = '', page = 1, pageSize = 10, signal } = {}) => {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) query.set('status', status);
      if (severity) query.set('severity', severity);
      if (search.trim()) query.set('search', search.trim());
      const result = await request(`/returns?${query}`, { signal });
      if (!Array.isArray(result?.items) || !result.pagination || !result.items.every(item => mapReturn(item)) || !Number.isSafeInteger(result.pagination.totalPages)) badResponse();
      return result;
    },
    detail: async (id, options) => mapReturn(await request(`/returns/${pathId(id)}`, options), true),
    triage: async (id, input, options) => mapReturn(await mutate(`/sales/returns/${pathId(id)}/triage`, input, options), true),
    decide: async (id, input, options) => mapReturn(await mutate(`/admin/returns/${pathId(id)}/decision`, input, options), true),
    receive: async (id, input, options) => mapReturn(await mutate(`/warehouse/returns/${pathId(id)}/receive`, input, options), true),
  };
}
