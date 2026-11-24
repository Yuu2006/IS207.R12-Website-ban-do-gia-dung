import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Dialog } from '../../../components/ui/Dialog.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Switch } from '../../../components/ui/Switch.jsx';
import { createProduct } from '../../../services/product-service.js';
import { formatMoneyInput, parseMoneyInput } from '../../../utils/money-input.js';
import { slugify } from '../../../utils/slugify.js';
import css from './AddProductDialog.module.css';

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024; // theo ImagePanel/backend: JPEG, PNG, WebP, 5 MB, tối đa 10 ảnh
let counter = 0;
const nextKey = () => `k${++counter}`;
const blankVariant = () => ({ key: nextKey(), variant_name: '', sku: '', price: '', stock: '0' });
const vf = (variant, name) => `variant.${variant.key}.${name}`;

// Kiểm tra phía giao diện để hỗ trợ người nhập; backend vẫn kiểm tra lại (mã, slug, SKU trùng).
function validate(v) {
  const errors = {};
  if (!v.category_id) errors.category_id = 'Chọn danh mục.';
  if (!v.brand_id) errors.brand_id = 'Chọn thương hiệu.';
  if (!v.product_code.trim()) errors.product_code = 'Nhập mã sản phẩm.';
  if (!v.name.trim()) errors.name = 'Nhập tên sản phẩm.';
  if (!v.slug) errors.slug = 'Nhập slug.';
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug)) errors.slug = 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.';
  const seen = new Set();
  for (const variant of v.variants) {
    if (!variant.variant_name.trim()) errors[vf(variant, 'variant_name')] = 'Nhập tên biến thể.';
    const sku = variant.sku.trim().toLowerCase();
    if (!sku) errors[vf(variant, 'sku')] = 'Nhập SKU.';
    else if (seen.has(sku)) errors[vf(variant, 'sku')] = 'SKU bị trùng trong danh sách.';
    seen.add(sku);
    if (!/^\d+(\.\d{1,2})?$/.test(variant.price) || Number(variant.price) <= 0) errors[vf(variant, 'price')] = 'Giá bán phải lớn hơn 0.';
    if (!/^\d+$/.test(variant.stock)) errors[vf(variant, 'stock')] = 'Nhập số nguyên từ 0 trở lên.';
  }
  return errors;
}

// Dialog Thêm sản phẩm: danh mục, thương hiệu, mã, tên, slug, biến thể giá, ảnh, trạng thái.
export default function AddProductDialog({ categoryOptions, brandOptions, onClose, onCreated, onPartial }) {
  const [values, setValues] = useState(() => ({ category_id: '', brand_id: '', product_code: '', name: '', slug: '', is_active: true, variants: [blankVariant()] }));
  const [slugTouched, setSlugTouched] = useState(false);
  const [images, setImages] = useState([]); // { key, file, preview }
  const [primaryKey, setPrimaryKey] = useState('');
  const [imageError, setImageError] = useState('');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const previews = useRef([]);
  const errors = validate(values);
  const shown = name => (submitted || touched[name]) ? errors[name] || serverErrors[name] : serverErrors[name];
  const touch = name => setTouched(current => ({ ...current, [name]: true }));

  useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), []);

  function change(patch, field) {
    setValues(current => ({ ...current, ...patch }));
    setDirty(true);
    if (field) setServerErrors(current => ({ ...current, [field]: undefined }));
  }
  function changeName(name) {
    change({ name, ...(slugTouched ? {} : { slug: slugify(name) }) }, 'name');
  }
  function changeVariant(key, patch, field) {
    setValues(current => ({ ...current, variants: current.variants.map(variant => variant.key === key ? { ...variant, ...patch } : variant) }));
    setDirty(true);
    setServerErrors(current => ({ ...current, [`variant.${key}.${field}`]: undefined }));
  }
  const addVariant = () => { setValues(current => ({ ...current, variants: [...current.variants, blankVariant()] })); setDirty(true); };
  const removeVariant = key => { setValues(current => ({ ...current, variants: current.variants.filter(variant => variant.key !== key) })); setDirty(true); };

  function addFiles(list) {
    const files = [...list];
    if (!files.length) return;
    if (files.length > MAX_IMAGES - images.length) { setImageError(`Chỉ thêm được tối đa ${MAX_IMAGES - images.length} ảnh nữa. Giới hạn là ${MAX_IMAGES} ảnh.`); return; }
    const bad = files.find(file => !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_BYTES);
    if (bad) { setImageError(`"${bad.name}" không phải ảnh JPEG, PNG, WebP hoặc lớn hơn 5 MB. Chọn ảnh khác.`); return; }
    const added = files.map(file => { const preview = URL.createObjectURL(file); previews.current.push(preview); return { key: nextKey(), file, preview }; });
    setImageError(''); setDirty(true);
    setImages(current => [...current, ...added]);
    setPrimaryKey(current => current || added[0].key);
  }
  function removeImage(key) {
    const next = images.filter(image => image.key !== key);
    setImages(next); setDirty(true);
    if (primaryKey === key) setPrimaryKey(next[0]?.key || '');
  }
  function moveImage(index, delta) {
    setImages(current => { const next = [...current]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
    setDirty(true);
  }

  const requestClose = () => { if (busy) return; if (dirty) setConfirming(true); else onClose(); };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setSubmitted(true); setFormError('');
    if (Object.keys(errors).length) { requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setBusy(true);
    try {
      const saved = await createProduct({
        product: { category_id: Number(values.category_id), brand_id: Number(values.brand_id), product_code: values.product_code.trim(), name: values.name.trim(), slug: values.slug, description: '', warranty_months: 12, is_active: values.is_active ? 1 : 0 },
        variants: values.variants.map(variant => ({ sku: variant.sku.trim(), variant_name: variant.variant_name.trim(), price: variant.price, stock: variant.stock })),
        images: images.map(image => ({ file: image.file, primary: image.key === primaryKey })),
      });
      onCreated(saved);
    } catch (error) {
      if (error.partial) { onPartial(error); return; }
      const first = values.variants[0];
      const { sku, variant_name, price, ...rest } = error.errors || {};
      setServerErrors({ ...rest, [vf(first, 'sku')]: sku, [vf(first, 'variant_name')]: variant_name, [vf(first, 'price')]: price });
      setFormError(error.message || 'Không lưu được sản phẩm. Kiểm tra kết nối rồi thử lại.');
    } finally { setBusy(false); }
  }

  const footer = <>
    <Button variant="ghost" disabled={busy} onClick={requestClose}>Hủy</Button>
    <Button type="submit" form="add-product-form" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sản phẩm'}</Button>
  </>;

  return <>
    <Dialog title="Thêm sản phẩm" subtitle="Điền thông tin cơ bản, biến thể giá và ảnh. Bạn có thể bổ sung thông số sau khi lưu." className={css.dialog} onClose={requestClose} footer={footer}>
      <form id="add-product-form" ref={formRef} className={css.form} noValidate onSubmit={submit}>
        {formError && <p className={css.formError} role="alert">{formError}</p>}
        <div className={css.grid}>
          <Select label="Danh mục" placeholder="Chọn danh mục" value={values.category_id} options={categoryOptions.map(([value, label]) => ({ value, label }))} onChange={e => change({ category_id: e.target.value }, 'category_id')} onBlur={() => touch('category_id')} error={shown('category_id')} disabled={busy} required />
          <Select label="Thương hiệu" placeholder="Chọn thương hiệu" value={values.brand_id} options={brandOptions.map(([value, label]) => ({ value, label }))} onChange={e => change({ brand_id: e.target.value }, 'brand_id')} onBlur={() => touch('brand_id')} error={shown('brand_id')} disabled={busy} required />
          <Input label="Mã sản phẩm" value={values.product_code} maxLength={60} onChange={e => change({ product_code: e.target.value }, 'product_code')} onBlur={() => touch('product_code')} error={shown('product_code')} disabled={busy} required />
          <Input label="Tên sản phẩm" value={values.name} maxLength={255} onChange={e => changeName(e.target.value)} onBlur={() => touch('name')} error={shown('name')} disabled={busy} required />
          <Input className={css.wide} label="Slug" hint="Tự sinh từ tên, bạn có thể sửa. Không được trùng với sản phẩm khác." value={values.slug} maxLength={280} onChange={e => { setSlugTouched(true); change({ slug: e.target.value }, 'slug'); }} onBlur={() => touch('slug')} error={shown('slug')} disabled={busy} required />
        </div>

        <fieldset className={css.section} disabled={busy}>
          <legend>Biến thể giá</legend>
          <ul className={css.variants}>
            {values.variants.map((variant, index) => <li key={variant.key} className={css.variant}>
              <Input label="Tên biến thể" value={variant.variant_name} maxLength={150} onChange={e => changeVariant(variant.key, { variant_name: e.target.value }, 'variant_name')} onBlur={() => touch(vf(variant, 'variant_name'))} error={shown(vf(variant, 'variant_name'))} required />
              <Input label="SKU" value={variant.sku} maxLength={80} onChange={e => changeVariant(variant.key, { sku: e.target.value }, 'sku')} onBlur={() => touch(vf(variant, 'sku'))} error={shown(vf(variant, 'sku'))} required />
              <Input label="Giá bán" suffix="₫" inputMode="decimal" autoComplete="off" maxLength={18} value={formatMoneyInput(variant.price)} onChange={e => changeVariant(variant.key, { price: parseMoneyInput(e.target.value) }, 'price')} onBlur={() => touch(vf(variant, 'price'))} error={shown(vf(variant, 'price'))} required />
              <Input label="Tồn kho ban đầu" inputMode="numeric" autoComplete="off" value={variant.stock} onChange={e => changeVariant(variant.key, { stock: e.target.value.replace(/\D/g, '') }, 'stock')} onBlur={() => touch(vf(variant, 'stock'))} error={shown(vf(variant, 'stock'))} />
              <IconButton className={css.remove} icon="trash" label={`Xóa biến thể ${index + 1}`} variant="ghost" disabled={values.variants.length === 1} onClick={() => removeVariant(variant.key)} />
            </li>)}
          </ul>
          <div className={css.sectionFoot}>
            <Button variant="outline" size="sm" icon="plus" onClick={addVariant}>Thêm biến thể</Button>
            <span className={css.note}>Tồn kho lớn hơn 0 được ghi bằng phiếu nhập, có lưu người thực hiện và lý do.</span>
          </div>
        </fieldset>

        <fieldset className={css.section} disabled={busy}>
          <legend>Ảnh sản phẩm ({images.length}/{MAX_IMAGES})</legend>
          <label className={css.drop}>
            <Icon name="upload" size={24} />
            <span>Chọn ảnh từ máy</span>
            <small>JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh, tối đa {MAX_IMAGES} ảnh.</small>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={images.length >= MAX_IMAGES} aria-describedby={imageError ? 'add-product-image-error' : undefined} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          {imageError && <p id="add-product-image-error" className="ds-field__error" role="alert">{imageError}</p>}
          {images.length > 0 && <ul className={css.images}>
            {images.map((image, index) => <li key={image.key} className={css.image}>
              <img src={image.preview} alt={`Xem trước ảnh ${index + 1}: ${image.file.name}`} />
              <label className={css.primary}><input type="radio" name="primary-image" checked={image.key === primaryKey} onChange={() => { setPrimaryKey(image.key); setDirty(true); }} />Ảnh chính</label>
              <div className={css.imageActions}>
                <IconButton icon="arrow-up" size="sm" variant="outline" label={`Đưa ảnh ${index + 1} lên trước`} disabled={index === 0} onClick={() => moveImage(index, -1)} />
                <IconButton icon="arrow-down" size="sm" variant="outline" label={`Đưa ảnh ${index + 1} xuống sau`} disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} />
                <IconButton icon="trash" size="sm" variant="outline" label={`Xóa ảnh ${index + 1}`} onClick={() => removeImage(image.key)} />
              </div>
            </li>)}
          </ul>}
        </fieldset>

        <Switch label="Đang hoạt động" checked={values.is_active} onChange={e => change({ is_active: e.target.checked })} disabled={busy} />
      </form>
    </Dialog>
    {confirming && <Dialog role="alertdialog" className="ds-dialog--sm" title="Bỏ thay đổi chưa lưu?" onClose={() => setConfirming(false)}
      footer={<><Button variant="ghost" onClick={() => setConfirming(false)}>Tiếp tục nhập</Button><Button variant="danger" onClick={onClose}>Bỏ thay đổi</Button></>}>
      <p>Thông tin bạn vừa nhập sẽ mất nếu đóng hộp thoại này.</p>
    </Dialog>}
  </>;
}
