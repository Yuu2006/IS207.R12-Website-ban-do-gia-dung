// Client HTTP cho test API: cookie jar riêng mỗi phiên, tự giữ CSRF token từ response.
export const baseUrl = process.env.API_TEST_URL || 'http://127.0.0.1:8080';
export const password = 'Demo@1234567890!';

export class Client {
  cookies = {};
  token = '';
  async request(path, method = 'GET', body, extraHeaders = {}) {
    const cookie = Object.entries(this.cookies).map(([name, value]) => `${name}=${value}`).join('; ');
    const isForm = body instanceof FormData;
    const response = await fetch(baseUrl + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(this.token ? { 'X-CSRF-Token': this.token } : {}), ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders }, ...(body !== undefined ? { body: isForm || typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
    const setCookies = response.headers.getSetCookie();
    for (const line of setCookies) { const [pair] = line.split(';'); const [name, ...value] = pair.split('='); this.cookies[name] = value.join('='); }
    const json = await response.json();
    if (json.data?.csrfToken) this.token = json.data.csrfToken;
    return { status: response.status, json, setCookies };
  }
  async init() { return this.request('/auth/me'); }
  async staff(role) { await this.init(); return this.request('/auth/staff/login', 'POST', { identifier: `${role.toLowerCase()}@example.test`, password }); }
}
