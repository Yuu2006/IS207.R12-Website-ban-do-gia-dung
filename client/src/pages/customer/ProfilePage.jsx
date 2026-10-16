import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/common/FormField.jsx';
import { roleLabels, useAuth } from '../../context/auth-context.js';
import { changePassword, confirmEmailChange, requestEmailChange } from '../../services/auth-service.js';
import { uploadImage } from '../../services/http-client.js';
import { getProfile, updateProfile } from '../../services/user-service.js';
import { passwordError, profileErrors } from '../../utils/account-validation.js';

const editable = profile => ({ fullName: profile.fullName, phone: profile.phone, birthDate: profile.birthDate });

// Đổi mật khẩu khi đã đăng nhập (CUS-03); máy chủ hủy các phiên cũ và cấp phiên mới cho tab này.
function PasswordForm() {
  const { refreshSession } = useAuth();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field, value) { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setError(''); setNotice(''); }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = { currentPassword: values.currentPassword ? '' : 'Hãy nhập mật khẩu hiện tại.', newPassword: passwordError(values.newPassword), confirmPassword: values.confirmPassword === values.newPassword ? '' : 'Mật khẩu xác nhận chưa khớp.' };
    setErrors(nextErrors);
    const first = Object.keys(nextErrors).find(key => nextErrors[key]);
    if (first) { document.getElementById(`password-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      await refreshSession();
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setNotice('Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.');
    } catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  return <form className="hc-card hc-form" noValidate onSubmit={save}><h2>Đổi mật khẩu</h2>
    <FormField id="password-currentPassword" label="Mật khẩu hiện tại" type="password" value={values.currentPassword} onChange={value => change('currentPassword', value)} error={errors.currentPassword} required autoComplete="current-password" disabled={busy} />
    <FormField id="password-newPassword" label="Mật khẩu mới" type="password" value={values.newPassword} onChange={value => change('newPassword', value)} error={errors.newPassword} required autoComplete="new-password" maxLength={200} disabled={busy} />
    <FormField id="password-confirmPassword" label="Xác nhận mật khẩu mới" type="password" value={values.confirmPassword} onChange={value => change('confirmPassword', value)} error={errors.confirmPassword} required autoComplete="new-password" disabled={busy} />
    {error && <p className="hc-error" role="alert">{error}</p>}{notice && <p className="hc-success" role="status">{notice}</p>}
    <div className="hc-form-footer"><span className="hc-muted">Ít nhất 8 ký tự, gồm chữ và số.</span><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button></div>
  </form>;
}

// CUS-04: đổi email đăng nhập cần mật khẩu hiện tại và mã một lần gửi tới email mới (bản demo hiển thị mã).
function EmailForm() {
  const { user, refreshSession } = useAuth();
  const [values, setValues] = useState({ newEmail: '', currentPassword: '', code: '' });
  const [challenge, setChallenge] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field, value) { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setError(''); }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!challenge) {
        setChallenge(await requestEmailChange({ newEmail: values.newEmail.trim(), currentPassword: values.currentPassword }));
        setValues(current => ({ ...current, currentPassword: '' }));
      } else {
        await confirmEmailChange({ challengeId: challenge.challengeId, code: values.code.trim() });
        await refreshSession();
        setNotice(`Email đăng nhập đã đổi thành ${challenge.email}.`);
        setChallenge(null); setValues({ newEmail: '', currentPassword: '', code: '' });
      }
    } catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  return <form className="hc-card hc-form" noValidate onSubmit={submit}><h2>Đổi email đăng nhập</h2><p className="hc-muted">Email hiện tại: {user.email}</p>
    {!challenge ? <>
      <FormField id="email-newEmail" label="Email mới" type="email" value={values.newEmail} onChange={value => change('newEmail', value)} error={errors.newEmail} required autoComplete="email" maxLength={255} disabled={busy} />
      <FormField id="email-currentPassword" label="Mật khẩu hiện tại" type="password" value={values.currentPassword} onChange={value => change('currentPassword', value)} error={errors.currentPassword} required autoComplete="current-password" disabled={busy} />
    </> : <>
      <p className="hc-success" role="status">Bản demo chưa gửi email thật. Mã xác nhận gửi tới {challenge.email}: <strong>{challenge.previewCode}</strong> (hiệu lực 5 phút).</p>
      <FormField id="email-code" label="Mã xác nhận 6 số" value={values.code} onChange={value => change('code', value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" disabled={busy} />
    </>}
    {error && <p className="hc-error" role="alert">{error}</p>}{notice && <p className="hc-success" role="status">{notice}</p>}
    <div className="hc-form-footer">{challenge ? <button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => setChallenge(null)}>Hủy</button> : <span className="hc-muted">Email cũ dùng đến khi xác nhận xong.</span>}<button className="hc-button" type="submit" disabled={busy || (!challenge ? !values.newEmail || !values.currentPassword : values.code.length !== 6)}>{busy ? 'Đang xử lý…' : challenge ? 'Xác nhận đổi email' : 'Gửi mã xác nhận'}</button></div>
  </form>;
}

// Ảnh đại diện: tải lên qua API (kiểm MIME/kích thước ở PHP) rồi lưu URL vào hồ sơ.
function AvatarCard({ user }) {
  const { refreshSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(next) {
    setBusy(true); setError('');
    try { await updateProfile({ avatarUrl: next }); await refreshSession(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function pick(file) {
    if (!file) return;
    setBusy(true); setError('');
    try { await save(await uploadImage(file, 'avatars')); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <>
    {user.avatarUrl ? <img className="hc-avatar hc-avatar--image" src={user.avatarUrl} alt={`Ảnh đại diện của ${user.fullName}`} /> : <div className="hc-avatar" aria-hidden="true">{user.fullName.charAt(0)}</div>}
    <label className="hc-text-button hc-file-button">{busy ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => pick(event.target.files?.[0])} /></label>
    {user.avatarUrl && <button className="hc-text-button hc-danger" type="button" disabled={busy} onClick={() => save('')}>Xóa ảnh</button>}
    {error && <p className="hc-error" role="alert">{error}</p>}
  </>;
}

// Chỉ cập nhật hồ sơ của principal hiện tại; đồng bộ tên trên shell sau khi lưu.
export default function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Hồ sơ của tôi · HomeCare';
    let active = true;
    setLoading(true);
    getProfile().then(profile => { if (active) { setValues(editable(profile)); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, attempt]);

  function change(field, value) { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setError(''); setNotice(''); }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setNotice('');
    const nextErrors = profileErrors(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { document.getElementById(`profile-${Object.keys(nextErrors)[0]}`)?.focus(); return; }
    setBusy(true);
    setError('');
    try { setValues(editable(await updateProfile(values))); await refreshSession(); setNotice('Đã lưu thông tin hồ sơ.'); }
    catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="hc-status">Đang tải hồ sơ…</p>;
  if (!values) return <div className="hc-card" role="alert"><p>{error}</p><button className="hc-button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></div>;
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Tài khoản</span><h1>Hồ sơ của tôi</h1><p>Cập nhật thông tin để chúng tôi hỗ trợ bạn tốt hơn.</p></div>
    <div className="hc-profile-grid"><aside className="hc-card hc-identity"><AvatarCard user={user} /><h2>{user.fullName}</h2><span className="hc-badge">{roleLabels[user.role]}</span><p>{user.email}</p>{user.role === 'CUSTOMER' && <Link to="/addresses">Quản lý địa chỉ nhận hàng →</Link>}</aside>
      <div className="hc-form"><form className="hc-card hc-form" noValidate onSubmit={save}><h2>Thông tin cá nhân</h2><p className="hc-muted">Trường có dấu * là bắt buộc.</p>
        <FormField id="profile-fullName" label="Họ và tên" value={values.fullName} onChange={value => change('fullName', value)} error={errors.fullName} required autoComplete="name" maxLength={150} disabled={busy} />
        <FormField id="profile-phone" label="Số điện thoại" value={values.phone} onChange={value => change('phone', value)} error={errors.phone} type="tel" autoComplete="tel" maxLength={20} disabled={busy} />
        <FormField id="profile-birthDate" label="Ngày sinh" value={values.birthDate} onChange={value => change('birthDate', value)} error={errors.birthDate} type="date" autoComplete="bday" disabled={busy} />
        {error && <p className="hc-error" role="alert">{error}</p>}{notice && <p className="hc-success" role="status">{notice}</p>}<div className="hc-form-footer"><span className="hc-muted">Vai trò tài khoản được hệ thống quản lý.</span><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form><EmailForm /><PasswordForm /></div>
    </div>
  </section>;
}
