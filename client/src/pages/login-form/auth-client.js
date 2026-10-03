const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_AUTH_DEMO !== 'false';

let demoChallenge = null;

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

  demoChallenge = null;
  return { success: true, demo: true };
}
