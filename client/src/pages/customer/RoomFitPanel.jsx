import { useEffect, useState } from 'react';
import { CheckCircle2, CircleHelp, Pencil, Ruler, Trash2, TriangleAlert } from 'lucide-react';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import FormField from '../../components/common/FormField.jsx';
import { listProducts } from '../../services/catalog-service.js';
import { deleteRoom, listRooms, runFitCheck, saveRoom } from '../../services/room-fit-service.js';

const numberFields = [
  ['placementWidthMm', 'Chiều rộng vị trí đặt (mm)'],
  ['placementDepthMm', 'Chiều sâu vị trí đặt (mm)'],
  ['placementHeightMm', 'Chiều cao vị trí đặt (mm)'],
  ['doorWidthMm', 'Chiều rộng cửa đi qua (mm)'],
  ['floorAreaM2', 'Diện tích phòng (m²)'],
  ['occupantCount', 'Số người sử dụng'],
];
const yesNoFields = [['powerAvailable', 'Có nguồn điện phù hợp?'], ['waterSupply', 'Có nguồn cấp nước?'], ['drainage', 'Có đường thoát nước?']];
const blankRoom = Object.fromEntries(['name', ...numberFields.map(([key]) => key), ...yesNoFields.map(([key]) => key)].map(key => [key, '']));
const idle = { busy: false, error: '', errors: {}, notice: '' };
const resultStyles = { FIT: ['fit', CheckCircle2], NEEDS_CHECK: ['check', CircleHelp], NOT_FIT: ['no-fit', TriangleAlert] };
const units = { mm: 'mm', m2: 'm²', people: 'người' };

// "" là chưa biết nên gửi null, không phải 0/false; server kiểm tra lại mọi giá trị.
const toPayload = form => ({
  name: form.name,
  ...Object.fromEntries(numberFields.map(([key]) => [key, form[key] === '' ? null : Number(form[key])])),
  ...Object.fromEntries(yesNoFields.map(([key]) => [key, form[key] === '' ? null : form[key] === 'yes'])),
});
const toForm = room => ({
  name: room.name,
  ...Object.fromEntries(numberFields.map(([key]) => [key, room[key] ?? ''])),
  ...Object.fromEntries(yesNoFields.map(([key]) => [key, room[key] === null ? '' : room[key] ? 'yes' : 'no'])),
});
const defaultRoomId = rooms => String(rooms.find(room => room.isDefault)?.id ?? rooms[0]?.id ?? '');
const formatValue = (value, unit) => value === null ? 'Chưa có' : unit === 'boolean' ? (value ? 'Có' : 'Không') : `${value.toLocaleString('vi-VN')} ${units[unit]}`;
const checkLabel = check => check.status === 'PASS' ? 'Đạt' : check.status === 'MISSING' ? 'Thiếu dữ liệu' : check.severity === 'BLOCK' ? 'Vi phạm' : 'Cần lưu ý';
const roomSummary = room => [room.placementWidthMm && `R ${room.placementWidthMm}`, room.placementDepthMm && `S ${room.placementDepthMm}`, room.placementHeightMm && `C ${room.placementHeightMm}`].filter(Boolean).join(' × ') || 'Chưa có kích thước vị trí đặt';

function FitResult({ result }) {
  const [tone, Icon] = resultStyles[result.result];
  return <div className={`dt-result dt-result--${tone} dt-fit-result`} role="status">
    <Icon size={22} aria-hidden="true" /><strong>{result.label}</strong>
    {result.checks.length === 0 && <p>Sản phẩm này chưa có quy tắc FitCheck nên cần được tư vấn thêm.</p>}
    <ul className="dt-check-list">{result.checks.map(check => <li key={check.ruleId} className={`dt-check dt-check--${check.status === 'PASS' ? 'pass' : check.status === 'MISSING' ? 'missing' : 'fail'}`}>
      <div className="dt-check-head"><b>{check.title}</b><span>{checkLabel(check)}</span></div>
      <p>{check.explanation}</p>
      <small>Giá trị: {formatValue(check.actual, check.unit)} · So với: {formatValue(check.limit, check.unit)}{check.margin > 0 && ` · Khoảng hở: ${check.margin} mm`}</small>
    </li>)}</ul>
  </div>;
}

// HOME-01/FIT-01: mọi dữ liệu và kết luận đến từ API, không tính lại ở trình duyệt.
export default function RoomFitPanel() {
  const [rooms, setRooms] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(blankRoom);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(idle);
  const [roomId, setRoomId] = useState('');
  const [productId, setProductId] = useState('');
  const [checking, setChecking] = useState({ busy: false, error: '' });
  const [result, setResult] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removeState, setRemoveState] = useState({ busy: false, error: '' });

  useEffect(() => {
    let active = true;
    setLoadError('');
    Promise.all([listRooms(), listProducts({ is_active: '1' })])
      .then(([roomItems, productItems]) => { if (active) { setRooms(roomItems); setProducts(productItems); setRoomId(defaultRoomId(roomItems)); } })
      .catch(error => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [reload]);

  const resetForm = () => { setForm(blankRoom); setEditingId(null); setSaving(idle); };
  const editRoom = room => { setForm(toForm(room)); setEditingId(room.id); setSaving(idle); };

  const submitRoom = async event => {
    event.preventDefault();
    if (saving.busy) return;
    setSaving({ ...idle, busy: true });
    try {
      const saved = await saveRoom(editingId, toPayload(form));
      setRooms(current => editingId ? current.map(room => room.id === saved.id ? saved : room) : [saved, ...current]);
      setRoomId(String(saved.id));
      setResult(null);
      setForm(blankRoom);
      setEditingId(null);
      setSaving({ ...idle, notice: `Đã lưu hồ sơ "${saved.name}".` });
    } catch (error) { setSaving({ ...idle, error: error.message, errors: error.errors || {} }); }
  };

  const confirmRemove = async () => {
    setRemoveState({ busy: true, error: '' });
    try {
      await deleteRoom(removing.id);
      const remaining = rooms.filter(room => room.id !== removing.id);
      setRooms(remaining);
      if (roomId === String(removing.id)) { setRoomId(defaultRoomId(remaining)); setResult(null); }
      if (editingId === removing.id) resetForm();
      setRemoving(null);
      setRemoveState({ busy: false, error: '' });
    } catch (error) { setRemoveState({ busy: false, error: error.message }); }
  };

  const check = async () => {
    setChecking({ busy: true, error: '' });
    setResult(null);
    try {
      setResult(await runFitCheck(Number(productId), Number(roomId)));
      setChecking({ busy: false, error: '' });
    } catch (error) { setChecking({ busy: false, error: error.message }); }
  };

  if (loadError) return <section className="hc-card"><p className="hc-error" role="alert">{loadError}</p><button className="hc-button hc-button--outline" type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></section>;
  if (rooms === null) return <section className="hc-card"><p className="hc-muted" role="status">Đang tải hồ sơ phòng…</p></section>;

  const categories = [...new Set(products.map(product => product.category_name))];
  const setField = key => value => setForm(current => ({ ...current, [key]: value }));
  return <div className="dt-stack">
    <section className="hc-card"><h2>Kiểm tra sản phẩm với không gian</h2><p className="hc-muted">Kết quả dựa trên kích thước sản phẩm, khoảng hở lắp đặt, diện tích, điện nước và quy tắc theo danh mục.</p>
      <div className="hc-form-grid">
        <div className="hc-field"><label htmlFor="fit-room">Hồ sơ phòng</label><select id="fit-room" value={roomId} disabled={checking.busy} onChange={event => { setRoomId(event.target.value); setResult(null); }}>{rooms.length === 0 && <option value="">Chưa có hồ sơ</option>}{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div>
        <div className="hc-field"><label htmlFor="fit-product">Sản phẩm</label><select id="fit-product" value={productId} disabled={checking.busy} onChange={event => { setProductId(event.target.value); setResult(null); }}><option value="">Chọn sản phẩm</option>{categories.map(category => <optgroup key={category} label={category}>{products.filter(product => product.category_name === category).map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</optgroup>)}</select></div>
      </div>
      <button className="hc-button dt-fit-run" type="button" disabled={checking.busy || !roomId || !productId} onClick={check}>{checking.busy ? 'Đang kiểm tra…' : 'Chạy FitCheck'}</button>
      {checking.error && <p className="hc-error" role="alert">{checking.error}</p>}
      {result ? <FitResult result={result} /> : !checking.busy && !checking.error && <div className="dt-placeholder">Chọn hồ sơ phòng và sản phẩm để xem kết quả: Phù hợp, Cần kiểm tra thêm hoặc Không phù hợp.</div>}
    </section>
    <div className="dt-grid dt-grid--room">
      <section className="hc-card"><div className="dt-section-head"><Ruler size={21} aria-hidden="true" /><div><h2>{editingId ? 'Sửa hồ sơ không gian' : 'Thêm hồ sơ không gian'}</h2><p className="hc-muted">Nhập kích thước theo mm (32 cm = 320 mm). Bỏ trống nếu chưa biết.</p></div></div>
        <form className="hc-form dt-room-form" noValidate onSubmit={submitRoom}>
          <FormField id="room-name" label="Tên không gian" required maxLength={120} placeholder="Ví dụ: Góc bếp" value={form.name} onChange={setField('name')} error={saving.errors.name} />
          <div className="hc-form-grid">{numberFields.map(([key, label]) => <FormField key={key} id={`room-${key}`} label={label} type="number" min="1" step={key === 'floorAreaM2' ? '0.01' : '1'} placeholder="Chưa nhập" value={form[key]} onChange={setField(key)} error={saving.errors[key]} />)}</div>
          <div className="hc-form-grid">{yesNoFields.map(([key, label]) => <div className="hc-field" key={key}><label htmlFor={`room-${key}`}>{label}</label><select id={`room-${key}`} value={form[key]} onChange={event => setField(key)(event.target.value)}><option value="">Chưa rõ</option><option value="yes">Có</option><option value="no">Không</option></select></div>)}</div>
          {saving.error && <p className="hc-error" role="alert">{saving.error}</p>}
          {saving.notice && <p className="hc-success" role="status">{saving.notice}</p>}
          <div className="hc-form-footer"><span /><span className="hc-actions">{editingId && <button className="hc-button hc-button--outline" type="button" onClick={resetForm}>Hủy sửa</button>}<button className="hc-button" type="submit" disabled={saving.busy}>{saving.busy ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Lưu hồ sơ'}</button></span></div>
        </form>
      </section>
      <section className="hc-card"><h2>Hồ sơ đã lưu</h2>
        {rooms.length === 0 ? <div className="dt-placeholder">Chưa có hồ sơ nào. Hãy thêm hồ sơ để kiểm tra sản phẩm.</div> : <ul className="dt-room-list">{rooms.map(room => <li key={room.id}><div><b>{room.name}</b><small>{roomSummary(room)}</small></div><span className="dt-room-actions"><button className="hc-button hc-button--outline" type="button" aria-label={`Sửa ${room.name}`} onClick={() => editRoom(room)}><Pencil size={16} aria-hidden="true" /></button><button className="hc-button hc-button--outline" type="button" aria-label={`Xóa ${room.name}`} onClick={() => { setRemoveState({ busy: false, error: '' }); setRemoving(room); }}><Trash2 size={16} aria-hidden="true" /></button></span></li>)}</ul>}
      </section>
    </div>
    {removing &&<ConfirmDialog title="Xóa hồ sơ phòng này?" description="Hồ sơ sẽ không còn dùng được cho FitCheck." summary={removing.name} confirmLabel="Xóa hồ sơ" busy={removeState.busy} error={removeState.error} onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />}
  </div>;
}
