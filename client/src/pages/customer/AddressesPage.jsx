import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import FormField from '../../components/common/FormField.jsx';
import { useAuth } from '../../context/auth-context.js';
import { listAddresses, saveAddress, deleteAddress } from '../../services/user-service.js';
import { addressErrors } from '../../utils/account-validation.js';

// CRUD chỉ qua service; danh sách trả về đã bảo đảm chủ sở hữu và mặc định.
export default function AddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Địa chỉ nhận hàng · HomeCare';
    let active = true;
    setLoading(true);
    listAddresses().then(items => { if (active) { setAddresses(items); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, attempt]);

  useEffect(() => {
    if (editor) document.getElementById('address-recipientName')?.focus();
  }, [editor?.id, Boolean(editor)]);

  function start(address) {
    setEditor(address ? { ...address } : { recipientName: user.fullName, phone: user.phone, addressLine: '', province: '', district: '', ward: '', isDefault: addresses.length === 0 });
    setErrors({}); setNotice(''); setError(''); setPendingDelete(null);
  }

  function change(field, value) { setEditor(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setError(''); }

  async function perform(action, message) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { setAddresses(await action()); setEditor(null); setPendingDelete(null); setNotice(message); }
    catch (err) { setError(err.message); setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  function save(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = addressErrors(editor);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { document.getElementById(`address-${Object.keys(nextErrors)[0]}`)?.focus(); return; }
    const { id, ...values } = editor;
    perform(() => saveAddress(id, values), id ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ nhận hàng.');
  }

  return <section><div className="hc-page-heading hc-heading-actions"><div><span className="hc-eyebrow">Tài khoản</span><h1>Địa chỉ nhận hàng</h1><p>Giữ thông tin nhận hàng đầy đủ và chọn một địa chỉ mặc định.</p></div><button className="hc-button" type="button" disabled={busy || loading} onClick={() => start()}><Plus size={18} />Thêm địa chỉ</button></div>
    {notice && <p className="hc-success" role="status">{notice}</p>}{error && <div className="hc-error" role="alert"><p>{error}</p><button type="button" className="hc-text-button" disabled={busy} onClick={() => setAttempt(current => current + 1)}>Tải lại danh sách</button></div>}
    {loading ? <p className="hc-status" role="status">Đang tải địa chỉ…</p> : <div className={`hc-address-layout${editor ? ' hc-address-layout--editing' : ''}`}><div className="hc-address-list">
      {!addresses.length && <div className="hc-card hc-empty"><MapPin size={38} /><h2>Chưa có địa chỉ</h2><p>Thêm địa chỉ đầu tiên để bắt đầu. Địa chỉ này sẽ được chọn làm mặc định.</p></div>}
      {addresses.map(address => <article className="hc-card hc-address-card" key={address.id}><div className="hc-address-heading"><h2>{address.recipientName}</h2>{address.isDefault && <span className="hc-badge">Mặc định</span>}</div><p className="hc-muted">{address.phone}</p><p>{[address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(', ')}</p><div className="hc-address-actions"><button type="button" className="hc-text-button" disabled={busy} onClick={() => start(address)}>Chỉnh sửa</button><button type="button" className="hc-text-button hc-danger" disabled={busy} onClick={() => { setPendingDelete(address.id); setEditor(null); }}>Xóa</button>{!address.isDefault && <button type="button" className="hc-text-button" disabled={busy} onClick={() => perform(() => saveAddress(address.id, { isDefault: true }), 'Đã đổi địa chỉ mặc định.')}>Đặt làm mặc định</button>}</div>{pendingDelete === address.id && <div className="hc-delete-confirm"><p>Xóa địa chỉ này? Nếu là địa chỉ mặc định, một địa chỉ còn lại sẽ được chọn thay thế.</p><button className="hc-button hc-button--danger" type="button" disabled={busy} onClick={() => perform(() => deleteAddress(address.id), 'Đã xóa địa chỉ.')}>Xác nhận xóa</button><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => setPendingDelete(null)}>Giữ lại</button></div>}</article>)}
    </div>{editor && <form className="hc-card hc-form hc-address-form" noValidate onSubmit={save}><div className="hc-address-heading"><h2>{editor.id ? 'Chỉnh sửa địa chỉ' : 'Địa chỉ mới'}</h2><button className="hc-text-button" type="button" disabled={busy} onClick={() => setEditor(null)}>Đóng</button></div><p className="hc-muted">Trường có dấu * là bắt buộc.</p>
      <FormField id="address-recipientName" label="Tên người nhận" value={editor.recipientName} onChange={value => change('recipientName', value)} error={errors.recipientName} required maxLength={150} autoComplete="name" disabled={busy} />
      <FormField id="address-phone" label="Số điện thoại" value={editor.phone} onChange={value => change('phone', value)} error={errors.phone} required type="tel" maxLength={20} autoComplete="tel" disabled={busy} />
      <FormField id="address-province" label="Tỉnh / thành phố" value={editor.province} onChange={value => change('province', value)} error={errors.province} required maxLength={100} autoComplete="address-level1" disabled={busy} />
      <div className="hc-form-row"><FormField id="address-district" label="Quận / huyện (nếu có)" value={editor.district} onChange={value => change('district', value)} error={errors.district} maxLength={100} autoComplete="address-level2" disabled={busy} /><FormField id="address-ward" label="Phường / xã (nếu có)" value={editor.ward} onChange={value => change('ward', value)} error={errors.ward} maxLength={100} autoComplete="address-level3" disabled={busy} /></div>
      <FormField id="address-addressLine" label="Số nhà, tên đường" value={editor.addressLine} onChange={value => change('addressLine', value)} error={errors.addressLine} required maxLength={255} autoComplete="street-address" disabled={busy} />
      <label className="hc-checkbox"><input type="checkbox" checked={editor.isDefault} disabled={busy || !addresses.length || Boolean(addresses.find(item => item.id === editor.id)?.isDefault)} onChange={event => change('isDefault', event.target.checked)} />Đặt làm địa chỉ mặc định</label>{errors.isDefault && <p className="hc-field-error">{errors.isDefault}</p>}<button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu địa chỉ'}</button>
    </form>}</div>}
  </section>;
}
