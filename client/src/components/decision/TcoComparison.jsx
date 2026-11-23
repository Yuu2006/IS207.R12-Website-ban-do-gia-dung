import { useEffect, useRef, useState } from 'react';
import { getProduct, listProducts } from '../../services/catalog-service.js';
import { calculateTco } from '../../services/decision-tools-service.js';
import '../../pages/customer/decision-tools.css';

function emptyTcoSlot(key) {
  return { key, productId: '', variantId: '', variants: [], loadingVariants: false, variantError: '', consumablesVndPerYear: '', maintenanceVndPerYear: '' };
}

function formatVnd(value) {
  if (value === null || value === undefined) return 'Chưa đủ dữ liệu';
  const [integer, fraction] = String(value).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped}${fraction ? `,${fraction}` : ''} ₫`;
}

function createRequestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(16)) || Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function TcoResults({ result }) {
  const rows = [
    ['purchase', 'Giá mua'],
    ['electricity', 'Điện'],
    ['water', 'Nước'],
    ['consumables', 'Vật tư'],
    ['maintenance', 'Bảo trì'],
    ['total', `Tổng sau ${result.years} năm`],
  ];

  return <section className="hc-card dt-tco-results" aria-live="polite">
    <h2>Kết quả so sánh</h2>
    <p className="hc-muted">Danh mục: {result.categoryName}. Đây là ước tính theo giá và giả định ở thời điểm tính, không phải số tiền thanh toán.</p>
    <div className="hc-table-wrap">
      <table className="hc-table">
        <thead><tr><th scope="col">Khoản chi phí</th>{result.products.map(item => <th scope="col" key={item.productId}>{item.productName}<small className="dt-tco-sku">{item.sku} · {item.variantName}</small></th>)}</tr></thead>
        <tbody>{rows.map(([key, label]) => <tr key={key} className={key === 'total' ? 'dt-tco-total-row' : ''}><th scope="row">{label}</th>{result.products.map(item => <td key={item.productId}>{formatVnd(item[key])}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="dt-tco-result-notes">{result.products.map(item => <article className="dt-tco-result-note" key={item.productId}>
      <h3>{item.productName}</h3>
      <details><summary>Công thức và giả định</summary><ul>{Object.entries(item.formula).map(([key, formula]) => <li key={key}><strong>{key === 'total' ? 'Tổng' : key === 'purchase' ? 'Giá mua' : key === 'electricity' ? 'Điện' : key === 'water' ? 'Nước' : key === 'consumables' ? 'Vật tư' : 'Bảo trì'}:</strong> {formula}</li>)}{item.assumptions.map((assumption, index) => <li key={`assumption-${index}`}>{assumption}</li>)}</ul></details>
      {item.missingInputs.length > 0 && <div className="dt-tco-missing" role="status"><strong>Cần bổ sung để có tổng:</strong><ul>{item.missingInputs.map(message => <li key={message}>{message}</li>)}</ul></div>}
    </article>)}</div>
  </section>;
}

export default function TcoComparison({ initialProductIds = [] }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [slots, setSlots] = useState(() => Array.from({ length: Math.max(2, Math.min(4, initialProductIds.length)) }, (_, index) => ({ ...emptyTcoSlot(index + 1), productId: String(initialProductIds[index] || '') })));
  const [values, setValues] = useState({ years: '3', usesPerWeek: '5', hoursPerUse: '1', electricityVndPerKwh: '', waterVndPerM3: '' });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const requestKeyRef = useRef(null);
  const pendingCalculation = useRef(null);
  const nextKeyRef = useRef(Math.max(2, initialProductIds.length) + 1);

  useEffect(() => {
    let active = true;
    setCatalogState('loading');
    listProducts({ is_active: 1 }).then(items => {
      if (!active) return;
      setCatalog(Array.isArray(items) ? items : []);
      setCatalogState('ready');
      setCatalogError('');
      initialProductIds.forEach(async id => {
        setSlots(current => current.map(slot => slot.productId === String(id) ? { ...slot, loadingVariants: true, variantError: '' } : slot));
        try {
          const detail = await getProduct(id);
          if (active) setSlots(current => current.map(slot => slot.productId === String(id) ? { ...slot, variants: detail.variants || [], loadingVariants: false } : slot));
        } catch (error) {
          if (active) setSlots(current => current.map(slot => slot.productId === String(id) ? { ...slot, variantError: error.message, loadingVariants: false } : slot));
        }
      });
    }).catch(error => {
      if (!active) return;
      setCatalogError(error.message || 'Không thể tải danh sách sản phẩm.');
      setCatalogState('error');
    });
    return () => { active = false; };
  }, [catalogRevision]);

  const setSlot = (key, patch) => setSlots(current => current.map(slot => slot.key === key ? { ...slot, ...patch } : slot));
  useEffect(() => () => pendingCalculation.current?.abort(), []);
  const clearCalculation = () => { pendingCalculation.current?.abort(); pendingCalculation.current = null; setSubmitting(false); setResult(null); setSubmitError(''); requestKeyRef.current = null; };

  const handleProductChange = async (key, value) => {
    const product = catalog.find(item => String(item.id) === value);
    clearCalculation();
    setSlots(current => current.map(slot => {
      if (slot.key === key) return { ...emptyTcoSlot(key), productId: value, loadingVariants: Boolean(product) };
      const otherProduct = catalog.find(item => String(item.id) === slot.productId);
      if (product && otherProduct && String(product.category_id) !== String(otherProduct.category_id)) return emptyTcoSlot(slot.key);
      return slot;
    }));
    if (!product) return;

    try {
      const detail = await getProduct(product.id);
      setSlots(current => current.map(slot => slot.key === key && slot.productId === value
        ? { ...slot, variants: Array.isArray(detail.variants) ? detail.variants : [], loadingVariants: false, variantError: '' }
        : slot));
    } catch (error) {
      setSlots(current => current.map(slot => slot.key === key && slot.productId === value
        ? { ...slot, loadingVariants: false, variantError: error.message || 'Không thể tải SKU của sản phẩm.' }
        : slot));
    }
  };

  const retryVariants = async slot => {
    setSlot(slot.key, { loadingVariants: true, variantError: '' });
    try {
      const detail = await getProduct(slot.productId);
      setSlots(current => current.map(item => item.key === slot.key && item.productId === slot.productId ? { ...item, variants: Array.isArray(detail.variants) ? detail.variants : [], loadingVariants: false } : item));
    } catch (error) {
      setSlots(current => current.map(item => item.key === slot.key && item.productId === slot.productId ? { ...item, loadingVariants: false, variantError: error.message || 'Không thể tải SKU của sản phẩm.' } : item));
    }
  };

  const updateValue = (key, value) => { clearCalculation(); setValues(current => ({ ...current, [key]: value })); };
  const updateSlotCost = (key, field, value) => { clearCalculation(); setSlot(key, { [field]: value }); };

  const selectedCategory = slots.map(slot => catalog.find(item => String(item.id) === slot.productId)?.category_id).find(Boolean);
  const chosenProducts = slots.map(slot => catalog.find(item => String(item.id) === slot.productId)).filter(Boolean);
  const selectedIds = new Set(chosenProducts.map(item => String(item.id)));
  const readyToCalculate = catalogState === 'ready' && slots.every(slot => slot.productId && slot.variantId && !slot.loadingVariants) && !submitting;

  const submit = async event => {
    event.preventDefault();
    if (!readyToCalculate || pendingCalculation.current) return;

    const payload = {
      productIds: slots.map(slot => Number(slot.productId)),
      variantIds: slots.map(slot => Number(slot.variantId)),
      years: Number(values.years),
      usesPerWeek: Number(values.usesPerWeek),
      hoursPerUse: values.hoursPerUse === '' ? null : values.hoursPerUse,
      electricityVndPerKwh: values.electricityVndPerKwh,
      waterVndPerM3: values.waterVndPerM3,
      annualCosts: slots.map(slot => ({
        productId: Number(slot.productId),
        consumablesVndPerYear: slot.consumablesVndPerYear === '' ? null : slot.consumablesVndPerYear,
        maintenanceVndPerYear: slot.maintenanceVndPerYear === '' ? null : slot.maintenanceVndPerYear,
      })),
    };
    const signature = JSON.stringify(payload);
    if (!requestKeyRef.current || requestKeyRef.current.signature !== signature) {
      requestKeyRef.current = { signature, value: createRequestKey() };
    }

    setSubmitting(true);
    setSubmitError('');
    const controller = new AbortController();
    pendingCalculation.current = controller;
    try {
      const calculated = await calculateTco({ ...payload, requestKey: requestKeyRef.current.value }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setResult(calculated);
      requestKeyRef.current = null;
    } catch (error) {
      if (!controller.signal.aborted) setSubmitError(error.message || 'Không thể tính TCO. Vui lòng thử lại.');
    } finally {
      if (pendingCalculation.current === controller) { pendingCalculation.current = null; setSubmitting(false); }
    }
  };

  // Retry the whole initial load so selected compare products also receive their SKU options.
  const retryCatalog = () => setCatalogRevision(current => current + 1);

  return <div className="dt-stack">
    <form className="hc-card dt-tco-form" onSubmit={submit}>
      <h2>Kịch bản chi phí sở hữu</h2>
      <p className="hc-muted">So sánh 2–4 sản phẩm cùng danh mục. Giá SKU và thông số lấy từ catalog; các khoản vật tư, bảo trì là giả định do bạn nhập.</p>
      {catalogState === 'loading' && <p role="status" className="hc-muted">Đang tải catalog…</p>}
      {catalogState === 'error' && <div className="dt-tco-error" role="alert"><span>{catalogError}</span><button className="hc-button hc-button--outline" type="button" onClick={retryCatalog}>Thử tải lại</button></div>}
      {catalogState === 'ready' && catalog.length === 0 && <p className="dt-placeholder">Chưa có sản phẩm đang bán để tính chi phí.</p>}

      {catalogState === 'ready' && catalog.length > 0 && <>
        <div className="dt-tco-product-list">
          {slots.map((slot, index) => {
            const product = catalog.find(item => String(item.id) === slot.productId);
            const options = catalog.filter(item => (!selectedCategory || String(item.category_id) === String(selectedCategory)) && (!selectedIds.has(String(item.id)) || String(item.id) === slot.productId));
            return <fieldset className="dt-tco-product" key={slot.key}>
              <legend>Sản phẩm {index + 1}{slots.length > 2 && <button className="dt-tco-remove" type="button" onClick={() => { clearCalculation(); setSlots(current => current.filter(item => item.key !== slot.key)); }}>Bỏ</button>}</legend>
              <div className="hc-form-grid">
                <div className="hc-field"><label htmlFor={`tco-product-${slot.key}`}>Sản phẩm</label><select id={`tco-product-${slot.key}`} value={slot.productId} required onChange={event => handleProductChange(slot.key, event.target.value)}><option value="">Chọn sản phẩm</option>{options.map(item => <option value={item.id} key={item.id}>{item.name} · {item.category_name}</option>)}</select></div>
                <div className="hc-field"><label htmlFor={`tco-variant-${slot.key}`}>SKU / phiên bản</label><select id={`tco-variant-${slot.key}`} value={slot.variantId} required disabled={!slot.productId || slot.loadingVariants || slot.variants.length === 0} onChange={event => { clearCalculation(); setSlot(slot.key, { variantId: event.target.value }); }}><option value="">{slot.loadingVariants ? 'Đang tải SKU…' : 'Chọn SKU'}</option>{slot.variants.map(variant => <option value={variant.id} key={variant.id}>{variant.sku} · {variant.variant_name}</option>)}</select>{slot.variantError && <span className="dt-tco-inline-error" role="alert">{slot.variantError} <button type="button" onClick={() => retryVariants(slot)}>Thử lại</button></span>}{product && !slot.loadingVariants && !slot.variantError && slot.variants.length === 0 && <span className="dt-tco-inline-error">Sản phẩm chưa có SKU đang bán.</span>}</div>
                <div className="hc-field"><label htmlFor={`tco-consumables-${slot.key}`}>Vật tư ước tính (₫/năm)</label><input id={`tco-consumables-${slot.key}`} type="number" min="0" step="0.01" value={slot.consumablesVndPerYear} onChange={event => updateSlotCost(slot.key, 'consumablesVndPerYear', event.target.value)} placeholder="Để trống nếu chưa biết" /><small>Nhập 0 nếu xác nhận không phát sinh.</small></div>
                <div className="hc-field"><label htmlFor={`tco-maintenance-${slot.key}`}>Bảo trì ước tính (₫/năm)</label><input id={`tco-maintenance-${slot.key}`} type="number" min="0" step="0.01" value={slot.maintenanceVndPerYear} onChange={event => updateSlotCost(slot.key, 'maintenanceVndPerYear', event.target.value)} placeholder="Để trống nếu chưa biết" /><small>Nhập 0 nếu xác nhận không phát sinh.</small></div>
              </div>
            </fieldset>;
          })}
        </div>
        {slots.length < 4 && <button className="hc-button hc-button--outline dt-tco-add" type="button" onClick={() => { clearCalculation(); setSlots(current => [...current, emptyTcoSlot(nextKeyRef.current++)]); }}>Thêm sản phẩm</button>}

        <div className="hc-form-grid dt-tco-scenario">
          <div className="hc-field"><label htmlFor="tco-years">Thời gian sở hữu</label><select id="tco-years" required value={values.years} onChange={event => updateValue('years', event.target.value)}><option value="1">1 năm</option><option value="3">3 năm</option><option value="5">5 năm</option></select></div>
          <div className="hc-field"><label htmlFor="tco-frequency">Số lần sử dụng mỗi tuần</label><input id="tco-frequency" type="number" min="0" max="168" step="1" required value={values.usesPerWeek} onChange={event => updateValue('usesPerWeek', event.target.value)} /></div>
          <div className="hc-field"><label htmlFor="tco-hours">Giờ sử dụng mỗi lần</label><input id="tco-hours" type="number" min="0" max="24" step="0.01" value={values.hoursPerUse} onChange={event => updateValue('hoursPerUse', event.target.value)} placeholder="Cần cho sản phẩm tính theo công suất W" /></div>
          <div className="hc-field"><label htmlFor="tco-electricity">Giá điện (₫/kWh)</label><input id="tco-electricity" type="number" min="0" max="100000" step="0.01" required value={values.electricityVndPerKwh} onChange={event => updateValue('electricityVndPerKwh', event.target.value)} placeholder="Nhập đơn giá điện" /></div>
          <div className="hc-field"><label htmlFor="tco-water">Giá nước (₫/m³)</label><input id="tco-water" type="number" min="0" max="100000" step="0.01" required value={values.waterVndPerM3} onChange={event => updateValue('waterVndPerM3', event.target.value)} placeholder="Nhập đơn giá nước" /></div>
        </div>
        <p className="dt-note">TCO = giá mua + điện + nước + vật tư + bảo trì. Điện theo năm dùng kWh/năm từ catalog; công suất W/kW và nước L/m³ được chuẩn hóa trước khi tính. Sản phẩm cùng danh mục được chọn chung một kịch bản sử dụng. Trường chưa biết để trống sẽ làm tổng hiển thị “Chưa đủ dữ liệu”.</p>
        {submitError && <div className="dt-tco-error" role="alert">{submitError}</div>}
        <button className="hc-button" type="submit" disabled={!readyToCalculate}>{submitting ? 'Đang tính…' : 'Tính chi phí sở hữu'}</button>
      </>}
    </form>
    {result ? <TcoResults result={result} /> : <section className="hc-card"><h2>Kết quả so sánh</h2><p className="dt-placeholder">Chọn sản phẩm và giả định chi phí để xem bảng so sánh TCO.</p></section>}
  </div>;
}
