export const API_BASE_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR', fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Timeout/5xx/response sai không chứng minh mutation chưa commit ở server.
export const isUncertainApiError = error => error.status === 0 || error.status >= 500 || ['INVALID_API_RESPONSE', 'REQUEST_IN_PROGRESS'].includes(error.code);

// Token đọc được không phải cookie phiên HttpOnly; auth module phải cấp XSRF-TOKEN.
function readCsrfToken() {
  const cookie = typeof document === 'undefined' ? '' : document.cookie;
  const value = cookie.split('; ').find(part => part.startsWith('XSRF-TOKEN='));
  try { return value ? decodeURIComponent(value.slice('XSRF-TOKEN='.length)) : ''; }
  catch { return ''; }
}

// Tập trung URL, cookie, CSRF, timeout và lỗi; tuyệt đối không fallback sang fixture.
export function createApiClient({ baseUrl = API_BASE_URL, fetchImpl = (...args) => fetch(...args), getCsrfToken = readCsrfToken, timeoutMs = 15000 } = {}) {
  return async function request(path, { method = 'GET', body, signal, idempotencyKey } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') {
      const token = getCsrfToken();
      if (!token) throw new ApiError('Phiên chưa đủ điều kiện thực hiện thao tác. Hãy đăng nhập lại.', 403, 'CSRF_TOKEN_MISSING');
      headers['X-CSRF-Token'] = token;
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method, credentials: 'include', cache: 'no-store', headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiError(response.status >= 500 ? 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.' : result?.message || 'Không thể thực hiện yêu cầu.', response.status, result?.errors?.code || `HTTP_${response.status}`, result?.errors?.fields || {});
      }
      if (result?.success !== true || result.data === undefined) {
        throw new ApiError('Phản hồi máy chủ không đúng hợp đồng API.', response.status, 'INVALID_API_RESPONSE');
      }
      return result.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new ApiError('Chưa nhận được kết quả từ máy chủ. Hãy thử lại cùng yêu cầu.', 0, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}
