const env = import.meta.env || {};
export const demoMode = env.VITE_AUTH_DEMO === 'true' || (env.DEV && env.VITE_AUTH_DEMO !== 'false');
const apiUrl = (env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
let csrfToken = '';

// Cookie do máy chủ quản lý; response lỗi giữ status và lỗi theo trường cho form.
export async function requestApi(path, { method = 'GET', body } = {}) {
  if (method !== 'GET' && !csrfToken) await requestApi('/auth/me');
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch { throw new Error('Không thể kết nối máy chủ. Hãy thử lại sau.'); }
  const result = await response.json().catch(() => null);
  if (!result || typeof result.success !== 'boolean') throw new Error('Máy chủ trả dữ liệu không đúng hợp đồng API.');
  if (!response.ok || !result.success) throw Object.assign(new Error(result.message || 'Yêu cầu chưa thực hiện được.'), { status: response.status, errors: result.errors || {} });
  if (result.data?.csrfToken) csrfToken = result.data.csrfToken;
  return result.data;
}
