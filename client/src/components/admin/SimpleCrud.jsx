import { useEffect, useState } from 'react';
import { uploadImage } from '../../services/catalog-service.js';

// Ô nhập theo cấu hình; ảnh tải lên qua API rồi điền URL tuyệt đối vào trường.
export function AdminField({ field, value, onChange, error, disabled }) {
  const id = field.id || `admin-${field.name}`;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const common = { id, name: field.name, disabled: disabled || uploading, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined };
  async function upload(file) {
    if (!file) return;
    setUploading(true); setUploadError('');
    try { onChange(await uploadImage(file, field.uploadType)); }
    catch (err) { setUploadError(err.message); }
    finally { setUploading(false); }
  }
  if (field.type === 'checkbox') return <label className="hc-check"><input type="checkbox" {...common} checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />{field.label}</label>;
  return <div className="hc-field"><label htmlFor={id}>{field.label}{field.required && <span aria-label="bắt buộc"> *</span>}</label>
    {field.type === 'select' ? <select {...common} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">{field.placeholder || '— Chọn —'}</option>{field.options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>
      : field.type === 'textarea' ? <textarea {...common} rows={3} value={value ?? ''} onChange={event => onChange(event.target.value)} maxLength={field.maxLength} />
      : <input {...common} type={field.type === 'image' ? 'url' : field.type || 'text'} value={value ?? ''} onChange={event => onChange(event.target.value)} maxLength={field.maxLength} inputMode={field.inputMode} />}
    {field.type === 'image' && <><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Tải ảnh cho ${field.label}`} disabled={disabled || uploading} onChange={event => upload(event.target.files?.[0])} />{uploading && <span className="hc-muted" role="status">Đang tải ảnh…</span>}{uploadError && <span className="hc-field-error" role="alert">{uploadError}</span>}{value && <img className="hc-thumb" src={value} alt="" />}</>}
    {error && <p className="hc-field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}

// Danh sách + form tạo/sửa + xóa mềm cho một collection catalog; không giữ dữ liệu giả khi API lỗi.
export default function SimpleCrud({ title, service, fields, columns, toPayload = values => values, empty }) {
  const blank = Object.fromEntries(fields.map(field => [field.name, field.type === 'checkbox' ? true : '']));
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setItems(null); setError('');
    service.list().then(data => { if (active) setItems(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [service, attempt]);

  function edit(item) {
    setEditing(item?.id ?? 'new');
    setValues(item ? Object.fromEntries(fields.map(field => [field.name, field.type === 'checkbox' ? Boolean(Number(item[field.name])) : (field.type === 'datetime-local' ? (item[field.name] || '').slice(0, 16).replace(' ', 'T') : item[field.name] ?? '')])) : blank);
    setErrors({}); setNotice(''); setError('');
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const missing = Object.fromEntries(fields.filter(field => field.required && !String(values[field.name] ?? '').trim()).map(field => [field.name, `${field.label} bắt buộc.`]));
    setErrors(missing);
    if (Object.keys(missing).length) { document.getElementById(`admin-${Object.keys(missing)[0]}`)?.focus(); return; }
    setBusy(true); setError('');
    try {
      await service.save(editing === 'new' ? null : editing, toPayload(values));
      setNotice(editing === 'new' ? `Đã thêm ${title.toLowerCase()}.` : 'Đã lưu thay đổi.');
      setEditing(null); setAttempt(current => current + 1);
    } catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    if (busy || !window.confirm(`Ngừng sử dụng "${item[columns[0][0]]}"? Dữ liệu được xóa mềm, lịch sử giữ nguyên.`)) return;
    setBusy(true); setError('');
    try { await service.remove(item.id); setNotice('Đã ngừng sử dụng.'); setAttempt(current => current + 1); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <section className="hc-card hc-form">
    <div className="hc-heading-actions"><h2>{title}</h2><button className="hc-button" type="button" disabled={busy} onClick={() => edit(null)}>Thêm mới</button></div>
    {notice && <p className="hc-success" role="status">{notice}</p>}
    {error && <p className="hc-error" role="alert">{error} {!items && <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button>}</p>}
    {editing !== null && <form className="hc-form hc-subform" noValidate onSubmit={save}>
      <h3>{editing === 'new' ? `Thêm ${title.toLowerCase()}` : `Sửa ${title.toLowerCase()} #${editing}`}</h3>
      <div className="hc-form-grid">{fields.map(field => <AdminField key={field.name} field={field} value={values[field.name]} error={errors[field.name]} disabled={busy} onChange={value => { setValues(current => ({ ...current, [field.name]: value })); setErrors(current => ({ ...current, [field.name]: '' })); }} />)}</div>
      <div className="hc-form-footer"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => setEditing(null)}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button></div>
    </form>}
    {!items && !error && <p className="hc-status" role="status">Đang tải…</p>}
    {items?.length === 0 && <p className="hc-muted">{empty}</p>}
    {items?.length > 0 && <div className="hc-table-wrap"><table className="hc-table"><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}<th scope="col">Thao tác</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>{columns.map(([key, , render]) => <td key={key}>{render ? render(item) : item[key]}</td>)}<td className="hc-row-actions"><button className="hc-text-button" type="button" disabled={busy} onClick={() => edit(item)}>Sửa</button><button className="hc-text-button hc-danger" type="button" disabled={busy} onClick={() => remove(item)}>Ngừng dùng</button></td></tr>)}</tbody></table></div>}
  </section>;
}
