import { LockKeyhole, Pencil, Plus, UnlockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import Modal from '../../components/admin/Modal.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { Chips, DataTable, PageHead, SearchBox } from '../../components/admin/ui.jsx';
import { workspaceMenus } from '../../layouts/AppShell.jsx';
import { createManagedUser, listManagedUsers, setManagedUserStatus, updateManagedUser } from '../../services/admin-user-service.js';
import { roleLabels } from '../../context/auth-context.js';
import { registerErrors } from '../../utils/account-validation.js';

const blank = { fullName: '', email: '', phone: '', role: '', password: '', confirmPassword: '' };
const roleOptions = Object.entries(roleLabels);

// Format DB timestamps for the admin table without showing a fabricated date for accounts without a successful login.
function dateTime(value) {
  if (!value) return 'Chưa đăng nhập';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

// USR-01: ADMIN-managed accounts; API rechecks role, ownership-sensitive rules and last-admin protection.
export default function UserAdminPage() {
  const [dialog, setDialog] = useState(null);
  const [target, setTarget] = useState(null);
  const [values, setValues] = useState(blank);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => { document.title = 'Người dùng · HomeCare'; }, []);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    listManagedUsers({ q: query, role, status, page, perPage: 10 })
      .then(data => { if (active) setResult(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [query, role, status, page, reload]);

  const edit = dialog === 'edit';
  const nextStatus = target?.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  const openAdd = () => {
    setTarget(null); setValues(blank); setErrors({}); setError(''); setDialog('add');
  };
  const openEdit = user => {
    setTarget(user);
    setValues({ fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, password: '', confirmPassword: '' });
    setErrors({}); setError(''); setDialog('edit');
  };
  const openStatus = user => {
    setTarget(user); setReason(''); setError(''); setDialog('status');
  };
  const closeDialog = () => { if (!busy) { setDialog(null); setTarget(null); } };
  const field = (name, extra) => ({
    field: { id: `managed-user-${name}`, name, ...extra },
    value: values[name], error: errors[name],
    onChange: value => setValues(current => ({ ...current, [name]: value })),
  });

  async function save(event) {
    event.preventDefault();
    const checked = registerErrors(edit
      ? { ...values, password: 'Validation1', confirmPassword: 'Validation1' }
      : values);
    if (edit) { delete checked.password; delete checked.confirmPassword; }
    if (!roleLabels[values.role]) checked.role = 'Hãy chọn một vai trò hợp lệ.';
    setErrors(checked);
    if (Object.keys(checked).length) return;

    setBusy(true); setError(''); setNotice('');
    const payload = { fullName: values.fullName, email: values.email, phone: values.phone, role: values.role };
    try {
      if (edit) await updateManagedUser(target.id, payload);
      else await createManagedUser({ ...payload, password: values.password });
      setDialog(null); setTarget(null); setNotice(edit ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản.');
      setReload(value => value + 1);
    } catch (err) {
      setError(err.message);
      setErrors(err.errors || {});
    } finally { setBusy(false); }
  }

  async function confirmStatus() {
    if (!target || reason.trim().length < 3) { setError('Hãy nhập lý do ít nhất 3 ký tự.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await setManagedUserStatus(target.id, nextStatus, reason.trim());
      setDialog(null); setTarget(null);
      setNotice(nextStatus === 'DISABLED' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
      setReload(value => value + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const columns = [
    { key: 'user', label: 'Người dùng', width: 'minmax(0, 2fr)', render: user => <div className="ad-name"><span><b>{user.fullName}</b><small className="ad-sub">{user.email}{user.phone ? ` · ${user.phone}` : ''}</small></span></div> },
    { key: 'role', label: 'Vai trò', render: user => <span>{roleLabels[user.role] || user.role}</span> },
    { key: 'status', label: 'Trạng thái', render: user => <span><span className={`hc-badge ${user.status === 'ACTIVE' ? 'hc-badge--in' : 'hc-badge--out'}`}>{user.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span>{user.status === 'DISABLED' && user.lockReason && <small className="ad-sub">{user.lockReason}</small>}{user.status === 'ACTIVE' && user.lockedUntil && new Date(String(user.lockedUntil).replace(' ', 'T')) > new Date() && <small className="ad-sub">Khóa đăng nhập tạm đến {dateTime(user.lockedUntil)}</small>}</span> },
    { key: 'joined', label: 'Ngày tham gia', render: user => <span>{dateTime(user.createdAt)}</span> },
    { key: 'login', label: 'Đăng nhập gần nhất', render: user => <span>{dateTime(user.lastLoginAt)}</span> },
    { key: 'actions', label: 'Thao tác', width: '110px', render: user => <span className="ad-acts">
      <button className="hc-button hc-button--outline ad-sm" type="button" aria-label={`Sửa ${user.fullName}`} title="Sửa tài khoản" onClick={() => openEdit(user)}><Pencil size={16} aria-hidden="true" /></button>
      <button className={`hc-button hc-button--outline ad-sm${user.status === 'ACTIVE' ? ' ad-icon--danger' : ''}`} type="button" aria-label={`${user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'} ${user.fullName}`} title={user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} onClick={() => openStatus(user)}>{user.status === 'ACTIVE' ? <LockKeyhole size={16} aria-hidden="true" /> : <UnlockKeyhole size={16} aria-hidden="true" />}</button>
    </span> },
  ];

  return <section>
    <PageHead title="Người dùng" subtitle="Quản lý tài khoản và bốn vai trò cố định. Khóa tài khoản không xóa lịch sử giao dịch.">
      <button className="hc-button" type="button" onClick={openAdd}><Plus size={18} aria-hidden="true" />Thêm người dùng</button>
    </PageHead>
    {notice && <p className="hc-success" role="status">{notice}</p>}
    {error && !dialog && <p className="hc-error" role="alert">{error} <button className="hc-button hc-button--outline ad-sm" type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    <div className="ad-filters" role="search">
      <SearchBox label="Tìm người dùng" placeholder="Tìm theo tên, email hoặc số điện thoại" value={search} onChange={setSearch} />
      <select className="ad-select" aria-label="Trạng thái tài khoản" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="">Mọi trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="DISABLED">Đã khóa</option>
      </select>
    </div>
    <Chips label="Lọc theo vai trò" options={[[ '', 'Tất cả' ], ...roleOptions]} value={role} onChange={value => { setRole(value); setPage(1); }} />
    <DataTable label="Danh sách người dùng" cols={columns} rows={result?.items || []} rowKey={user => user.id} empty={result ? 'Không tìm thấy tài khoản phù hợp.' : error ? 'Không tải được danh sách tài khoản.' : 'Đang tải danh sách tài khoản…'} />
    {result && result.pagination.total > 0 && <footer className="ad-foot ad-users-pagination"><span>{result.pagination.total} tài khoản · Trang {page}/{Math.max(result.pagination.totalPages, 1)}</span><span className="hc-actions"><button className="hc-button hc-button--outline ad-sm" type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><button className="hc-button hc-button--outline ad-sm" type="button" disabled={page >= result.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Sau</button></span></footer>}

    {(dialog === 'add' || edit) && <Modal wide title={edit ? 'Sửa người dùng' : 'Thêm người dùng'} description={edit ? 'Cập nhật thông tin và vai trò của tài khoản.' : 'Tạo tài khoản nhân viên hoặc khách hàng; mật khẩu sẽ được băm ở máy chủ.'} onClose={closeDialog}>
      <form className="hc-form" noValidate onSubmit={save}>
        {error && <p className="hc-error" role="alert">{error}</p>}
        <div className="hc-form-grid">
          <AdminField {...field('fullName', { label: 'Họ và tên', required: true, maxLength: 150 })} />
          <AdminField {...field('email', { label: 'Email', type: 'email', required: true, maxLength: 255 })} />
          <AdminField {...field('phone', { label: 'Số điện thoại', type: 'tel', maxLength: 20 })} />
          <AdminField {...field('role', { label: 'Vai trò', type: 'select', options: roleOptions, placeholder: 'Chọn vai trò', required: true })} />
          {!edit && <><AdminField {...field('password', { label: 'Mật khẩu tạm', type: 'password', required: true, maxLength: 200 })} /><AdminField {...field('confirmPassword', { label: 'Nhập lại mật khẩu', type: 'password', required: true, maxLength: 200 })} /></>}
        </div>
        {values.role && <fieldset className="hc-fieldset"><legend>Menu của vai trò {roleLabels[values.role]} (chỉ đọc)</legend><ul className="hc-box">{(workspaceMenus[values.role] || []).map(([path, title]) => <li key={path}>{title}</li>)}</ul></fieldset>}
        <div className="hc-form-footer"><span /><span className="hc-actions"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={closeDialog}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></span></div>
      </form>
    </Modal>}

    {dialog === 'status' && target && <ConfirmDialog
      title={nextStatus === 'DISABLED' ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
      description={nextStatus === 'DISABLED' ? 'Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.' : 'Người dùng có thể đăng nhập lại sau khi mở khóa.'}
      summary={`${target.fullName} · ${target.email}`}
      detail={nextStatus === 'DISABLED' ? 'Lịch sử, đơn hàng và dữ liệu liên quan được giữ nguyên.' : 'Trạng thái khóa đăng nhập tạm do nhập sai mật khẩu được quản lý riêng.'}
      confirmLabel={nextStatus === 'DISABLED' ? 'Khóa tài khoản' : 'Mở khóa'}
      confirmDisabled={reason.trim().length < 3}
      busy={busy} error={error} onConfirm={confirmStatus} onCancel={closeDialog}
    >
      <AdminField field={{ id: 'managed-user-reason', name: 'reason', label: 'Lý do (bắt buộc)', type: 'textarea', maxLength: 255, wide: true }} value={reason} onChange={setReason} />
    </ConfirmDialog>}
  </section>;
}
