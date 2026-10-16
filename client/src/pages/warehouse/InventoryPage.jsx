import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { adjustStock, listInventory } from '../../services/catalog-service.js';

const statusLabels = { in_stock: 'Còn hàng', low_stock: 'Sắp hết', out_of_stock: 'Hết hàng' };
// Mã chứng từ duy nhất cho mỗi lần bấm lưu; server từ chối mã trùng (409) nên gửi lặp không cộng tồn hai lần.
const referenceCode = () => `ADJ-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${crypto.getRandomValues(new Uint16Array(1))[0].toString(16).padStart(4, '0')}`;

// WH-01..03: xem tồn/ngưỡng theo SKU, lọc hàng sắp hết, điều chỉnh tăng/giảm kèm lý do (ADMIN, WAREHOUSE).
export default function InventoryPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [version, setVersion] = useState(0);
  const [target, setTarget] = useState(null);
  const [values, setValues] = useState({ movement_type: 'import', quantity: '', note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { document.title = 'Tồn kho · HomeCare'; }, []);
  useEffect(() => {
    let active = true;
    setItems(null); setError('');
    listInventory(lowOnly).then(data => { if (active) setItems(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [lowOnly, version]);

  function open(item) { setTarget({ ...item, reference: referenceCode() }); setValues({ movement_type: 'import', quantity: '', note: '' }); setErrors({}); setResult(null); }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const quantity = Number(values.quantity);
    const nextErrors = {
      quantity: Number.isInteger(quantity) && quantity > 0 ? (values.movement_type === 'export' && quantity > target.stock_quantity ? 'Không được giảm quá tồn hiện tại.' : '') : 'Số lượng là số nguyên dương.',
      note: values.note.trim() ? '' : 'Hãy nhập lý do điều chỉnh.',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true); setError('');
    try {
      setResult(await adjustStock({ sku: target.sku, movement_type: values.movement_type, quantity, reference_code: target.reference, note: values.note.trim() }));
      setTarget(null); setVersion(current => current + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const lowCount = items?.filter(item => item.stock_status !== 'in_stock').length ?? 0;
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Kho hàng</span><h1>Tồn kho theo SKU</h1><p>Mỗi lần điều chỉnh ghi tồn trước/sau, người thực hiện và lý do. Không cho phép tồn âm. <Link to="/warehouse/history">Xem lịch sử kho →</Link></p></div>
    {result && <p className="hc-success" role="status">Đã ghi nhận {result.sku}: {result.quantity_before} → {result.quantity_after} ({result.reference_code}).</p>}
    {error && <p className="hc-error" role="alert">{error} {!items && <button className="hc-text-button" type="button" onClick={() => setVersion(current => current + 1)}>Thử lại</button>}</p>}
    {target && <form className="hc-card hc-form" noValidate onSubmit={save} aria-label={`Điều chỉnh ${target.sku}`}><h2>Điều chỉnh {target.sku} · {target.product_name}</h2><p className="hc-muted">Tồn hiện tại: <strong>{target.stock_quantity}</strong> · Mã chứng từ: {target.reference}</p>
      <div className="hc-form-grid">
        <AdminField field={{ name: 'movement_type', label: 'Loại', type: 'select', options: [['import', 'Tăng (nhập kho)'], ['export', 'Giảm (xuất/hư hỏng)']], placeholder: 'Chọn loại' }} value={values.movement_type} disabled={busy} onChange={movement_type => setValues(current => ({ ...current, movement_type }))} />
        <AdminField field={{ name: 'quantity', label: 'Số lượng', inputMode: 'numeric', required: true }} value={values.quantity} error={errors.quantity} disabled={busy} onChange={quantity => { setValues(current => ({ ...current, quantity })); setErrors(current => ({ ...current, quantity: '' })); }} />
        <AdminField field={{ name: 'note', label: 'Lý do', required: true, maxLength: 500 }} value={values.note} error={errors.note} disabled={busy} onChange={note => { setValues(current => ({ ...current, note })); setErrors(current => ({ ...current, note: '' })); }} />
      </div>
      <div className="hc-form-footer"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => setTarget(null)}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Ghi nhận điều chỉnh'}</button></div>
    </form>}
    <div className="hc-card hc-form">
      <div className="hc-heading-actions"><h2>Danh sách SKU {items && lowCount > 0 && <span className="hc-badge hc-badge--warn">{lowCount} sắp hết/hết hàng</span>}</h2><label className="hc-check"><input type="checkbox" checked={lowOnly} onChange={event => setLowOnly(event.target.checked)} />Chỉ hàng sắp hết (WH-02)</label></div>
      {!items ? !error && <p role="status" className="hc-muted">Đang tải tồn kho…</p> : items.length === 0 ? <p className="hc-muted">{lowOnly ? 'Không có SKU nào dưới ngưỡng cảnh báo.' : 'Chưa có SKU.'}</p>
        : <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Sản phẩm</th><th scope="col">Danh mục</th><th scope="col">Tồn</th><th scope="col">Ngưỡng</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.variant_id}><td>{item.sku}</td><td>{item.product_name} · {item.variant_name}</td><td>{item.category_name}</td><td><strong>{item.stock_quantity}</strong></td><td>{item.low_stock_threshold}</td><td><span className={`hc-badge${item.stock_status !== 'in_stock' ? ' hc-badge--warn' : ''}`}>{statusLabels[item.stock_status]}</span></td><td><button className="hc-text-button" type="button" disabled={busy} onClick={() => open(item)}>Điều chỉnh</button></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
