import { useEffect, useState } from 'react';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import Modal from '../../components/admin/Modal.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { roleLabels } from '../../context/auth-context.js';
import { workspaceMenus } from '../../layouts/AppShell.jsx';
import { registerErrors } from '../../utils/account-validation.js';

const blank = { fullName: '', email: '', phone: '', role: '', password: '', confirmPassword: '', active: true };
const lockReasons = ['Vi phạm chính sách', 'Nghi ngờ gian lận', 'Theo yêu cầu của người dùng', 'Khác'];

// USR-01: biểu mẫu thêm/sửa/khóa tài khoản. API danh sách và khóa người dùng chưa có nên không có dòng nào để chọn và không lưu được:
// nút gửi bị khóa, mọi hộp thoại nói rõ "Chưa triển khai", không dùng dữ liệu giả.
export default function UserAdminPage() {
  const [dialog, setDialog] = useState(null);
  const [values, setValues] = useState(blank);
  const [reason, setReason] = useState('');
  useEffect(() => { document.title = 'Người dùng · HomeCare'; }, []);

  const edit = dialog === 'edit';
  // Mật khẩu chỉ kiểm tra khi thêm; chỉ báo lỗi cho ô đã có giá trị (kiểm tra trực tiếp khi nhập).
  const errors = Object.fromEntries(Object.entries(registerErrors(values)).filter(([name]) => values[name] && !(edit && /assword/.test(name))));
  const field = (name, extra) => ({ field: { id: `user-${name}`, name, ...extra }, value: values[name], error: errors[name], onChange: value => setValues(current => ({ ...current, [name]: value })) });
  const open = next => { setValues(blank); setReason(''); setDialog(next); };

  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Quản trị viên</span><h1>Người dùng</h1><p>Tạo tài khoản, gán vai trò, khóa hoặc mở khóa. Khóa không làm mất lịch sử đơn hàng.</p></div>
    <p className="hc-note" role="note"><span className="hc-soon">Chưa triển khai</span> API danh sách, tạo và khóa người dùng chưa có nên chưa xem, tìm kiếm hay thay đổi được tài khoản. Các biểu mẫu chỉ kiểm tra dữ liệu nhập, không lưu gì.</p>
    <section className="hc-grp"><h2>Người dùng</h2><div className="hc-grp-row">
      <button className="hc-button" type="button" onClick={() => open('add')}>Thêm người dùng</button>
      <button className="hc-button hc-button--outline" type="button" onClick={() => open('edit')}>Sửa người dùng</button>
      <button className="hc-button hc-button--outline" type="button" onClick={() => open('lock')}>Khóa tài khoản</button>
    </div></section>
    <div className="hc-card"><h2>Danh sách tài khoản</h2><p className="hc-muted">Chưa có dữ liệu: danh sách người dùng cần API chưa được triển khai.</p></div>
    {(dialog === 'add' || edit) && <Modal wide title={edit ? 'Sửa người dùng' : 'Thêm người dùng'} description={edit ? 'Cập nhật thông tin và vai trò của một tài khoản.' : 'Tạo tài khoản và gán vai trò.'} onClose={() => setDialog(null)}>
      <form className="hc-form" noValidate onSubmit={event => event.preventDefault()}>
        <p className="hc-note" role="note">{edit ? 'Chưa chọn tài khoản: chưa có API danh sách nên không có tài khoản để sửa.' : 'API tạo người dùng chưa triển khai: biểu mẫu chưa lưu được.'}</p>
        <div className="hc-form-grid">
          <AdminField {...field('fullName', { label: 'Họ và tên', required: true, maxLength: 150 })} />
          <AdminField {...field('email', { label: 'Email', type: 'email', required: true, maxLength: 150 })} />
          <AdminField {...field('phone', { label: 'Số điện thoại', type: 'tel', maxLength: 20 })} />
          <AdminField {...field('role', { label: 'Vai trò', type: 'select', options: Object.entries(roleLabels), placeholder: 'Chọn vai trò', required: true })} />
          {!edit && <><AdminField {...field('password', { label: 'Mật khẩu tạm', type: 'password', required: true, maxLength: 200 })} /><AdminField {...field('confirmPassword', { label: 'Nhập lại mật khẩu', type: 'password', required: true, maxLength: 200 })} /></>}
        </div>
        {values.role && <fieldset className="hc-fieldset"><legend>Menu của vai trò {roleLabels[values.role]} (chỉ đọc)</legend><ul className="hc-box">{workspaceMenus[values.role].map(([path, title]) => <li key={path}>{title}</li>)}</ul></fieldset>}
        {edit && <AdminField {...field('active', { label: 'Tài khoản đang hoạt động', type: 'checkbox' })} />}
        <div className="hc-form-footer"><span /><span className="hc-actions"><button className="hc-button hc-button--outline" type="button" onClick={() => setDialog(null)}>Hủy</button><button className="hc-button" type="submit" disabled aria-disabled="true">Chưa triển khai</button></span></div>
      </form>
    </Modal>}
    {dialog === 'lock' && <ConfirmDialog title="Khóa tài khoản này?" description="Người dùng sẽ không đăng nhập được cho đến khi mở khóa lại." summary="Chưa chọn tài khoản" detail="Chưa có API danh sách người dùng nên chưa chọn được tài khoản để khóa." confirmLabel="Chưa triển khai" confirmDisabled onConfirm={() => {}} onCancel={() => setDialog(null)}>
      <AdminField field={{ id: 'user-lock-reason', name: 'reason', label: 'Lý do khóa', type: 'select', options: lockReasons.map(item => [item, item]), placeholder: 'Chọn lý do' }} value={reason} onChange={setReason} />
    </ConfirmDialog>}
  </section>;
}
