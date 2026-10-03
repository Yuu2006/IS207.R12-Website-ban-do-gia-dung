import { useEffect, useRef, useState } from 'react';
import { confirmStaffReset, isDemoReset, requestStaffReset, signInStaff, verifyStaffReset } from './staff-auth-client.js';
import './staff-login.css';

const FADE_OUT_MS = 180;

function Icon({ kind }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    contact: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    code: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h2m2 0h2m2 0h2M7 14h2m2 0h2m2 0h2" /></>,
  };
  return <svg className="staff-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function InputField({ id, label, icon, value, onChange, error, type = 'text', autoComplete, inputMode, maxLength, placeholder }) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return <div className="staff-field">
    <label htmlFor={id}>{label}</label>
    <div className={`staff-input-wrap${error ? ' has-error' : ''}`}>
      <Icon kind={icon} />
      <input id={id} name={id} type={password && visible ? 'text' : type} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} required />
      {password && <button className="staff-reveal" type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(!visible)}>{visible ? 'Ẩn' : 'Hiện'}</button>}
    </div>
    {error && <p className="staff-field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}

function validateContact(value) {
  const contact = value.trim().replace(/[\s.\-]/g, '');
  if (!value.trim()) return 'Hãy nhập email hoặc số điện thoại.';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return '';
  if (/^(0\d{9}|\+84\d{9})$/.test(contact)) return '';
  return 'Email hoặc số điện thoại chưa hợp lệ.';
}

export default function StaffLogin() {
  const [view, setView] = useState('login');
  const [leaving, setLeaving] = useState(false);
  const [values, setValues] = useState({ identifier: '', password: '', contact: '', otp: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [resetToken, setResetToken] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [role, setRole] = useState('');
  const switchTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(switchTimer.current), []);
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => setRemaining(current => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  useEffect(() => {
    const titles = { login: 'Đăng nhập nhân viên', recover: 'Quên mật khẩu', otp: 'Xác nhận OTP', reset: 'Mật khẩu mới', done: 'Đặt lại mật khẩu', signedIn: 'Đã đăng nhập' };
    document.title = `${titles[view]} · Đồ gia dụng`;
  }, [view]);

  function switchView(next, afterSubmit = false) {
    if ((busy && !afterSubmit) || leaving || switchTimer.current !== null || next === view) return;
    const activate = () => {
      setErrors({});
      setServerError('');
      setView(next);
      setLeaving(false);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      activate();
      return;
    }
    setLeaving(true);
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

  function showError(nextErrors) {
    setErrors(nextErrors);
    const first = Object.keys(nextErrors).find(key => nextErrors[key]);
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return Boolean(first);
  }

  async function login(event) {
    event.preventDefault();
    if (busy) return;
    if (showError({ identifier: values.identifier.trim() ? '' : 'Hãy nhập tên đăng nhập hoặc email.', password: values.password ? '' : 'Hãy nhập mật khẩu.' })) return;
    setBusy(true);
    setServerError('');
    try {
      const response = await signInStaff({ identifier: values.identifier.trim(), password: values.password });
      setRole(response.role || 'nhân viên');
      change('password', '');
      switchView('signedIn', true);
    } catch (error) {
      setServerError(error.message || 'Không thể đăng nhập. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(event) {
    event.preventDefault();
    if (busy || showError({ contact: validateContact(values.contact) })) return;
    setBusy(true);
    setServerError('');
    try {
      const contact = values.contact.trim();
      const response = await requestStaffReset(contact);
      setChallenge({ ...response, contact });
      setValues(current => ({ ...current, otp: '' }));
      setRemaining(response.retryAfterSeconds ?? 30);
      switchView('otp', true);
    } catch (error) {
      setServerError(error.message || 'Không thể yêu cầu mã. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || remaining > 0 || !challenge) return;
    setBusy(true);
    setServerError('');
    try {
      const response = await requestStaffReset(challenge.contact);
      setChallenge({ ...response, contact: challenge.contact });
      setValues(current => ({ ...current, otp: '' }));
      setRemaining(response.retryAfterSeconds ?? 30);
      setErrors({});
    } catch (error) {
      setServerError(error.message || 'Không thể gửi lại mã. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (busy || !challenge || showError({ otp: /^\d{6}$/.test(values.otp) ? '' : 'Hãy nhập mã OTP gồm 6 chữ số.' })) return;
    setBusy(true);
    setServerError('');
    try {
      const response = await verifyStaffReset({ challengeId: challenge.challengeId, code: values.otp });
      setResetToken(response.resetToken);
      setValues(current => ({ ...current, otp: '' }));
      switchView('reset', true);
    } catch (error) {
      setServerError(error.message || 'Mã xác nhận chưa đúng.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = {
      newPassword: values.newPassword.length >= 15 ? '' : 'Mật khẩu mới cần ít nhất 15 ký tự.',
      confirmPassword: values.confirmPassword === values.newPassword && values.confirmPassword ? '' : 'Mật khẩu xác nhận chưa khớp.',
    };
    if (showError(nextErrors)) return;
    setBusy(true);
    setServerError('');
    try {
      const response = await confirmStaffReset({ resetToken, newPassword: values.newPassword });
      setDemoCompleted(Boolean(response.demo));
      setValues(current => ({ ...current, newPassword: '', confirmPassword: '' }));
      setResetToken('');
      switchView('done', true);
    } catch (error) {
      setServerError(error.message || 'Không thể đặt lại mật khẩu. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="staff-page"><div className="staff-card">
    <div className="staff-card-top"><span className="staff-emblem" aria-hidden="true">✦</span><span>NỘI BỘ</span></div>
    <div key={view} className={`staff-panel${leaving ? ' is-leaving' : ''}`}>
      {view === 'login' && <>
        <h1 className="staff-centered">Đăng nhập</h1><p className="staff-intro staff-centered">Dành cho nhân viên và quản trị viên.</p>
        <form className="staff-form" noValidate onSubmit={login}>
          <InputField id="identifier" label="Tên đăng nhập hoặc email" icon="user" value={values.identifier} onChange={value => change('identifier', value)} error={errors.identifier} autoComplete="username" />
          <InputField id="password" label="Mật khẩu" icon="lock" type="password" value={values.password} onChange={value => change('password', value)} error={errors.password} autoComplete="current-password" />
          <div className="staff-link-row"><button className="staff-link" type="button" onClick={() => switchView('recover')}>Quên mật khẩu?</button></div>
          {serverError && <p className="staff-server-error" role="alert">{serverError}</p>}
          <button className="staff-primary" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
      </>}

      {view === 'recover' && <>
        <button className="staff-back" type="button" onClick={() => switchView('login')}>← Quay lại đăng nhập</button>
        <h1>Quên mật khẩu?</h1><p className="staff-intro">Nhập email hoặc số điện thoại để nhận mã OTP.</p>
        <form className="staff-form" noValidate onSubmit={requestCode}>
          <InputField id="contact" label="Email hoặc số điện thoại" icon="contact" value={values.contact} onChange={value => change('contact', value)} error={errors.contact} autoComplete="username" />
          {serverError && <p className="staff-server-error" role="alert">{serverError}</p>}
          <button className="staff-primary" type="submit" disabled={busy}>{busy ? 'Đang yêu cầu mã…' : 'Gửi mã OTP'}</button>
        </form>
      </>}

      {view === 'otp' && <>
        <button className="staff-back" type="button" onClick={() => switchView('recover')}>← Thay đổi thông tin</button>
        <h1>Xác nhận OTP</h1><p className="staff-intro">Nhập mã 6 chữ số gửi tới <strong>{challenge?.contact}</strong>. Mã có hiệu lực trong 5 phút.</p>
        {isDemoReset() && challenge?.previewCode && <p className="staff-demo-note" role="status">Chế độ thử nghiệm: SMS/email chưa được gửi. Mã kiểm tra là <strong>{challenge.previewCode}</strong>.</p>}
        <form className="staff-form" noValidate onSubmit={verifyCode}>
          <InputField id="otp" label="Mã xác nhận" icon="code" value={values.otp} onChange={value => change('otp', value.replace(/\D/g, '').slice(0, 6))} error={errors.otp} placeholder="Nhập 6 chữ số" autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
          {serverError && <p className="staff-server-error" role="alert">{serverError}</p>}
          <button className="staff-primary" type="submit" disabled={busy}>{busy ? 'Đang xác nhận…' : 'Xác nhận mã'}</button>
        </form>
        <div className="staff-resend"><span>Chưa nhận được mã?</span><button className="staff-link" type="button" disabled={busy || remaining > 0} onClick={resendCode}>{remaining > 0 ? `Gửi lại sau ${remaining}s` : 'Gửi lại mã'}</button></div>
      </>}

      {view === 'reset' && <>
        <h1>Mật khẩu mới</h1><p className="staff-intro">Tạo mật khẩu mới cho tài khoản nội bộ của bạn.</p>
        <form className="staff-form" noValidate onSubmit={resetPassword}>
          <InputField id="newPassword" label="Mật khẩu mới" icon="lock" type="password" value={values.newPassword} onChange={value => change('newPassword', value)} error={errors.newPassword} placeholder="Ít nhất 15 ký tự" autoComplete="new-password" />
          <InputField id="confirmPassword" label="Xác nhận mật khẩu mới" icon="lock" type="password" value={values.confirmPassword} onChange={value => change('confirmPassword', value)} error={errors.confirmPassword} autoComplete="new-password" />
          {serverError && <p className="staff-server-error" role="alert">{serverError}</p>}
          <button className="staff-primary" type="submit" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}</button>
        </form>
      </>}

      {view === 'done' && <div className="staff-complete"><span className="staff-check" aria-hidden="true">✓</span><h1>Đã đặt lại mật khẩu</h1><p className="staff-intro">Hãy đăng nhập bằng mật khẩu mới của bạn.</p>{demoCompleted && <p className="staff-demo-note">Đây là bản thử nghiệm giao diện. Mật khẩu thật chưa được thay đổi.</p>}<button className="staff-primary" type="button" onClick={() => switchView('login')}>Quay lại đăng nhập</button></div>}
      {view === 'signedIn' && <div className="staff-complete"><span className="staff-check" aria-hidden="true">✓</span><h1>Đăng nhập thành công</h1><p className="staff-intro">Phiên làm việc của {role} đã được tạo. Trang quản lý sẽ được kết nối ở bước tiếp theo.</p></div>}
    </div>
  </div></main>;
}
