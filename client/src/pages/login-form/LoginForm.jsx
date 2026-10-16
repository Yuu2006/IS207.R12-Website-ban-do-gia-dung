import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, roleHome } from '../../context/auth-context.js';
import { demoAccounts, demoPassword, login, register } from '../../services/auth-service.js';
import { normalizeContact, registerErrors, safeReturnPath } from '../../utils/account-validation.js';
import { customerReturnPath } from '../../utils/customer-session.js';
import './login-form.css';

const FADE_OUT_MS = 180;

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Đồ gia dụng</span></div>;
}

function Field({ id, label, value, onChange, error, hint, type = 'text', autoComplete, inputMode, maxLength, optional = false }) {
  return <div className="field">
    <label htmlFor={id}>{label} {!optional && <span className="required" aria-label="bắt buộc">*</span>}</label>
    <div className={`input-wrap${error ? ' input-wrap--error' : ''}`}>
      <input id={id} name={id} type={type} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} required={!optional} aria-invalid={!!error} aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined} />
    </div>
    {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}

// Đăng nhập/đăng ký khách hàng bằng email và mật khẩu (CUS-01, CUS-02); OTP không thuộc MVP.
export default function LoginForm({ initialScreen = 'login' }) {
  const [screen, setScreen] = useState(initialScreen);
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ identifier: '', password: '', fullName: '', email: '', phone: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const stage = useRef(null);
  const panels = useRef({});
  const switchTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(switchTimer.current), []);

  useEffect(() => {
    document.title = `${screen === 'login' ? 'Đăng nhập' : 'Đăng ký'} · Đồ gia dụng`;
  }, [screen]);

  useLayoutEffect(() => {
    const current = panels.current[screen];
    if (!current || !stage.current) return;
    const resize = () => { stage.current.style.height = `${current.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(current);
    return () => observer.disconnect();
  }, [screen, errors, serverError, busy]);

  function go(next) {
    if (busy || fadingOut || switchTimer.current !== null || next === screen) return;
    const activate = () => {
      setErrors({});
      setServerError('');
      setScreen(next);
      setFadingOut(false);
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

  function showErrors(nextErrors) {
    setErrors(nextErrors);
    const first = Object.keys(nextErrors).find(key => nextErrors[key]);
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return Boolean(first);
  }

  // Cùng phiên với CustomerRoute (returnTo) và ProtectedRoute (from); chỉ nhận đường dẫn nội bộ.
  async function finish() {
    const session = await refreshSession();
    const { returnTo, from } = location.state || {};
    navigate(returnTo ? customerReturnPath(returnTo) : safeReturnPath(from) || roleHome[session.user.role], { replace: true });
  }

  async function submit(event, action) {
    event.preventDefault();
    if (busy) return;
    const isLogin = action === 'login';
    // Ô mật khẩu đăng ký có id newPassword để không trùng id với ô đăng nhập.
    const { password: newPassword, ...registerRest } = isLogin ? {} : registerErrors({ ...values, password: values.newPassword });
    const nextErrors = isLogin
      ? { identifier: values.identifier.trim() ? '' : 'Hãy nhập email hoặc số điện thoại.', password: values.password ? '' : 'Hãy nhập mật khẩu.' }
      : { ...registerRest, newPassword };
    if (showErrors(nextErrors)) return;
    setBusy(true);
    setServerError('');
    try {
      if (isLogin) await login({ identifier: normalizeContact(values.identifier), password: values.password });
      else await register({ fullName: values.fullName.trim().replace(/\s+/g, ' '), email: normalizeContact(values.email), phone: normalizeContact(values.phone), password: values.newPassword });
      await finish();
    } catch (error) {
      setServerError(error.message || 'Không thể thực hiện yêu cầu. Hãy thử lại.');
      if (error.errors) setErrors(isLogin ? error.errors : { ...error.errors, newPassword: error.errors.password });
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

  function handleTabKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (busy || fadingOut) return;
    const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'login' : 'register';
    go(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  const customerDemo = demoAccounts.find(account => account.role === 'CUSTOMER');
  return <main className="page"><div className="shell">
    <aside className="story" aria-label="Giới thiệu">
      <Brand />
      <div className="story-main"><span className="eyebrow">Đồ gia dụng cho mọi nhà</span><h2>Nhà gọn gàng, sống nhẹ nhàng.</h2><p>Khám phá đồ gia dụng giúp căn bếp và mỗi ngày của bạn thêm tiện nghi.</p><div className="story-rule" /></div>
      <div className="story-foot">Chọn điều hữu ích cho tổ ấm của bạn.</div>
    </aside>
    <div className="form-side"><div className="content-width">
      <div className="mobile-brand"><Brand /></div>
      <div className="tab-list" role="tablist" aria-label="Tài khoản" onKeyDown={handleTabKey}>
        <button id="login-tab" type="button" role="tab" aria-controls="login-panel" aria-selected={screen === 'login'} tabIndex={screen === 'login' ? 0 : -1} className={`tab ${screen === 'login' ? 'is-selected' : ''}`} disabled={busy} onClick={() => go('login')}>Đăng nhập</button>
        <button id="register-tab" type="button" role="tab" aria-controls="register-panel" aria-selected={screen === 'register'} tabIndex={screen === 'register' ? 0 : -1} className={`tab ${screen === 'register' ? 'is-selected' : ''}`} disabled={busy} onClick={() => go('register')}>Đăng ký</button>
        <span className={`tab-indicator ${screen === 'register' ? 'is-right' : ''}`} aria-hidden="true" />
      </div>
      <div className="panel-stage" ref={stage}>
        <section {...panel('login')} id="login-panel" role="tabpanel" aria-labelledby="login-tab">
          <span className="step">Rất vui được gặp lại bạn</span><h1 id="login-title">Chào mừng trở lại</h1><p className="intro">Đăng nhập bằng email (hoặc số điện thoại) và mật khẩu.</p>
          {customerDemo && <p className="demo-note">Bản demo · <button type="button" className="text-button" disabled={busy} onClick={() => setValues(current => ({ ...current, identifier: customerDemo.email, password: demoPassword }))}>Điền tài khoản khách {customerDemo.email}</button></p>}
          <form noValidate onSubmit={event => submit(event, 'login')}>
            <Field id="identifier" label="Email hoặc số điện thoại" value={values.identifier} onChange={value => change('identifier', value)} error={errors.identifier} autoComplete="username" />
            <Field id="password" label="Mật khẩu" type="password" value={values.password} onChange={value => change('password', value)} error={errors.password} autoComplete="current-password" maxLength={200} />
            <p className="switch-line"><Link to="/forgot-password">Quên mật khẩu?</Link></p>
            {screen === 'login' && serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="switch-line">Chưa có tài khoản? <button type="button" className="text-button" onClick={() => go('register')}>Đăng ký ngay</button></p>
        </section>
        <section {...panel('register')} id="register-panel" role="tabpanel" aria-labelledby="register-tab">
          <span className="step">Bắt đầu cùng chúng tôi</span><h1 id="register-title">Tạo tài khoản</h1><p className="intro">Cho chúng tôi biết tên, email và mật khẩu bạn muốn dùng.</p>
          <form noValidate onSubmit={event => submit(event, 'register')}>
            <Field id="fullName" label="Họ và tên" value={values.fullName} onChange={value => change('fullName', value)} error={errors.fullName} autoComplete="name" maxLength={150} />
            <Field id="email" label="Email" type="email" value={values.email} onChange={value => change('email', value)} error={errors.email} autoComplete="email" maxLength={255} />
            <Field id="phone" label="Số điện thoại" type="tel" value={values.phone} onChange={value => change('phone', value)} error={errors.phone} autoComplete="tel" maxLength={20} optional />
            <Field id="newPassword" label="Mật khẩu" type="password" value={values.newPassword} onChange={value => change('newPassword', value)} error={errors.newPassword} hint="Ít nhất 8 ký tự, gồm cả chữ và số." autoComplete="new-password" maxLength={200} />
            <Field id="confirmPassword" label="Xác nhận mật khẩu" type="password" value={values.confirmPassword} onChange={value => change('confirmPassword', value)} error={errors.confirmPassword} autoComplete="new-password" maxLength={200} />
            {screen === 'register' && serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="switch-line">Đã có tài khoản? <button type="button" className="text-button" onClick={() => go('login')}>Đăng nhập</button></p>
        </section>
      </div>
      <p className="switch-line"><Link to="/">Về trang chủ</Link><span>·</span><Link to="/internal/login" state={location.state}>Đăng nhập nội bộ</Link></p>
    </div></div>
  </div></main>;
}
