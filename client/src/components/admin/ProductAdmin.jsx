import { useEffect, useState } from 'react';
import { formatPrice } from '../../data.js';
import { createCategoryAttribute, getProductAttributes, listProducts, listVariants, products, saveProductAttributes, saveVariant, setProductImage } from '../../services/catalog-service.js';
import { AdminField } from './SimpleCrud.jsx';

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
  const form = useForm({});
  const reload = () => listVariants(product.id).then(setItems).catch(err => setError(err.message));
  useEffect(() => { setItems(null); reload(); }, [product.id]);

  function edit(item) {
    setEditing(item?.id ?? 'new'); setError('');
    form.setErrors({});
    form.setValues(item ? { sku: item.sku, variant_name: item.variant_name, price: String(Number(item.price)), sale_price: item.sale_price ? String(Number(item.sale_price)) : '', sale_starts_at: toLocal(item.sale_starts_at), sale_ends_at: toLocal(item.sale_ends_at), low_stock_threshold: String(item.low_stock_threshold), is_active: Boolean(Number(item.is_active)) }
      : { sku: '', variant_name: '', price: '', sale_price: '', sale_starts_at: '', sale_ends_at: '', low_stock_threshold: '5', is_active: true });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const v = form.values;
    const errors = { sku: v.sku.trim() ? '' : 'SKU bắt buộc.', variant_name: v.variant_name.trim() ? '' : 'Tên biến thể bắt buộc.', price: /^\d+(\.\d{1,2})?$/.test(v.price) ? '' : 'Giá không hợp lệ.', sale_price: !v.sale_price || Number(v.sale_price) < Number(v.price) ? '' : 'Giá khuyến mãi phải thấp hơn giá bán.', low_stock_threshold: /^\d+$/.test(v.low_stock_threshold) ? '' : 'Ngưỡng là số nguyên ≥ 0.' };
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

  const fields = [
    { name: 'sku', label: 'Mã SKU', required: true, maxLength: 80 }, { name: 'variant_name', label: 'Tên biến thể', required: true, maxLength: 150 },
    { name: 'price', label: 'Giá bán (₫)', required: true, inputMode: 'decimal' }, { name: 'sale_price', label: 'Giá khuyến mãi (₫)', inputMode: 'decimal' },
    { name: 'sale_starts_at', label: 'Khuyến mãi từ', type: 'datetime-local' }, { name: 'sale_ends_at', label: 'Khuyến mãi đến', type: 'datetime-local' },
    { name: 'low_stock_threshold', label: 'Ngưỡng cảnh báo sắp hết', inputMode: 'numeric' }, { name: 'is_active', label: 'Đang bán', type: 'checkbox' },
  ].map(field => ({ ...field, id: `variant-${field.name}` })); // Không trùng id với form sản phẩm đang mở cùng lúc.
  return <section className="hc-subform hc-form"><div className="hc-heading-actions"><h3>SKU và giá</h3><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={() => edit(null)}>Thêm SKU</button></div>
    {error && <p className="hc-error" role="alert">{error}</p>}
    {editing !== null && <form className="hc-form" noValidate onSubmit={save}><div className="hc-form-grid">{fields.map(field => <AdminField key={field.name} {...form.bind(field)} disabled={busy || (field.name === 'sku' && editing !== 'new')} />)}</div>
      <p className="hc-muted">Tồn kho của SKU mới bằng 0; nhập hàng tại màn hình Tồn kho để có lịch sử.</p>
      <div className="hc-form-footer"><button className="hc-button hc-button--outline" type="button" onClick={() => setEditing(null)}>Hủy</button><button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu SKU'}</button></div></form>}
    {!items ? !error && <p role="status" className="hc-muted">Đang tải SKU…</p> : <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Biến thể</th><th scope="col">Giá</th><th scope="col">Khuyến mãi</th><th scope="col">Tồn</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td>{item.sku}</td><td>{item.variant_name}</td><td>{formatPrice(Number(item.price))}</td><td>{item.sale_price ? `${formatPrice(Number(item.sale_price))}${item.sale_ends_at ? ` đến ${item.sale_ends_at.slice(0, 16)}` : ''}` : '—'}</td><td>{item.stock_quantity}</td><td>{Number(item.is_active) ? 'Đang bán' : 'Ngừng bán'}</td><td><button className="hc-text-button" type="button" onClick={() => edit(item)}>Sửa</button></td></tr>)}</tbody></table></div>}
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

// PRD-03/04: tạo/sửa/ngừng bán sản phẩm, ảnh đại diện; sản phẩm đã có đơn chỉ vô hiệu hóa (xóa mềm).
export default function ProductAdmin({ categoryOptions, brandOptions }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ keyword: '', category_id: '' });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const form = useForm({});
  const [version, setVersion] = useState(0);
  const reload = () => setVersion(current => current + 1);
  // Debounce tìm kiếm và bỏ phản hồi cũ khi bộ lọc đổi trước khi request trước trả về.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => listProducts(filters).then(data => { if (active) { setItems(data); setError(''); } }).catch(err => { if (active) setError(err.message); }), 300);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, version]);

  function open(item) {
    setSelected(item ?? 'new'); setNotice(''); setError(''); form.setErrors({});
    form.setValues(item ? { category_id: String(item.category_id), brand_id: String(item.brand_id), product_code: item.product_code, name: item.name, slug: item.slug, description: item.description || '', warranty_months: String(item.warranty_months), is_active: Boolean(Number(item.is_active)), image: item.primary_image || '' }
      : { category_id: '', brand_id: '', product_code: '', name: '', slug: '', description: '', warranty_months: '12', is_active: true, sku: '', variant_name: 'Tiêu chuẩn', price: '' });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const v = form.values;
    const required = ['category_id', 'brand_id', 'product_code', 'name', ...(selected === 'new' ? ['sku', 'variant_name', 'price'] : [])];
    const errors = Object.fromEntries(required.filter(name => !String(v[name] ?? '').trim()).map(name => [name, 'Bắt buộc.']));
    if (!/^\d{1,3}$/.test(v.warranty_months)) errors.warranty_months = 'Số tháng bảo hành không hợp lệ.';
    form.setErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true); setError('');
    try {
      const body = { category_id: Number(v.category_id), brand_id: Number(v.brand_id), product_code: v.product_code.trim(), name: v.name.trim(), slug: v.slug.trim() || slugify(`${v.name}-${v.product_code}`), description: v.description, warranty_months: Number(v.warranty_months), is_active: v.is_active ? 1 : 0 };
      const saved = await products.save(selected === 'new' ? null : selected.id, selected === 'new' ? { ...body, sku: v.sku.trim(), variant_name: v.variant_name.trim(), price: v.price } : body);
      if (selected !== 'new' && v.image && v.image !== selected.primary_image) await setProductImage(selected.id, v.image);
      setNotice('Đã lưu sản phẩm.');
      reload();
      setSelected(current => current === 'new' ? { ...saved, category_name: categoryOptions.find(([id]) => id === String(saved.category_id))?.[1] } : { ...current, ...body, primary_image: v.image || current.primary_image });
    } catch (err) { setError(err.message); form.setErrors(err.errors || {}); }
    finally { setBusy(false); }
  }

  async function deactivate(item) {
    if (busy || !window.confirm(`Ngừng bán và ẩn "${item.name}"? Dữ liệu đơn hàng cũ được giữ nguyên.`)) return;
    setBusy(true);
    try { await products.remove(item.id); setSelected(null); setNotice('Đã ngừng bán sản phẩm.'); reload(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const fields = [
    { name: 'category_id', label: 'Danh mục', type: 'select', options: categoryOptions, required: true }, { name: 'brand_id', label: 'Thương hiệu', type: 'select', options: brandOptions, required: true },
    { name: 'product_code', label: 'Mã sản phẩm', required: true, maxLength: 60 }, { name: 'name', label: 'Tên sản phẩm', required: true, maxLength: 255 },
    { name: 'slug', label: 'Slug (để trống sẽ tự tạo)', maxLength: 280 }, { name: 'warranty_months', label: 'Bảo hành (tháng)', inputMode: 'numeric' },
    { name: 'description', label: 'Mô tả', type: 'textarea', maxLength: 5000 }, { name: 'is_active', label: 'Đang bán', type: 'checkbox' },
    ...(selected === 'new' ? [{ name: 'sku', label: 'SKU đầu tiên', required: true, maxLength: 80 }, { name: 'variant_name', label: 'Tên biến thể', required: true }, { name: 'price', label: 'Giá bán (₫)', required: true, inputMode: 'decimal' }]
      : [{ name: 'image', label: 'Ảnh đại diện (JPEG/PNG/WebP ≤ 5 MB)', type: 'image', uploadType: 'products' }]),
  ];

  return <section className="hc-card hc-form">
    <div className="hc-heading-actions"><h2>Sản phẩm</h2><button className="hc-button" type="button" disabled={busy} onClick={() => open(null)}>Thêm sản phẩm</button></div>
    {notice && <p className="hc-success" role="status">{notice}</p>}{error && <p className="hc-error" role="alert">{error}</p>}
    {selected && <div className="hc-subform hc-form"><form className="hc-form" noValidate onSubmit={save}><h3>{selected === 'new' ? 'Thêm sản phẩm' : `Sửa ${selected.product_code}`}</h3>
      <div className="hc-form-grid">{fields.map(field => <AdminField key={field.name} {...form.bind(field)} disabled={busy} />)}</div>
      <div className="hc-form-footer">{selected !== 'new' ? <button className="hc-button hc-button--danger" type="button" disabled={busy} onClick={() => deactivate(selected)}>Ngừng bán</button> : <span />}<span><button className="hc-button hc-button--outline" type="button" onClick={() => setSelected(null)}>Đóng</button> <button className="hc-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sản phẩm'}</button></span></div></form>
      {selected !== 'new' && selected.id && <><VariantPanel product={selected} /><SpecPanel product={selected} /></>}
    </div>}
    <div className="hc-inline-form" role="search">
      <AdminField field={{ name: 'keyword', label: 'Tìm theo tên hoặc mã' }} value={filters.keyword} onChange={keyword => setFilters(current => ({ ...current, keyword }))} />
      <AdminField field={{ name: 'filter-category', label: 'Danh mục', type: 'select', options: categoryOptions, placeholder: 'Tất cả' }} value={filters.category_id} onChange={category_id => setFilters(current => ({ ...current, category_id }))} />
    </div>
    {!items ? !error && <p role="status" className="hc-muted">Đang tải sản phẩm…</p> : items.length === 0 ? <p className="hc-muted">Không có sản phẩm phù hợp.</p>
      : <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">Ảnh</th><th scope="col">Mã</th><th scope="col">Tên</th><th scope="col">Danh mục</th><th scope="col">Giá từ</th><th scope="col">Tồn</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}><td>{item.primary_image ? <img className="hc-thumb" src={item.primary_image} alt="" /> : '—'}</td><td>{item.product_code}</td><td>{item.name}</td><td>{item.category_name}</td><td>{formatPrice(Number(item.min_price))}</td><td>{item.total_stock}</td><td>{Number(item.is_active) ? 'Đang bán' : 'Ẩn'}</td><td><button className="hc-text-button" type="button" onClick={() => open(item)}>Quản lý</button></td></tr>)}</tbody></table></div>}
  </section>;
}
