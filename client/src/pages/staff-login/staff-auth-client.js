import { demoMode, loginStaff } from '../../services/auth-service.js';
import { requestApi } from '../../services/http-client.js';
const DEMO_RESET = demoMode;

let demoReset = null;

async function post(path, body) {
  return requestApi(path, { method: 'POST', body });
}

export function isDemoReset() {
  return DEMO_RESET;
}

export async function signInStaff({ identifier, password }) {
  return loginStaff({ identifier, password });
}

export async function requestStaffReset(contact) {
  if (!DEMO_RESET) {
    const response = await post('/auth/staff/password-reset/request', { contact });
    if (!response.challengeId) throw new Error('Máy chủ chưa hỗ trợ gửi mã khôi phục.');
    return response;
  }

  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const previewCode = String(bytes[0] % 1_000_000).padStart(6, '0');
  const challengeId = crypto.randomUUID();
  demoReset = { challengeId, previewCode, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, resetToken: null };
  return { challengeId, previewCode, retryAfterSeconds: 30, demo: true };
}

export async function verifyStaffReset({ challengeId, code }) {
  if (!DEMO_RESET) {
    const response = await post('/auth/staff/password-reset/verify', { challengeId, code });
    if (!response.resetToken) throw new Error('Máy chủ chưa xác nhận được mã khôi phục.');
    return response;
  }

  if (!demoReset || demoReset.challengeId !== challengeId) throw new Error('Phiên xác nhận không còn hiệu lực. Hãy yêu cầu mã mới.');
  if (Date.now() > demoReset.expiresAt) {
    demoReset = null;
    throw new Error('Mã đã hết hạn. Hãy yêu cầu mã mới.');
  }
  demoReset.attempts += 1;
  if (demoReset.attempts > 5) {
    demoReset = null;
    throw new Error('Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.');
  }
  if (demoReset.previewCode !== code) throw new Error('Mã xác nhận chưa đúng. Hãy kiểm tra và nhập lại.');

  demoReset.previewCode = null;
  demoReset.resetToken = crypto.randomUUID();
  return { resetToken: demoReset.resetToken, demo: true };
}

export async function confirmStaffReset({ resetToken, newPassword }) {
  if (!DEMO_RESET) {
    const response = await post('/auth/staff/password-reset/confirm', { resetToken, newPassword });
    if (response.success !== true || response.passwordChanged !== true) {
      throw new Error('Máy chủ chưa đặt lại được mật khẩu.');
    }
    return response;
  }

  if (!demoReset || demoReset.resetToken !== resetToken || Date.now() > demoReset.expiresAt) {
    throw new Error('Phiên đặt lại mật khẩu đã hết hạn. Hãy bắt đầu lại.');
  }
  demoReset = null;
  return { success: true, demo: true };
}
