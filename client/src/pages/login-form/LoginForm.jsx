import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import kitchenCorner from './assets/kitchen-corner.png';
import './login-form.css';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const order = { login: 0, register: 1, recover: 2, verify: 2, done: 3 };

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Đồ gia dụng</span></div>;
}

function Field({ id, label, type = 'text', value, onChange, error, hint, autoComplete, inputMode, maxLength, reveal }) {
  const [shown, setShown] = useState(false);
  return <div className="field">
    <label htmlFor={id}>{label} <span className="required" aria-label="bắt buộc">*</span></label>
    <div className={`input-wrap${error ? ' input-wrap--error' : ''}`}>
      <input id={id} name={id} type={reveal && shown ? 'text' : type} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} required aria-invalid={!!error} aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined} />
      {reveal && <button className="reveal" type="button" onClick={() => setShown(!shown)} aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{shown ? 'Ẩn' : 'Hiện'}</button>}
    </div>
    {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}

export default function LoginForm() {
  const [screen, setScreen] = useState('login');
  const [values, setValues] = useState({ loginUsername: '', loginPassword: '', registerUsername: '', registerEmail: '', registerPhone: '', registerPassword: '', recoverEmail: '', verifyCode: '' });
  const [errors, setErrors] = useState({});
  const [code, setCode] = useState(newCode);
  const [source, setSource] = useState('login');
  const [result, setResult] = useState('login');
  const [busy, setBusy] = useState(false);
  const stage = useRef(null);
  const panels = useRef({});
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    const current = panels.current[screen];
    if (!current || !stage.current) return;
    const resize = () => { stage.current.style.height = `${current.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(current);
    return () => observer.disconnect();
  }, [screen, errors, busy]);

  function go(next, afterSubmit = false) {
    if ((busy && !afterSubmit) || next === screen) return;
    setErrors({});
    setScreen(next);
    document.title = `${{ login: 'Đăng nhập', register: 'Đăng ký', recover: 'Quên mật khẩu', verify: 'Xác nhận mã', done: 'Hoàn tất' }[next]} · Đồ gia dụng`;
  }

  function change(key, value) {
    setValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
  }

  function validate(keys) {
    const next = {};
    keys.forEach(key => {
      const value = values[key].trim();
      if (key.endsWith('Username')) next[key] = !value ? 'Hãy nhập tên đăng nhập.' : value.length < 3 ? 'Tên đăng nhập cần ít nhất 3 ký tự.' : '';
      else if (key === 'loginPassword') next[key] = value ? '' : 'Hãy nhập mật khẩu.';
      else if (key === 'registerPassword') next[key] = value.length >= 8 ? '' : 'Mật khẩu cần ít nhất 8 ký tự.';
      else if (key.endsWith('Email')) next[key] = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Hãy nhập email hợp lệ.';
      else if (key === 'registerPhone') next[key] = /^(0\d{9}|\+84\d{9})$/.test(value.replace(/[\s.\-]/g, '')) ? '' : 'Hãy nhập số điện thoại 10 chữ số hoặc +84 và 9 chữ số.';
      else if (key === 'verifyCode') next[key] = value.toUpperCase() === code ? '' : 'Mã chưa đúng. Hãy nhập mã 5 ký tự đang hiển thị.';
    });
    setErrors(next);
    const first = keys.find(key => next[key]);
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return !first;
  }

  function submit(event, keys, callback) {
    event.preventDefault();
    if (busy || !validate(keys)) return;
    setBusy(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setBusy(false); callback(); }, 420);
  }

  function verify(from) {
    setSource(from);
    setCode(newCode());
    change('verifyCode', '');
    go('verify', true);
  }

  function finish(kind) {
    setResult(kind);
    go('done', true);
  }

  const panel = name => ({
    ref: node => { panels.current[name] = node; },
    className: `auth-panel ${screen === name ? 'is-active' : order[name] <= order[screen] ? 'is-before' : 'is-after'}`,
    'aria-hidden': screen !== name,
    inert: screen !== name ? true : undefined,
  });

  const selectedTab = screen === 'register' || (screen === 'verify' && source === 'register') || (screen === 'done' && result === 'register') ? 'register' : 'login';

  function handleTabKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'login' : 'register';
    go(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  return <main className="page"><div className="shell">
    <aside className="story" aria-label="Giới thiệu">
      <img className="story-photo" src={kitchenCorner} alt="" />
      <Brand />
      <div className="story-main"><span className="eyebrow">Đồ gia dụng cho mọi nhà</span><h2>Nhà gọn gàng, sống nhẹ nhàng.</h2><p>Khám phá đồ gia dụng giúp căn bếp và mỗi ngày của bạn thêm tiện nghi.</p><div className="story-rule" /></div>
      <div className="story-foot">Chọn điều hữu ích cho tổ ấm của bạn.</div>
    </aside>
    <div className="form-side"><div className="content-width">
      <div className="mobile-brand"><Brand /></div>
      <div className="tab-list" role="tablist" aria-label="Tài khoản" onKeyDown={handleTabKey}>
        <button id="login-tab" type="button" role="tab" aria-controls="login-panel" aria-selected={selectedTab === 'login'} tabIndex={selectedTab === 'login' ? 0 : -1} className={`tab ${selectedTab === 'login' ? 'is-selected' : ''}`} onClick={() => go('login')}>Đăng nhập</button>
        <button id="register-tab" type="button" role="tab" aria-controls="register-panel" aria-selected={selectedTab === 'register'} tabIndex={selectedTab === 'register' ? 0 : -1} className={`tab ${selectedTab === 'register' ? 'is-selected' : ''}`} onClick={() => go('register')}>Đăng ký</button>
        <span className={`tab-indicator ${selectedTab === 'register' ? 'is-right' : ''}`} aria-hidden="true" />
      </div>
      <div className="panel-stage" ref={stage}>
        <section {...panel('login')} id="login-panel" role="tabpanel" aria-labelledby="login-tab">
          <span className="step">Rất vui được gặp lại bạn</span><h1 id="login-title">Chào mừng trở lại</h1><p className="intro">Nhập thông tin của bạn để đăng nhập.</p>
          <form noValidate onSubmit={e => submit(e, ['loginUsername', 'loginPassword'], () => verify('login'))}>
            <Field id="loginUsername" label="Tên đăng nhập" value={values.loginUsername} onChange={v => change('loginUsername', v)} error={errors.loginUsername} autoComplete="username" />
            <Field id="loginPassword" label="Mật khẩu" type="password" value={values.loginPassword} onChange={v => change('loginPassword', v)} error={errors.loginPassword} autoComplete="current-password" reveal />
            <div className="inline-end"><button type="button" className="text-button" onClick={() => go('recover')}>Quên mật khẩu?</button></div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang tiếp tục…' : 'Đăng nhập'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="switch-line">Chưa có tài khoản? <button type="button" className="text-button" onClick={() => go('register')}>Đăng ký ngay</button></p>
        </section>
        <section {...panel('register')} id="register-panel" role="tabpanel" aria-labelledby="register-tab">
          <span className="step">Bắt đầu cùng chúng tôi</span><h1 id="register-title">Tạo tài khoản</h1><p className="intro">Điền thông tin bên dưới để bắt đầu.</p>
          <form noValidate onSubmit={e => submit(e, ['registerUsername', 'registerEmail', 'registerPhone', 'registerPassword'], () => verify('register'))}>
            <Field id="registerUsername" label="Tên đăng nhập" value={values.registerUsername} onChange={v => change('registerUsername', v)} error={errors.registerUsername} autoComplete="username" />
            <Field id="registerEmail" label="Email" type="email" value={values.registerEmail} onChange={v => change('registerEmail', v)} error={errors.registerEmail} autoComplete="email" inputMode="email" />
            <Field id="registerPhone" label="Số điện thoại" type="tel" value={values.registerPhone} onChange={v => change('registerPhone', v)} error={errors.registerPhone} autoComplete="tel" inputMode="tel" />
            <Field id="registerPassword" label="Mật khẩu" type="password" value={values.registerPassword} onChange={v => change('registerPassword', v)} error={errors.registerPassword} hint="Dùng ít nhất 8 ký tự." autoComplete="new-password" reveal />
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang tiếp tục…' : 'Tiếp tục'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="switch-line">Đã có tài khoản? <button type="button" className="text-button" onClick={() => go('login')}>Đăng nhập</button></p>
        </section>
        <section {...panel('recover')} aria-labelledby="recover-title">
          <button className="back" type="button" onClick={() => go('login')}>← <span>Quay lại đăng nhập</span></button>
          <span className="step">Khôi phục tài khoản</span><h1 id="recover-title">Quên mật khẩu?</h1><p className="intro">Nhập email đã đăng ký để tiếp tục khôi phục mật khẩu.</p>
          <form noValidate onSubmit={e => submit(e, ['recoverEmail'], () => finish('recover'))}>
            <Field id="recoverEmail" label="Email" type="email" value={values.recoverEmail} onChange={v => change('recoverEmail', v)} error={errors.recoverEmail} autoComplete="email" inputMode="email" />
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang tiếp tục…' : 'Tiếp tục'} <span aria-hidden="true">→</span></button>
          </form>
        </section>
        <section {...panel('verify')} aria-labelledby="verify-title">
          <button className="back" type="button" onClick={() => go(source)}>← <span>Quay lại</span></button>
          <span className="step">{source === 'login' ? 'Đăng nhập' : 'Đăng ký'} · Bước 2 / 2</span><h1 id="verify-title">Xác nhận mã</h1><p className="intro">Nhập mã hiển thị để hoàn tất {source === 'login' ? 'đăng nhập' : 'đăng ký'}.</p>
          <div className="code-card"><div><span className="code-caption">Mã hiển thị</span><span className="code-value" aria-live="polite">{code}</span></div><button className="refresh" type="button" onClick={() => { setCode(newCode()); change('verifyCode', ''); }}>Mã mới</button></div>
          <form noValidate onSubmit={e => submit(e, ['verifyCode'], () => finish(source))}>
            <Field id="verifyCode" label="Mã xác nhận" value={values.verifyCode} onChange={v => change('verifyCode', v)} error={errors.verifyCode} hint="Mã gồm 5 ký tự, không phân biệt chữ hoa và chữ thường." maxLength={5} autoComplete="off" />
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Đang xác nhận…' : 'Xác nhận'} <span aria-hidden="true">→</span></button>
          </form>
        </section>
        <section {...panel('done')} aria-labelledby="done-title">
          <span className="success-mark" aria-hidden="true">✓</span><span className="step">Hoàn tất</span>
          <h1 id="done-title">{result === 'login' ? 'Đăng nhập thành công' : result === 'register' ? 'Đăng ký hoàn tất' : 'Đã ghi nhận yêu cầu'}</h1>
          <p className="intro">{result === 'recover' ? 'Nếu email đã đăng ký, hướng dẫn khôi phục sẽ được gửi đến hộp thư.' : `Bạn đã hoàn tất các bước ${result === 'login' ? 'đăng nhập' : 'đăng ký'}.`}</p>
          <button className="primary" type="button" onClick={() => go('login')}>Về trang đăng nhập <span aria-hidden="true">→</span></button>
        </section>
      </div>
    </div></div>
  </div></main>;
}
