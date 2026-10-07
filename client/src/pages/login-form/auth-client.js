import { isCustomerUser, parsePreviewSession } from '../../utils/customer-session.js';
import { API_BASE_URL } from '../../services/api-client.js';

const API_URL = API_BASE_URL;
const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_AUTH_DEMO !== 'false';
const PREVIEW_SESSION_KEY = 'homecare:preview-customer-session';

let demoChallenge = null;
let previewSession = null;

function generateDemoCode() {
  const number = new Uint32Array(1);
  crypto.getRandomValues(number);
  return String(number[0] % 1_000_000).padStart(6, '0');
}

async function post(path, body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Hãy thử lại sau.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu chưa thực hiện được. Hãy thử lại.');
  return data;
}

export function isDemoAuth() {
  return DEMO_MODE;
}

export async function requestCustomerOtp({ flow, contact, fullName }) {
  if (!DEMO_MODE) {
    const response = await post('/auth/customer/otp/request', { flow, contact, fullName });
    if (!response.challengeId) throw new Error('Máy chủ chưa hỗ trợ gửi OTP.');
    return response;
  }

  const challengeId = crypto.randomUUID();
  const previewCode = generateDemoCode();
  demoChallenge = {
    challengeId,
    code: previewCode,
    contact,
    flow,
    fullName,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
  };
  return { challengeId, retryAfterSeconds: 30, expiresInSeconds: 300, previewCode, demo: true };
}

export async function verifyCustomerOtp({ challengeId, code }) {
  if (!DEMO_MODE) {
    const response = await post('/auth/customer/otp/verify', { challengeId, code });
    if (response.success !== true || response.sessionEstablished !== true) {
      throw new Error('Máy chủ chưa hoàn tất xác thực tài khoản.');
    }
    return response;
  }

  if (!demoChallenge || demoChallenge.challengeId !== challengeId) {
    throw new Error('Phiên xác nhận không còn hiệu lực. Hãy yêu cầu mã mới.');
  }
  if (Date.now() > demoChallenge.expiresAt) {
    demoChallenge = null;
    throw new Error('Mã đã hết hạn. Hãy yêu cầu mã mới.');
  }
  demoChallenge.attempts += 1;
  if (demoChallenge.attempts > 5) {
    demoChallenge = null;
    throw new Error('Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.');
  }
  if (demoChallenge.code !== code) {
    throw new Error('Mã xác nhận chưa đúng. Hãy kiểm tra và nhập lại.');
  }

  const contact = demoChallenge.contact.trim().toLowerCase();
  previewSession = {
    mode: 'preview',
    user: { id: `preview:${contact}`, role: 'CUSTOMER', fullName: demoChallenge.fullName || (contact === 'nguyen.minh@example.com' ? 'Nguyễn Minh' : contact) },
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  try { sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(previewSession)); } catch { /* Vẫn dùng phiên trong bộ nhớ khi storage bị chặn. */ }
  demoChallenge = null;
  return { success: true, demo: true };
}

// Development chỉ khôi phục phiên UI; production luôn xác nhận cookie với máy chủ.
export async function getCustomerSession() {
  if (DEMO_MODE) {
    try { previewSession = parsePreviewSession(sessionStorage.getItem(PREVIEW_SESSION_KEY)) || parsePreviewSession(JSON.stringify(previewSession)); }
    catch { previewSession = parsePreviewSession(JSON.stringify(previewSession)); }
    return previewSession;
  }

  let response;
  try { response = await fetch(`${API_URL}/auth/customer/session`, { credentials: 'include', cache: 'no-store' }); }
  catch { throw new Error('Không thể kiểm tra phiên đăng nhập. Hãy thử lại sau.'); }
  if (response.status === 401) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true || data.sessionEstablished !== true || !isCustomerUser(data.user)) {
    throw new Error('Máy chủ chưa xác nhận phiên khách hàng hợp lệ.');
  }
  return { user: data.user };
}

// Phiên thật phải được vô hiệu hóa ở backend trước khi UI coi là đã đăng xuất.
export async function signOutCustomer() {
  if (!DEMO_MODE) {
    const data = await post('/auth/customer/logout', {});
    if (data.success !== true) throw new Error('Chưa thể đăng xuất. Hãy thử lại.');
    return;
  }
  previewSession = null;
  demoChallenge = null;
  try { sessionStorage.removeItem(PREVIEW_SESSION_KEY); } catch { /* Storage có thể bị chặn. */ }
}
