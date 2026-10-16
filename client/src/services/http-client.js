const env = import.meta.env || {};
export const API_URL = (env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
let csrfToken = '';

// Cookie do máy chủ quản lý; response lỗi giữ status và lỗi theo trường cho form.
export async function requestApi(path, { method = 'GET', body, retried = false } = {}) {
  if (method !== 'GET' && !csrfToken) await requestApi('/auth/me');
  const isForm = body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method, credentials: 'include', cache: 'no-store',
      headers: { ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('Không thể kết nối máy chủ. Hãy thử lại sau.'); }
  const result = await response.json().catch(() => null);
  if (!result || typeof result.success !== 'boolean') throw Object.assign(new Error('Máy chủ trả dữ liệu không đúng hợp đồng API.'), { status: response.status });
  if (!response.ok || !result.success) {
    // Phiên máy chủ đổi (hết hạn/đăng nhập ở tab khác) làm token cũ sai: lấy token mới và thử lại một lần.
    if (response.status === 403 && /CSRF/.test(result.message || '') && !retried) { csrfToken = ''; return requestApi(path, { method, body, retried: true }); }
    throw Object.assign(new Error(result.message || 'Yêu cầu chưa thực hiện được.'), { status: response.status, errors: result.errors || {} });
  }
  if (result.data?.csrfToken) csrfToken = result.data.csrfToken;
  return result.data;
}
