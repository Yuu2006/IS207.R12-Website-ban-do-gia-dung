import { useEffect, useRef, useState } from 'react';
import FormField from '../../components/common/FormField.jsx';
import { roleLabels, useAuth } from '../../context/auth-context.js';
import { changePassword } from '../../services/auth-service.js';
import { uploadImage } from '../../services/http-client.js';
import { getProfile, updateProfile } from '../../services/user-service.js';
import { passwordError, profileErrors } from '../../utils/account-validation.js';

const editable = profile => ({ fullName: profile.fullName, phone: profile.phone, birthDate: profile.birthDate, avatarUrl: profile.avatarUrl });

// Hộp thoại nổi (dialog modal gốc: Esc đóng, giữ focus trong hộp); đổi mật khẩu CUS-03, máy chủ hủy các phiên cũ.
function PasswordDialog({ onClose, onDone }) {
  const { refreshSession } = useAuth();
  const dialog = useRef(null);
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { dialog.current?.showModal(); }, []);

  function change(field, value) { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setError(''); }

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
      onDone();
    } catch (err) { setError(err.message); setErrors(err.errors || {}); setBusy(false); }
  }

  return <dialog ref={dialog} className="hc-dialog" aria-labelledby="password-title" onClose={onClose} onClick={event => { if (event.target === dialog.current && !busy) dialog.current.close(); }}>
    <form className="hc-form" noValidate onSubmit={save}><h2 id="password-title">Đổi mật khẩu</h2>
      <FormField id="password-currentPassword" label="Mật khẩu hiện tại" type="password" value={values.currentPassword} onChange={value => change('currentPassword', value)} error={errors.currentPassword} required autoComplete="current-password" disabled={busy} />
      <FormField id="password-newPassword" label="Mật khẩu mới" type="password" value={values.newPassword} onChange={value => change('newPassword', value)} error={errors.newPassword} required autoComplete="new-password" maxLength={200} disabled={busy} />
      <FormField id="password-confirmPassword" label="Xác nhận mật khẩu mới" type="password" value={values.confirmPassword} onChange={value => change('confirmPassword', value)} error={errors.confirmPassword} required autoComplete="new-password" disabled={busy} />
      {error && <p className="hc-error" role="alert">{error}</p>}
      <div className="hc-form-footer"><span className="hc-muted">Ít nhất 8 ký tự, gồm chữ và số.</span><span className="hc-dialog-actions"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => dialog.current.close()}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button></span></div>
    </form>
  </dialog>;
}

// Thông tin cá nhân chỉ đọc; bấm "Sửa thông tin" mới đổi được tên, điện thoại, ngày sinh, ảnh đại diện. Email đăng nhập không đổi ở đây.
export default function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const [profile, setProfile] = useState(null);
  const [values, setValues] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    document.title = 'Hồ sơ của tôi · HomeCare';
    let active = true;
    setLoading(true);
    getProfile().then(next => { if (active) { setProfile(next); setValues(editable(next)); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, attempt]);

  function change(field, value) { setValues(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setError(''); setNotice(''); }
  function startEdit() { setValues(editable(profile)); setErrors({}); setError(''); setNotice(''); setEditing(true); }
  function cancelEdit() { setValues(editable(profile)); setErrors({}); setError(''); setEditing(false); }

  // Ảnh tải lên ngay để lấy URL, nhưng chỉ được lưu vào hồ sơ khi bấm "Lưu thay đổi".
  async function pickAvatar(file) {
    if (!file) return;
    setBusy(true); setError('');
    try { change('avatarUrl', await uploadImage(file, 'avatars')); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = profileErrors(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { document.getElementById(`profile-${Object.keys(nextErrors)[0]}`)?.focus(); return; }
    setBusy(true); setError('');
    try {
      const saved = await updateProfile(values);
      setProfile(saved); setValues(editable(saved)); setEditing(false);
      await refreshSession();
      setNotice('Đã lưu thông tin hồ sơ.');
    } catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="hc-status">Đang tải hồ sơ…</p>;
  if (!profile) return <div className="hc-card" role="alert"><p>{error}</p><button className="hc-button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></div>;
  const readOnly = !editing;
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Tài khoản · {roleLabels[user.role]}</span><h1>Hồ sơ của tôi</h1></div>
    {notice && <p className="hc-success" role="status">{notice}</p>}
    <form className="hc-card hc-form" noValidate onSubmit={save}>
      <div className="hc-heading-actions"><h2>Thông tin cá nhân</h2>
        <span className="hc-dialog-actions">
          {!editing && <button className="hc-button hc-button--outline" type="button" onClick={startEdit}>Sửa thông tin</button>}
          <button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => setPasswordOpen(true)}>Đổi mật khẩu</button>
        </span>
      </div>
      <div className="hc-profile-head">
        {values.avatarUrl ? <img className="hc-avatar hc-avatar--image" src={values.avatarUrl} alt={`Ảnh đại diện của ${profile.fullName}`} /> : <div className="hc-avatar" aria-hidden="true">{profile.fullName.charAt(0)}</div>}
        {editing && <span><label className="hc-text-button hc-file-button">{busy ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { pickAvatar(event.target.files?.[0]); event.target.value = ''; }} /></label>{values.avatarUrl && <button className="hc-text-button hc-danger" type="button" disabled={busy} onClick={() => change('avatarUrl', '')}>Xóa ảnh</button>}</span>}
      </div>
      <div className="hc-form-grid">
        <FormField id="profile-fullName" label="Họ và tên" value={values.fullName} onChange={value => change('fullName', value)} error={errors.fullName} required={editing} readOnly={readOnly} autoComplete="name" maxLength={150} disabled={busy} />
        <FormField id="profile-email" label="Email đăng nhập" value={profile.email} onChange={() => {}} readOnly />
        <FormField id="profile-phone" label="Số điện thoại" value={values.phone} onChange={value => change('phone', value)} error={errors.phone} readOnly={readOnly} type="tel" autoComplete="tel" maxLength={20} disabled={busy} />
        <FormField id="profile-birthDate" label="Ngày sinh" value={values.birthDate} onChange={value => change('birthDate', value)} error={errors.birthDate} readOnly={readOnly} type="date" autoComplete="bday" disabled={busy} />
      </div>
      {error && <p className="hc-error" role="alert">{error}</p>}
      {editing && <div className="hc-form-footer"><span className="hc-muted">Email đăng nhập và vai trò do hệ thống quản lý.</span><span className="hc-dialog-actions"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={cancelEdit}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></span></div>}
    </form>
    {passwordOpen && <PasswordDialog onClose={() => setPasswordOpen(false)} onDone={() => { setPasswordOpen(false); setNotice('Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.'); }} />}
  </section>;
}
