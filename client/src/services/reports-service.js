import { API_BASE_URL, ApiError } from './api-client.js';

// Download an authenticated CSV response without weakening the normal JSON API contract.
export async function downloadRevenueCsv(from, to, { fetchImpl = (...args) => fetch(...args) } = {}) {
  const query = new URLSearchParams({ from, to });
  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/admin/reports/revenue.csv?${query}`, { credentials: 'include', cache: 'no-store', headers: { Accept: 'text/csv' } });
  } catch {
    throw new ApiError('Không thể kết nối máy chủ để tải báo cáo.', 0, 'NETWORK_ERROR');
  }
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new ApiError(result?.message || 'Không thể tải báo cáo doanh thu.', response.status, result?.errors?.code || `HTTP_${response.status}`);
  }
  if (!response.headers.get('content-type')?.includes('text/csv')) throw new ApiError('Máy chủ không trả về tệp CSV hợp lệ.', response.status, 'INVALID_REPORT_RESPONSE');
  return response.blob();
}
