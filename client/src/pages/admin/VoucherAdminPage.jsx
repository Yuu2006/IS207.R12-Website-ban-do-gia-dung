import { useEffect, useId, useState } from 'react';
import Modal from '../../components/admin/Modal.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';

const blank = () => ({ code: '', type: 'percent', value: '', max: '', minOrder: '', limit: '', perUser: '', start: new Date().toISOString().slice(0, 10), end: '', active: true });
const digits = value => value.replace(/\D/g, '');

// Kiểm tra trực tiếp khi nhập; chỉ báo lỗi cho ô đã có giá trị.
function voucherErrors(v) {
  const errors = {};
  if (v.code && !/^[A-Z0-9_-]{3,50}$/.test(v.code)) errors.code = 'Mã gồm 3–50 ký tự: chữ hoa, số, gạch ngang hoặc gạch dưới.';
  if (v.type === 'percent' && v.value && (Number(v.value) < 1 || Number(v.value) > 100)) errors.value = 'Mức giảm theo % từ 1 đến 100.';
  if (v.type === 'amount' && v.value && !/^[1-9]/.test(v.value)) errors.value = 'Mức giảm phải lớn hơn 0.';
  if (v.limit && Number(v.limit) < 1) errors.limit = 'Tổng lượt dùng tối thiểu là 1.';
  if (v.perUser && Number(v.perUser) < 1) errors.perUser = 'Lượt tối đa mỗi khách tối thiểu là 1.';
  if (v.start && v.end && v.end < v.start) errors.end = 'Ngày kết thúc phải sau ngày bắt đầu.';
  return errors;
}

// PROMO-01 / ADM-PRO-01: biểu mẫu voucher. API voucher chưa có (route PHP rỗng) nên chưa lưu được: nút gửi bị khóa, không báo thành công.
export default function VoucherAdminPage() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(blank);
  const uid = useId();
  useEffect(() => { document.title = 'Voucher · HomeCare'; }, []);
  const errors = voucherErrors(values);
  const field = (name, extra = {}) => ({ field: { id: `${uid}-${name}`, name, ...extra }, value: values[name], error: errors[name], onChange: value => setValues(current => ({ ...current, [name]: value })) });
  const percent = values.type === 'percent';

  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Quản trị viên</span><h1>Voucher</h1><p>Thiết lập mã giảm giá, điều kiện áp dụng và thời hạn. Mỗi đơn chỉ áp dụng một voucher.</p></div>
    <p className="hc-note" role="note"><span className="hc-soon">Chưa triển khai</span> API voucher chưa có nên chưa tạo, sửa hay xem được số lượt đã dùng. Biểu mẫu bên dưới chỉ kiểm tra dữ liệu nhập, không lưu gì.</p>
    <section className="hc-grp"><h2>Voucher</h2><div className="hc-grp-row"><button className="hc-button" type="button" onClick={() => { setValues(blank()); setOpen(true); }}>Tạo voucher</button></div></section>
    <div className="hc-card"><h2>Danh sách voucher</h2><p className="hc-muted">Chưa có dữ liệu: danh sách voucher cần API chưa được triển khai.</p></div>
    {open && <Modal wide title="Tạo voucher" description="Thiết lập mã giảm giá, điều kiện áp dụng và thời hạn." onClose={() => setOpen(false)}>
      <form className="hc-form" noValidate onSubmit={event => event.preventDefault()}>
        <p className="hc-note" role="note">API voucher chưa triển khai: biểu mẫu chưa lưu được.</p>
        <AdminField {...field('code', { label: 'Mã voucher', required: true, maxLength: 50 })} onChange={value => setValues(current => ({ ...current, code: value.toUpperCase().replace(/\s/g, '') }))} />
        <fieldset className="hc-fieldset"><legend>Loại giảm giá <span aria-hidden="true">*</span></legend>
          <div className="hc-form-grid">{[['percent', 'Giảm theo %'], ['amount', 'Giảm số tiền']].map(([type, label]) => <label className="hc-seg" key={type}><input type="radio" name={`${uid}-type`} value={type} checked={values.type === type} onChange={() => setValues(current => ({ ...current, type, value: '', max: '' }))} />{label}</label>)}</div></fieldset>
        <div className="hc-form-grid">
          {percent ? <div className="hc-field"><label htmlFor={`${uid}-value`}>Mức giảm <span aria-label="bắt buộc">*</span></label><span className="hc-sufw"><input id={`${uid}-value`} inputMode="numeric" autoComplete="off" maxLength={3} aria-invalid={Boolean(errors.value)} aria-describedby={errors.value ? `${uid}-value-error` : undefined} value={values.value} onChange={event => setValues(current => ({ ...current, value: digits(event.target.value) }))} /><span aria-hidden="true">%</span></span>{errors.value && <p className="hc-field-error" id={`${uid}-value-error`}>{errors.value}</p>}</div>
            : <AdminField {...field('value', { label: 'Mức giảm', type: 'money', required: true })} />}
          {percent && <AdminField {...field('max', { label: 'Giảm tối đa', type: 'money' })} />}
          <AdminField {...field('minOrder', { label: 'Đơn tối thiểu', type: 'money' })} />
          <AdminField {...field('limit', { label: 'Tổng lượt dùng', inputMode: 'numeric', maxLength: 9 })} onChange={value => setValues(current => ({ ...current, limit: digits(value) }))} />
          <AdminField {...field('perUser', { label: 'Lượt tối đa mỗi khách', inputMode: 'numeric', maxLength: 9 })} onChange={value => setValues(current => ({ ...current, perUser: digits(value) }))} />
          <AdminField {...field('start', { label: 'Ngày bắt đầu', type: 'date', required: true })} />
          <AdminField {...field('end', { label: 'Ngày kết thúc', type: 'date', required: true })} />
        </div>
        <AdminField {...field('active', { label: 'Kích hoạt khi đến ngày bắt đầu', type: 'checkbox' })} />
        <div className="hc-form-footer"><span /><span className="hc-actions"><button className="hc-button hc-button--outline" type="button" onClick={() => setOpen(false)}>Hủy</button><button className="hc-button" type="submit" disabled aria-disabled="true">Chưa triển khai</button></span></div>
      </form>
    </Modal>}
  </section>;
}
