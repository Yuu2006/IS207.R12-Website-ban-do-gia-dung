import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/common/FormField.jsx';
import { roleLabels, useAuth } from '../../context/auth-context.js';
import { getProfile, updateProfile, profileErrors } from '../../services/user-service.js';

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
    getProfile().then(profile => { if (active) { setValues({ fullName: profile.fullName, email: profile.email, phone: profile.phone }); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
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
    try { const profile = await updateProfile(values); setValues({ fullName: profile.fullName, email: profile.email, phone: profile.phone }); await refreshSession(); setNotice('Đã lưu thông tin hồ sơ.'); }
    catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="hc-status">Đang tải hồ sơ…</p>;
  if (!values) return <div className="hc-card" role="alert"><p>{error}</p><button className="hc-button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></div>;
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Tài khoản</span><h1>Hồ sơ của tôi</h1><p>Cập nhật thông tin để chúng tôi hỗ trợ bạn tốt hơn.</p></div>
    <div className="hc-profile-grid"><aside className="hc-card hc-identity"><div className="hc-avatar" aria-hidden="true">{user.fullName.charAt(0)}</div><h2>{user.fullName}</h2><span className="hc-badge">{roleLabels[user.role]}</span><p>{user.email || user.phone}</p>{user.role === 'CUSTOMER' && <Link to="/addresses">Quản lý địa chỉ nhận hàng →</Link>}</aside>
      <form className="hc-card hc-form" noValidate onSubmit={save}><h2>Thông tin cá nhân</h2><p className="hc-muted">Trường có dấu * là bắt buộc. Cần ít nhất email hoặc số điện thoại.</p>
        <FormField id="profile-fullName" label="Họ và tên" value={values.fullName} onChange={value => change('fullName', value)} error={errors.fullName} required autoComplete="name" maxLength={150} disabled={busy} />
        <FormField id="profile-email" label="Email" value={values.email} onChange={value => change('email', value)} error={errors.email} type="email" autoComplete="email" maxLength={255} disabled={busy} />
        <FormField id="profile-phone" label="Số điện thoại" value={values.phone} onChange={value => change('phone', value)} error={errors.phone} type="tel" autoComplete="tel" maxLength={20} disabled={busy} />
        {error && <p className="hc-error" role="alert">{error}</p>}{notice && <p className="hc-success" role="status">{notice}</p>}<div className="hc-form-footer"><span className="hc-muted">Vai trò tài khoản được hệ thống quản lý.</span><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form>
    </div>
  </section>;
}
