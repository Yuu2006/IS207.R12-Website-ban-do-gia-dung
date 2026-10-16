import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { customerReturnPath } from '../../utils/customer-session.js';
import { isDemoAuth, requestCustomerOtp, verifyCustomerOtp } from './auth-client.js';
import './login-form.css';

const FADE_OUT_MS = 180;

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Đồ gia dụng</span></div>;
}

function Field({ id, label, value, onChange, error, hint, autoComplete, inputMode, maxLength }) {
  return <div className="field">
    <label htmlFor={id}>{label} <span className="required" aria-label="bắt buộc">*</span></label>
    <div className={`input-wrap${error ? ' input-wrap--error' : ''}`}>
      <input id={id} name={id} type="text" value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} required aria-invalid={!!error} aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined} />
    </div>
    {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}

function normalizedContact(value) {
  const trimmed = value.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed.replace(/[\s.\-]/g, '');
}

function contactError(value) {
  const contact = normalizedContact(value);
  if (!contact) return 'Hãy nhập email hoặc số điện thoại.';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return '';
  if (/^(0\d{9}|\+84\d{9})$/.test(contact)) return '';
  return 'Hãy nhập email hoặc số điện thoại hợp lệ.';
}

export default function LoginForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshSession } = useCustomerAuth();
  const returnTo = customerReturnPath(location.state?.returnTo);
  const [screen, setScreen] = useState('login');
  const [values, setValues] = useState({ loginContact: '', fullName: '', registerContact: '', otpCode: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [source, setSource] = useState('login');
  const [request, setRequest] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [completedDemo, setCompletedDemo] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const stage = useRef(null);
  const panels = useRef({});
  const switchTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(switchTimer.current), []);

  useEffect(() => {
    if (screen === 'verify') document.getElementById('otpCode')?.focus();
  }, [screen]);

  useLayoutEffect(() => {
    const current = panels.current[screen];
    if (!current || !stage.current) return;
    const resize = () => { stage.current.style.height = `${current.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(current);
    return () => observer.disconnect();
  }, [screen, errors, serverError, request, remaining, busy]);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  function go(next, afterSubmit = false) {
    if ((busy && !afterSubmit) || fadingOut || switchTimer.current !== null || next === screen) return;
    const activate = () => {
      setErrors({});
      setServerError('');
      setScreen(next);
      setFadingOut(false);
      document.title = `${{ login: 'Đăng nhập', register: 'Đăng ký', verify: 'Xác nhận mã', done: 'Hoàn tất' }[next]} · Đồ gia dụng`;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      activate();
      return;
    }
    setFadingOut(true);
    switchTimer.current = window.setTimeout(() => {
      switchTimer.current = null;
      activate();
    }, FADE_OUT_MS);
  }

  function change(key, value) {
    setValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
    setServerError('');
  }

  async function sendCode(event, flow) {
    event.preventDefault();
    if (busy) return;
    const contactKey = flow === 'login' ? 'loginContact' : 'registerContact';
    const nextErrors = {};
    if (flow === 'register' && values.fullName.trim().length < 2) nextErrors.fullName = 'Hãy nhập họ và tên của bạn.';
    nextErrors[contactKey] = contactError(values[contactKey]);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors).find(key => nextErrors[key]);
    if (first) {
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }

    setBusy(true);
    setServerError('');
    try {
      const contact = normalizedContact(values[contactKey]);
      const fullName = flow === 'register' ? values.fullName.trim().replace(/\s+/g, ' ') : undefined;
      const response = await requestCustomerOtp({ flow, contact, fullName });
      setSource(flow);
      setRequest({ ...response, contact, fullName });
      setValues(current => ({ ...current, otpCode: '' }));
      setRemaining(response.retryAfterSeconds ?? 30);
      go('verify', true);
    } catch (error) {
      setServerError(error.message || 'Không thể gửi mã. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || remaining > 0 || !request) return;
    setBusy(true);
    setServerError('');
    try {
      const response = await requestCustomerOtp({ flow: source, contact: request.contact, fullName: request.fullName });
      setRequest({ ...response, contact: request.contact, fullName: request.fullName });
      setValues(current => ({ ...current, otpCode: '' }));
      setErrors({});
      setRemaining(response.retryAfterSeconds ?? 30);
    } catch (error) {
      setServerError(error.message || 'Không thể gửi lại mã. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(event) {
    event.preventDefault();
    if (busy || !request) return;
    const code = values.otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setErrors({ otpCode: 'Hãy nhập mã xác nhận gồm 6 chữ số.' });
      requestAnimationFrame(() => document.getElementById('otpCode')?.focus());
      return;
    }

    setBusy(true);
    setServerError('');
    try {
      const response = await verifyCustomerOtp({ challengeId: request.challengeId, code });
      const session = await refreshSession();
      if (!session) throw new Error('Phiên đăng nhập chưa được xác nhận. Hãy thử lại.');
      setCompletedDemo(Boolean(response.demo));
      go('done', true);
    } catch (error) {
      setServerError(error.message || 'Không thể xác nhận mã. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  const panel = name => ({
    ref: node => { panels.current[name] = node; },
    className: `auth-panel${screen === name ? ` is-active${fadingOut ? ' is-fading-out' : ''}` : ''}`,
    'aria-hidden': screen !== name,
    inert: screen !== name || fadingOut ? true : undefined,
  });
  const selectedTab = screen === 'register' || ((screen === 'verify' || screen === 'done') && source === 'register') ? 'register' : 'login';

  function handleTabKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (busy || fadingOut) return;
    const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'login' : 'register';
    go(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  return <main className="page"><div className="shell">
    <aside className="story" aria-label="Giới thiệu">
      <Brand />
      <div className="story-main"><span className="eyebrow">Đồ gia dụng cho mọi nhà</span><h2>Nhà gọn gàng, sống nhẹ nhàng.</h2><p>Khám phá đồ gia dụng giúp căn bếp và mỗi ngày của bạn thêm tiện nghi.</p><div className="story-rule" /></div>
      <div className="story-foot">Chọn điều hữu ích cho tổ ấm của bạn.</div>
    </aside>
    <div className="form-side"><div className="content-width">
      <div className="mobile-brand"><Brand /></div>
      <div className="tab-list" role="tablist" aria-label="Tài khoản" onKeyDown={handleTabKey}>
        <button id="login-tab" type="button" role="tab" aria-controls="login-panel" aria-selected={selectedTab === 'login'} tabIndex={selectedTab === 'login' ? 0 : -1} className={`tab ${selectedTab === 'login' ? 'is-selected' : ''}`} disabled={busy} onClick={() => go('login')}>Đăng nhập</button>
        <button id="register-tab" type="button" role="tab" aria-controls="register-panel" aria-selected={selectedTab === 'register'} tabIndex={selectedTab === 'register' ? 0 : -1} className={`tab ${selectedTab === 'register' ? 'is-selected' : ''}`} disabled={busy} onClick={() => go('register')}>Đăng ký</button>
        <span className={`tab-indicator ${selectedTab === 'register' ? 'is-right' : ''}`} aria-hidden="true" />
      </div>
      <div className="panel-stage" ref={stage}>
        <section {...panel('login')} id="login-panel" role="tabpanel" aria-labelledby="login-tab">
          <span className="step">Rất vui được gặp lại bạn</span><h1 id="login-title">Chào mừng trở lại</h1><p className="intro">Nhập email hoặc số điện thoại để nhận mã đăng nhập.</p>
          <form noValidate onSubmit={event => sendCode(event, 'login')}>
            <Field id="loginContact" label="Email hoặc số điện thoại" value={values.loginContact} onChange={value => change('loginContact', value)} error={errors.loginContact} autoComplete="username" />
            {screen === 'login' && serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang yêu cầu mã…' : 'Nhận mã OTP'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="switch-line">Chưa có tài khoản? <button type="button" className="text-button" onClick={() => go('register')}>Đăng ký ngay</button></p>
        </section>
        <section {...panel('register')} id="register-panel" role="tabpanel" aria-labelledby="register-tab">
          <span className="step">Bắt đầu cùng chúng tôi</span><h1 id="register-title">Tạo tài khoản</h1><p className="intro">Cho chúng tôi biết tên và cách liên hệ với bạn.</p>
          <form noValidate onSubmit={event => sendCode(event, 'register')}>
            <Field id="fullName" label="Họ và tên" value={values.fullName} onChange={value => change('fullName', value)} error={errors.fullName} autoComplete="name" />
            <Field id="registerContact" label="Email hoặc số điện thoại" value={values.registerContact} onChange={value => change('registerContact', value)} error={errors.registerContact} autoComplete="username" />
            {screen === 'register' && serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang yêu cầu mã…' : 'Gửi mã xác nhận'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="switch-line">Đã có tài khoản? <button type="button" className="text-button" onClick={() => go('login')}>Đăng nhập</button></p>
        </section>
        <section {...panel('verify')} aria-labelledby="verify-title">
          <button className="back" type="button" disabled={busy} onClick={() => go(source)}>← <span>Thay đổi thông tin</span></button>
          <span className="step">{source === 'login' ? 'Đăng nhập' : 'Đăng ký'} · Bước 2 / 2</span><h1 id="verify-title">Xác nhận mã OTP</h1>
          <p className="intro">Nhập mã gồm 6 chữ số được gửi tới <strong>{request?.contact}</strong>. Mã có hiệu lực trong 5 phút.</p>
          {isDemoAuth() && request?.previewCode && <p className="demo-note" role="status">Chế độ thử nghiệm: chưa gửi SMS/email. Mã để kiểm tra giao diện là <strong>{request.previewCode}</strong>.</p>}
          <form noValidate onSubmit={confirmCode}>
            <Field id="otpCode" label="Mã xác nhận" value={values.otpCode} onChange={value => change('otpCode', value.replace(/\D/g, '').slice(0, 6))} error={errors.otpCode} hint="Nhập đúng 6 chữ số trong email hoặc tin nhắn." autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
            {screen === 'verify' && serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang xác nhận…' : source === 'login' ? 'Đăng nhập' : 'Hoàn tất đăng ký'} <span aria-hidden="true">→</span></button>
          </form>
          <div className="resend-row"><span>Chưa nhận được mã?</span><button className="text-button" type="button" disabled={busy || remaining > 0} onClick={resendCode}>{remaining > 0 ? `Gửi lại sau ${remaining}s` : 'Gửi lại mã'}</button></div>
        </section>
        <section {...panel('done')} aria-labelledby="done-title">
          <span className="success-mark" aria-hidden="true">✓</span><span className="step">Hoàn tất</span>
          <h1 id="done-title">{source === 'login' ? 'Đăng nhập thành công' : 'Đăng ký hoàn tất'}</h1>
          <p className="intro">{source === 'login' ? 'Bạn đã xác nhận mã đăng nhập.' : 'Bạn đã xác nhận thông tin để tạo tài khoản.'}</p>
          {completedDemo && <p className="result-note">Phiên kiểm tra giao diện đã sẵn sàng trong trình duyệt này. Chưa tạo tài khoản trên máy chủ.</p>}
          <button className="primary" type="button" onClick={() => navigate(returnTo, { replace: true })}>{returnTo.startsWith('/checkout') ? 'Tiếp tục thanh toán' : 'Xem đơn hàng'} <span aria-hidden="true">→</span></button>
        </section>
      </div>
    </div></div>
  </div></main>;
}
