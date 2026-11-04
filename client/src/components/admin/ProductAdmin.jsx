import { Package, Pencil, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../data.js';
import { addProductImage, createCategoryAttribute, deleteProductImage, deleteVariant, getProductAttributes, listProductImages, listProducts, listVariants, products, saveProductAttributes, saveVariant, updateProductImage, uploadImage } from '../../services/catalog-service.js';
import { toMoneyValue } from '../../utils/money-input.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Modal from './Modal.jsx';
import { AdminField } from './SimpleCrud.jsx';
import { Chips, DataTable, EmptyCard, SearchBox } from './ui.jsx';

const toLocal = value => (value || '').slice(0, 16).replace(' ', 'T');
const slugify = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const bind = field => ({ field, value: values[field.name], error: errors[field.name], onChange: value => { setValues(current => ({ ...current, [field.name]: value })); setErrors(current => ({ ...current, [field.name]: '' })); } });
  return { values, setValues, errors, setErrors, bind };
}

// PRD-05 + ADM-PRO-03: SKU, giá, giá khuyến mãi theo thời gian, ngưỡng cảnh báo; tồn chỉ đổi ở màn hình kho.
function VariantPanel({ product }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const form = useForm({});
  const reload = () => listVariants(product.id).then(setItems).catch(err => setError(err.message));
  useEffect(() => { setItems(null); reload(); }, [product.id]);

  function edit(item) {
    setEditing(item?.id ?? 'new'); setError('');
    form.setErrors({});
    form.setValues(item ? { sku: item.sku, variant_name: item.variant_name, price: toMoneyValue(item.price), sale_price: toMoneyValue(item.sale_price), sale_starts_at: toLocal(item.sale_starts_at), sale_ends_at: toLocal(item.sale_ends_at), low_stock_threshold: String(item.low_stock_threshold), is_active: Boolean(Number(item.is_active)) }
      : { sku: '', variant_name: '', price: '', sale_price: '', sale_starts_at: '', sale_ends_at: '', low_stock_threshold: '5', is_active: true });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const v = form.values;
    const errors = { sku: v.sku.trim() ? '' : 'SKU bắt buộc.', variant_name: v.variant_name.trim() ? '' : 'Tên biến thể bắt buộc.', price: /^\d+(\.\d{1,2})?$/.test(v.price) ? '' : 'Giá không hợp lệ.', sale_price: !v.sale_price || (/^\d+(\.\d{1,2})?$/.test(v.sale_price) && Number(v.sale_price) < Number(v.price)) ? '' : 'Giá khuyến mãi phải hợp lệ và thấp hơn giá bán.', low_stock_threshold: /^\d+$/.test(v.low_stock_threshold) ? '' : 'Ngưỡng là số nguyên ≥ 0.' };
    form.setErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true); setError('');
    try {
      const body = { variant_name: v.variant_name.trim(), price: v.price, sale_price: v.sale_price || null, sale_starts_at: v.sale_starts_at || null, sale_ends_at: v.sale_ends_at || null, low_stock_threshold: Number(v.low_stock_threshold), is_active: v.is_active };
      await saveVariant(product.id, editing === 'new' ? null : editing, editing === 'new' ? { sku: v.sku.trim(), ...body } : body);
      setEditing(null); await reload();
    } catch (err) { setError(err.message); form.setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try { await deleteVariant(removing.id); setRemoving(null); await reload(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const fields = [
    { name: 'sku', label: 'Mã SKU', required: true, maxLength: 80 }, { name: 'variant_name', label: 'Tên biến thể', required: true, maxLength: 150 },
    { name: 'price', label: 'Giá bán', type: 'money', required: true }, { name: 'sale_price', label: 'Giá khuyến mãi', type: 'money' },
    { name: 'sale_starts_at', label: 'Khuyến mãi từ', type: 'datetime-local' }, { name: 'sale_ends_at', label: 'Khuyến mãi đến', type: 'datetime-local' },
    { name: 'low_stock_threshold', label: 'Ngưỡng cảnh báo sắp hết', inputMode: 'numeric' }, { name: 'is_active', label: 'Đang bán', type: 'checkbox' },
  ].map(field => ({ ...field, id: `variant-${field.name}` })); // Không trùng id với form sản phẩm đang mở cùng lúc.
  return <section className="hc-subform hc-form"><div className="hc-heading-actions"><h3>SKU và giá</h3><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => edit(null)}>Thêm SKU</button></div>
    {error && !removing && <p className="hc-error" role="alert">{error}</p>}
    {removing && <ConfirmDialog title="Xóa SKU này?" description="Lịch sử kho giữ nguyên, mã SKU không dùng lại được." summary={removing.sku} detail={removing.variant_name} confirmLabel="Xóa SKU" busy={busy} error={error} onConfirm={remove} onCancel={() => { setRemoving(null); setError(''); }} />}
    {editing !== null && <form className="hc-form" noValidate onSubmit={save}><div className="hc-form-grid">{fields.map(field => <AdminField key={field.name} {...form.bind(field)} disabled={busy || (field.name === 'sku' && editing !== 'new')} />)}</div>
      <p className="hc-muted">Tồn kho của SKU mới bằng 0; nhập hàng tại màn hình Tồn kho để có lịch sử.</p>
      <div className="hc-form-footer"><button className="hc-button hc-button--outline" type="button" onClick={() => setEditing(null)}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu SKU'}</button></div></form>}
    {!items ? !error && <p role="status" className="hc-muted">Đang tải SKU…</p> : <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Biến thể</th><th scope="col">Giá</th><th scope="col">Khuyến mãi</th><th scope="col">Tồn</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td>{item.sku}</td><td>{item.variant_name}</td><td>{formatPrice(Number(item.price))}</td><td>{item.sale_price ? `${formatPrice(Number(item.sale_price))}${item.sale_ends_at ? ` đến ${item.sale_ends_at.slice(0, 16)}` : ''}` : '—'}</td><td>{item.stock_quantity}</td><td>{Number(item.is_active) ? 'Đang bán' : 'Ngừng bán'}</td><td className="hc-row-actions"><button className="hc-text-button" type="button" disabled={busy} onClick={() => edit(item)}>Sửa</button><button className="hc-text-button hc-danger" type="button" disabled={busy || items.length < 2 || Number(item.stock_quantity) > 0} title={items.length < 2 ? 'Cần giữ ít nhất một SKU' : Number(item.stock_quantity) > 0 ? 'Điều chỉnh tồn về 0 trước khi xóa' : undefined} onClick={() => { setError(''); setRemoving(item); }}>Xóa</button></td></tr>)}</tbody></table></div>}
  </section>;
}

// PRD-06: giá trị thông số theo thuộc tính danh mục; thiếu giá trị để trống, không tự điền 0.
function SpecPanel({ product }) {
  const [attributes, setAttributes] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const definition = useForm({ new_name: '', new_key: '', new_type: 'number', new_unit: '' });
  const reload = () => getProductAttributes(product.id).then(rows => {
    setAttributes(rows);
    setValues(Object.fromEntries(rows.map(row => [row.attribute_id, row.data_type === 'boolean' ? (row.value_boolean === null ? '' : String(row.value_boolean)) : row.data_type === 'number' ? (row.value_number === null ? '' : String(Number(row.value_number))) : row.value_text ?? ''])));
  }).catch(err => setError(err.message));
  useEffect(() => { setAttributes(null); reload(); }, [product.id]);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const filled = attributes.filter(row => values[row.attribute_id] !== '').map(row => ({ attribute_id: Number(row.attribute_id), value: row.data_type === 'number' ? Number(values[row.attribute_id]) : row.data_type === 'boolean' ? values[row.attribute_id] === '1' : values[row.attribute_id] }));
      await saveProductAttributes(product.id, filled);
      setNotice('Đã lưu thông số.'); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function addDefinition(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { new_name, new_key, new_type, new_unit } = definition.values;
      await createCategoryAttribute(product.category_id, { name: new_name, attribute_key: new_key, data_type: new_type, unit: new_unit || undefined, is_required: false });
      definition.setValues({ new_name: '', new_key: '', new_type: 'number', new_unit: '' }); await reload();
    } catch (err) { setError(err.message); const { name, attribute_key, data_type, unit } = err.errors || {}; definition.setErrors({ new_name: name, new_key: attribute_key, new_type: data_type, new_unit: unit }); }
    finally { setBusy(false); }
  }

  return <section className="hc-subform hc-form"><h3>Thông số kỹ thuật ({product.category_name})</h3>
    {error && <p className="hc-error" role="alert">{error}</p>}{notice && <p className="hc-success" role="status">{notice}</p>}
    {!attributes ? !error && <p role="status" className="hc-muted">Đang tải thông số…</p> : attributes.length === 0 ? <p className="hc-muted">Danh mục chưa có thuộc tính. Thêm thuộc tính bên dưới.</p>
      : <form className="hc-form" noValidate onSubmit={save}><div className="hc-form-grid">{attributes.map(row => <AdminField key={row.attribute_id} field={{ name: `spec-${row.attribute_id}`, label: `${row.name}${row.unit ? ` (${row.unit})` : ''}`, type: row.data_type === 'boolean' ? 'select' : 'text', inputMode: row.data_type === 'number' ? 'decimal' : undefined, options: [['1', 'Có'], ['0', 'Không']], placeholder: 'Chưa có dữ liệu' }} value={values[row.attribute_id]} disabled={busy} onChange={value => setValues(current => ({ ...current, [row.attribute_id]: value }))} />)}</div>
        <div className="hc-form-footer"><span className="hc-muted">Để trống nếu chưa có dữ liệu — FitCheck/TCO sẽ báo thiếu thay vì coi là 0.</span><button className="hc-button" type="submit" disabled={busy}>Lưu thông số</button></div></form>}
    <form className="hc-form hc-inline-form" noValidate onSubmit={addDefinition} aria-label="Thêm thuộc tính cho danh mục">
      <AdminField {...definition.bind({ name: 'new_name', label: 'Tên thuộc tính mới', maxLength: 100 })} disabled={busy} />
      <AdminField {...definition.bind({ name: 'new_key', label: 'Khóa (vd: width_mm)', maxLength: 100 })} disabled={busy} />
      <AdminField {...definition.bind({ name: 'new_type', label: 'Kiểu', type: 'select', options: [['number', 'Số'], ['text', 'Chữ'], ['boolean', 'Có/Không']] })} disabled={busy} />
      <AdminField {...definition.bind({ name: 'new_unit', label: 'Đơn vị', maxLength: 30 })} disabled={busy} />
      <button className="hc-button hc-button--outline" type="submit" disabled={busy || !definition.values.new_name || !definition.values.new_key}>Thêm thuộc tính</button>
    </form>
  </section>;
}

// PRD-04: nhiều ảnh (tối đa 10), chọn ảnh đại diện, sắp thứ tự (số nhỏ đứng trước), xóa mềm.
function ImagePanel({ product, onChanged }) {
  const [images, setImages] = useState(null);
  const [orders, setOrders] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [removing, setRemoving] = useState(null);
  const apply = rows => { setImages(rows); setOrders(Object.fromEntries(rows.map(row => [row.id, String(row.sort_order)]))); };
  useEffect(() => { setImages(null); listProductImages(product.id).then(apply).catch(err => setError(err.message)); }, [product.id]);

  async function run(action) {
    if (busy) return;
    setBusy(true); setError('');
    try { const rows = await action(); apply(rows); onChanged(rows.find(row => Number(row.is_primary))?.image_url || ''); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  // Chọn nhiều ảnh hoặc kéo thả: tải lên tuần tự qua uploadImage rồi gắn vào sản phẩm; server vẫn kiểm tra loại và dung lượng.
  function addFiles(list) {
    const files = [...list];
    const count = images?.length ?? 0;
    if (!files.length || busy) return;
    if (files.length > 10 - count) { setError(`Chỉ thêm được tối đa ${10 - count} ảnh nữa (giới hạn 10 ảnh).`); return; }
    const bad = files.find(file => !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024);
    if (bad) { setError(`"${bad.name}" không phải ảnh JPEG/PNG/WebP hoặc lớn hơn 5 MB.`); return; }
    run(async () => { let rows; for (const [index, file] of files.entries()) rows = await addProductImage(product.id, { image_url: await uploadImage(file, 'products'), sort_order: (count + index) * 10 }); return rows; });
  }

  return <section className="hc-subform hc-form"><h3>Ảnh sản phẩm ({images?.length ?? 0}/10)</h3>
    <div className={`hc-dz${over ? ' is-over' : ''}`} onDragOver={event => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={event => { event.preventDefault(); setOver(false); addFiles(event.dataTransfer.files); }}>
      <Upload size={28} aria-hidden="true" /><span>Kéo thả ảnh vào đây hoặc chọn từ máy</span><small>JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh, tối đa 10 ảnh. Ảnh đầu tiên tự thành ảnh đại diện.</small>
      <label className="hc-button hc-button--outline hc-file-button">{busy ? 'Đang xử lý…' : 'Chọn ảnh'}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || images?.length >= 10} onChange={event => { addFiles(event.target.files); event.target.value = ''; }} /></label>
    </div>
    {error && !removing && <p className="hc-error" role="alert">{error}</p>}
    {removing && <ConfirmDialog title="Xóa ảnh này?" description="Ảnh được gỡ khỏi sản phẩm." summary={`Ảnh ${removing.id}`} detail={product.name} confirmLabel="Xóa ảnh" busy={busy} error={error} onConfirm={async () => { await run(() => deleteProductImage(removing.id)); setRemoving(null); }} onCancel={() => { setRemoving(null); setError(''); }} />}
    {!images ? !error && <p role="status" className="hc-muted">Đang tải ảnh…</p> : images.length === 0 ? <p className="hc-muted">Chưa có ảnh.</p>
      : <div className="hc-image-grid">{images.map(image => <div className="hc-image-card" key={image.id}>
        <img src={image.image_url} alt={`Ảnh ${image.id} của ${product.name}`} />
        {Number(image.is_primary) ? <span className="hc-badge">Ảnh đại diện</span> : <button className="hc-text-button" type="button" disabled={busy} onClick={() => run(() => updateProductImage(image.id, { is_primary: true }))}>Đặt làm đại diện</button>}
        <label className="hc-check">Thứ tự <input type="number" min="0" value={orders[image.id] ?? ''} disabled={busy} aria-label={`Thứ tự ảnh ${image.id}`} onChange={event => setOrders(current => ({ ...current, [image.id]: event.target.value }))} onBlur={() => Number(orders[image.id]) !== Number(image.sort_order) && /^\d+$/.test(orders[image.id]) && run(() => updateProductImage(image.id, { sort_order: Number(orders[image.id]) }))} /></label>
        <button className="hc-text-button hc-danger" type="button" disabled={busy} onClick={() => { setError(''); setRemoving(image); }}>Xóa ảnh</button>
      </div>)}</div>}
  </section>;
}

// PRD-03/04: tạo/sửa/ngừng bán sản phẩm, ảnh đại diện; sản phẩm đã có đơn chỉ vô hiệu hóa (xóa mềm).
export default function ProductAdmin({ categoryOptions, brandOptions, adding }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ keyword: '', category_id: '', is_active: '' });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(null);
  const form = useForm({});
  const [version, setVersion] = useState(0);
  const reload = () => setVersion(current => current + 1);
  // Debounce tìm kiếm và bỏ phản hồi cũ khi bộ lọc đổi trước khi request trước trả về.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => listProducts(filters).then(data => { if (active) { setItems(data); setError(''); } }).catch(err => { if (active) setError(err.message); }), 300);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, version]);

  useEffect(() => { if (adding) open(null); }, [adding]); // nút "Thêm sản phẩm" ở tiêu đề trang

  function open(item) {
    setSelected(item ?? 'new'); setNotice(''); setError(''); form.setErrors({});
    form.setValues(item ? { category_id: String(item.category_id), brand_id: String(item.brand_id), product_code: item.product_code, name: item.name, slug: item.slug, description: item.description || '', warranty_months: String(item.warranty_months), is_active: Boolean(Number(item.is_active)) }
      : { category_id: '', brand_id: '', product_code: '', name: '', slug: '', description: '', warranty_months: '12', is_active: true, sku: '', variant_name: 'Tiêu chuẩn', price: '' });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const v = form.values;
    const required = ['category_id', 'brand_id', 'product_code', 'name', ...(selected === 'new' ? ['sku', 'variant_name', 'price'] : [])];
    const errors = Object.fromEntries(required.filter(name => !String(v[name] ?? '').trim()).map(name => [name, 'Bắt buộc.']));
    if (!/^\d{1,3}$/.test(v.warranty_months)) errors.warranty_months = 'Số tháng bảo hành không hợp lệ.';
    if (selected === 'new' && v.price && !/^\d+(\.\d{1,2})?$/.test(v.price)) errors.price = 'Giá không hợp lệ.';
    form.setErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true); setError('');
    try {
      const body = { category_id: Number(v.category_id), brand_id: Number(v.brand_id), product_code: v.product_code.trim(), name: v.name.trim(), slug: v.slug.trim() || slugify(`${v.name}-${v.product_code}`), description: v.description, warranty_months: Number(v.warranty_months), is_active: v.is_active ? 1 : 0 };
      const saved = await products.save(selected === 'new' ? null : selected.id, selected === 'new' ? { ...body, sku: v.sku.trim(), variant_name: v.variant_name.trim(), price: v.price } : body);
      setNotice('Đã lưu sản phẩm.');
      reload();
      setSelected(current => current === 'new' ? { ...saved, category_name: categoryOptions.find(([id]) => id === String(saved.category_id))?.[1] } : { ...current, ...body });
    } catch (err) { setError(err.message); form.setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  async function removeProduct() {
    if (busy) return;
    setBusy(true); setError('');
    try { await products.remove(deleting.id); setDeleting(null); setSelected(null); setNotice('Đã xóa sản phẩm.'); reload(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const fields = [
    { name: 'name', label: 'Tên sản phẩm', required: true, maxLength: 255, wide: true },
    { name: 'product_code', label: 'Mã sản phẩm', required: true, maxLength: 60 }, { name: 'category_id', label: 'Danh mục', type: 'select', options: categoryOptions, required: true },
    { name: 'brand_id', label: 'Thương hiệu', type: 'select', options: brandOptions, required: true }, { name: 'warranty_months', label: 'Bảo hành (tháng)', inputMode: 'numeric' },
    { name: 'slug', label: 'Slug (để trống sẽ tự tạo)', maxLength: 280 },
    ...(selected === 'new' ? [{ name: 'sku', label: 'SKU đầu tiên', required: true, maxLength: 80 }, { name: 'variant_name', label: 'Tên biến thể', required: true }, { name: 'price', label: 'Giá bán', type: 'money', required: true }] : []),
    { name: 'description', label: 'Mô tả', type: 'textarea', maxLength: 5000, wide: true },
  ];

  const statusOptions = [['', 'Tất cả'], ['1', 'Đang bán'], ['0', 'Ẩn']];
  const columns = [
    { key: 'name', label: 'Sản phẩm', width: 'minmax(0, 2.4fr)', render: item => <div className="ad-name"><span className="ad-thumb" aria-hidden="true">{item.primary_image ? <img src={item.primary_image} alt="" /> : <Package size={22} />}</span><div><b>{item.name}</b><span className="ad-sub">{item.product_code}</span></div></div> },
    { key: 'category', label: 'Danh mục', width: '150px', render: item => item.category_name },
    { key: 'price', label: 'Giá bán', width: '130px', render: item => <span className="ad-strong">{formatPrice(Number(item.min_price))}</span> },
    { key: 'stock', label: 'Tồn kho', width: '80px', render: item => <span className={Number(item.total_stock) === 0 ? 'ad-low' : undefined}>{item.total_stock}</span> },
    { key: 'status', label: 'Trạng thái', width: '120px', render: item => Number(item.is_active) ? <span className="hc-badge hc-badge--in">Đang bán</span> : <span className="hc-badge hc-badge--mute">Ẩn</span> },
    { key: 'actions', label: 'Thao tác', width: '110px', render: item => <div className="ad-acts"><button className="hc-button hc-button--outline ad-icon" type="button" aria-label={`Quản lý ${item.name}`} onClick={() => open(item)}><Pencil size={18} aria-hidden="true" /></button><button className="hc-button hc-button--outline ad-icon ad-icon--danger" type="button" aria-label={`Xóa ${item.name}`} onClick={() => { setError(''); setDeleting(item); }}><Trash2 size={18} aria-hidden="true" /></button></div> },
  ];

  return <>
    {!selected && !deleting && <>{notice && <p className="hc-success" role="status">{notice}</p>}{error && <p className="hc-error" role="alert">{error}</p>}</>}
    {selected && <Modal wide title={selected === 'new' ? 'Thêm sản phẩm' : `Sửa ${selected.product_code} · ${selected.name}`} onClose={() => setSelected(null)}>{notice && <p className="hc-success" role="status">{notice}</p>}{error && !deleting && <p className="hc-error" role="alert">{error}</p>}<form className="hc-form" noValidate onSubmit={save}>
      <div className="hc-form-grid">{fields.map(field => <AdminField key={field.name} {...form.bind(field)} disabled={busy} />)}</div>
      {selected === 'new' && <p className="hc-muted">Tồn kho ban đầu của SKU luôn là 0. Nhập hàng bằng phiếu nhập tại <Link to="/warehouse/inventory?form=stock-in">Tồn kho</Link> để có lịch sử.</p>}
      <div className="hc-form-footer"><span className="hc-footer-left">{selected !== 'new' && <button className="hc-button hc-button--outline hc-danger" type="button" disabled={busy} onClick={() => { setError(''); setDeleting(selected); }}><Trash2 size={18} aria-hidden="true" />Xóa sản phẩm</button>}<AdminField {...form.bind({ name: 'is_active', label: 'Đang bán', type: 'checkbox' })} disabled={busy} /></span><span className="hc-actions"><button className="hc-button hc-button--outline" type="button" onClick={() => setSelected(null)}>Đóng</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sản phẩm'}</button></span></div></form>
      {selected !== 'new' && selected.id && <><VariantPanel product={selected} /><ImagePanel product={selected} onChanged={reload} /><SpecPanel product={selected} /></>}
    </Modal>}
    {deleting && <ConfirmDialog title="Xóa sản phẩm này?" description="Sản phẩm bị gỡ khỏi catalog và cửa hàng; dữ liệu đơn hàng cũ được giữ nguyên. Chỉ muốn tạm ngừng bán thì bỏ chọn Đang bán." summary={deleting.name} detail={deleting.product_code} badge={deleting.total_stock === undefined ? undefined : `Còn ${deleting.total_stock} trong kho`} confirmLabel="Xóa sản phẩm" busy={busy} error={error} onConfirm={removeProduct} onCancel={() => { setDeleting(null); setError(''); }} />}
    <div className="ad-filters" role="search">
      <SearchBox label="Tìm sản phẩm" placeholder="Tìm theo tên hoặc mã sản phẩm" value={filters.keyword} onChange={keyword => setFilters(current => ({ ...current, keyword }))} />
      <select className="ad-select" aria-label="Danh mục" value={filters.category_id} onChange={event => setFilters(current => ({ ...current, category_id: event.target.value }))}><option value="">Tất cả danh mục</option>{categoryOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    </div>
    <Chips label="Trạng thái bán" options={statusOptions} value={filters.is_active} onChange={is_active => setFilters(current => ({ ...current, is_active }))} />
    {!items ? !error && <p role="status" className="hc-muted">Đang tải sản phẩm…</p> : items.length === 0 ? <EmptyCard>Không có sản phẩm phù hợp.</EmptyCard>
      : <div><DataTable label="Danh sách sản phẩm" cols={columns} rows={items} rowKey={item => item.id} /><p className="ad-foot">Hiển thị {items.length} sản phẩm</p></div>}
  </>;
}
