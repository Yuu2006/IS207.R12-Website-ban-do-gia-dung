import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, Package, Plus, RotateCcw, X } from 'lucide-react';
import { getProduct, getProductAttributes, listProducts } from '../../services/catalog-service.js';
import { API_URL } from '../../services/http-client.js';
import {
  comparableCandidates,
  comparisonSpecs,
  estimateTco,
  findRequestedProduct,
  productImage,
  productPrice,
  productionYear,
  selectedComparisonProducts,
} from '../../utils/product-comparison.js';
import './compare-page.css';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const paramKeys = ['product', 'with', 'with2', 'with3'];
const costRows = [
  ['purchase', 'Giá mua'],
  ['electricity', 'Tiền điện'],
  ['water', 'Tiền nước'],
  ['consumables', 'Vật tư'],
  ['maintenance', 'Bảo trì'],
];
const costLabels = Object.fromEntries(costRows);
const valueOrDash = value => value === null || value === undefined || value === '' ? '—' : String(value);
const formatMoney = value => value === null || value === undefined ? '—' : money.format(value);

function paramsForSelection(ids, slots) {
  const params = new URLSearchParams();
  ids.forEach((id, index) => { if (id) params.set(paramKeys[index], String(id)); });
  if (slots > 2) params.set('slots', String(slots));
  return params;
}

function ProductVisual({ product }) {
  const image = productImage(product);
  const source = image.startsWith('/') ? `${API_URL}${image}` : image;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return <span className="compare-visual" aria-hidden="true">
    {source && !failed ? <img src={source} alt="" onError={() => setFailed(true)} /> : <Package size={30} strokeWidth={1.5} />}
  </span>;
}

function ProductHeading({ product, number, onClear }) {
  return <div className="compare-product-heading">
    <div className="compare-product-top">
      <span>SẢN PHẨM 0{number}</span>
      {(product || number > 2) && <button type="button" onClick={onClear} aria-label={`Bỏ sản phẩm ${number}`} title="Bỏ cột"><X size={17} /></button>}
    </div>
    <ProductVisual product={product} />
    <strong>{product?.name || 'Chưa chọn sản phẩm'}</strong>
    {product && <small>{product.brand_name} · {product.category_name}</small>}
  </div>;
}

function ReviewValue({ detail, loading }) {
  if (!detail) return loading ? 'Đang tải…' : '—';
  if (!detail.review_summary) return '—';
  const count = Number(detail.review_summary?.review_count || 0);
  if (!count) return 'Chưa có đánh giá';
  const average = Number(detail.review_summary.rating_average);
  return Number.isFinite(average) ? `${average.toLocaleString('vi-VN')} / 5 · ${count} đánh giá` : '—';
}

// Trang so sánh dùng dữ liệu API; URL lưu 2–4 lựa chọn và bỏ qua phản hồi cũ khi đổi nhanh.
export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [details, setDetails] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsRetry, setDetailsRetry] = useState(0);
  const [assumptions, setAssumptions] = useState({
    years: '1', electricityRate: '', waterRate: '', usesPerWeek: '',
    hoursPerUse: '', consumablesPerYear: '', maintenancePerYear: '',
  });

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError('');
    listProducts({ is_active: 1 })
      .then(result => {
        if (!Array.isArray(result)) throw new Error('Danh sách sản phẩm không đúng định dạng.');
        if (!cancelled) setCatalog(result.filter(item => Number(item.is_active) === 1 && item.category_id));
      })
      .catch(error => { if (!cancelled) setCatalogError(error.message || 'Không thể tải sản phẩm.'); })
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, [catalogRetry]);

  const slots = Math.min(4, Math.max(2, Math.floor(Number(searchParams.get('slots'))) || 2,
    paramKeys.findLastIndex(key => searchParams.has(key)) + 1));
  const requestedIds = paramKeys.slice(0, slots).map(key => searchParams.get(key));
  const requestedProducts = selectedComparisonProducts(catalog, requestedIds);
  const first = findRequestedProduct(catalog, requestedIds[0], searchParams.get('name') || '');
  const selected = first ? [first, ...requestedProducts.slice(1)] : Array(slots).fill(null);
  const selectedIdsKey = selected.map(product => product?.id || '').join(',');
  const candidates = comparableCandidates(catalog, first);
  const hasInvalidRequest = !catalogLoading && !catalogError && requestedIds[0] && !first;

  const categories = useMemo(() => {
    const groups = new Map();
    for (const item of catalog) {
      const key = String(item.category_id);
      if (!groups.has(key)) groups.set(key, { id: key, name: item.category_name || 'Danh mục khác', products: [] });
      groups.get(key).products.push(item);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [catalog]);
  const categoryHint = searchParams.get('category') === 'Điều hòa' ? 'Máy lạnh' : searchParams.get('category');
  const matchingCategories = categories.filter(group => group.name === categoryHint);
  const selectableCategories = hasInvalidRequest && matchingCategories.length ? matchingCategories : categories;

  useEffect(() => {
    const products = selected.filter(Boolean);
    if (!products.length) { setDetails({}); setDetailsError(''); setDetailsLoading(false); return; }
    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError('');
    setDetails({});
    Promise.all(products.map(async product => {
      const [detail, attributes] = await Promise.all([getProduct(product.id), getProductAttributes(product.id)]);
      return [String(product.id), { ...product, ...detail, attributes: Array.isArray(attributes) ? attributes : [] }];
    }))
      .then(result => { if (!cancelled) setDetails(Object.fromEntries(result)); })
      .catch(error => { if (!cancelled) setDetailsError(error.message || 'Không thể tải thông số sản phẩm.'); })
      .finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedIdsKey, detailsRetry]);

  function selectProduct(index, id) {
    if (index === 0) {
      setSearchParams(paramsForSelection([id], slots));
      return;
    }
    const ids = selected.map(product => product?.id || '');
    ids[index] = id;
    setSearchParams(paramsForSelection(ids, slots));
  }

  function removeProduct(index) {
    if (index === 0) { setSearchParams({}); return; }
    const ids = selected.map(product => product?.id || '');
    if (slots === 2) ids[1] = '';
    else ids.splice(index, 1);
    setSearchParams(paramsForSelection(ids, Math.max(2, slots - 1)));
  }

  const fullProducts = selected.map(product => product && (details[String(product.id)] || product));
  const detailProducts = selected.map(product => product && details[String(product.id)] || null);
  const specRows = !detailsLoading && !detailsError ? comparisonSpecs(detailProducts) : [];
  const tcoResults = detailProducts.map(product => estimateTco(product, assumptions));
  const tcoReady = selected.filter(Boolean).length >= 2;

  return <main className="compare-page">
    <div className="compare-container">
      <nav className="compare-breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link><ChevronRight size={14} /><span>So sánh</span>
      </nav>
      <div className="compare-title">
        <div><span className="compare-eyebrow">CHỌN SẢN PHẨM PHÙ HỢP</span><h1>So sánh sản phẩm</h1><p>Đặt 2–4 sản phẩm cùng loại cạnh nhau để xem giá, thông số và chi phí sở hữu.</p></div>
        <ArrowLeftRight size={29} strokeWidth={1.7} aria-hidden="true" />
      </div>

      {catalogLoading && <div className="compare-status" role="status">Đang tải danh sách sản phẩm…</div>}
      {catalogError && <div className="compare-status compare-error" role="alert"><p>{catalogError}</p><button type="button" onClick={() => setCatalogRetry(value => value + 1)}><RotateCcw size={15} /> Thử lại</button></div>}
      {!catalogLoading && !catalogError && <>
        {hasInvalidRequest && <div className="compare-notice" role="status"><span>Sản phẩm từ trang trước chưa có trong danh mục API hoặc đã ngừng bán. {matchingCategories.length ? `Hãy chọn sản phẩm thuộc loại ${matchingCategories[0].name} để tiếp tục.` : 'Vui lòng chọn một sản phẩm bên dưới.'}</span>{matchingCategories.length > 0 && <button type="button" onClick={() => setSearchParams({})}>Xem mọi danh mục</button>}</div>}
        {catalog.length === 0 ? <div className="compare-status">Hiện chưa có sản phẩm đang bán để so sánh.</div> : <>
          <div className="compare-picker-panel">
            <div className="compare-pickers">
              {selected.map((product, index) => {
                const options = index === 0 ? [] : candidates.filter(item => !selected.some((chosen, position) => position !== index && String(chosen?.id) === String(item.id)));
                return <div className="compare-picker" key={index}>
                  <label htmlFor={`compare-product-${index}`}>Sản phẩm {index + 1}</label>
                  <select id={`compare-product-${index}`} value={product?.id ?? ''} disabled={index > 0 && (!first || (options.length === 0 && !product))} onChange={event => selectProduct(index, event.target.value)}>
                    <option value="">{index === 0 ? 'Chọn sản phẩm' : !first ? 'Chọn sản phẩm đầu tiên' : 'Chọn sản phẩm cùng loại'}</option>
                    {index === 0 ? selectableCategories.map(group => <optgroup key={group.id} label={group.name}>{group.products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)
                      : options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>;
              })}
            </div>
            <div className="compare-picker-actions">
              <span>{selected.filter(Boolean).length} / 4 sản phẩm đã chọn</span>
              {slots < 4 && <button type="button" onClick={() => setSearchParams(paramsForSelection(selected.map(product => product?.id || ''), slots + 1))} disabled={!first || selected.filter(Boolean).length >= 4}><Plus size={16} /> Thêm sản phẩm</button>}
            </div>
          </div>
          <p className="compare-filter-note" role="status">{first ? candidates.length ? `Có ${candidates.length} sản phẩm khác thuộc loại ${first.category_name}.` : `Chưa có sản phẩm khác thuộc loại ${first.category_name}.` : 'Chọn sản phẩm đầu tiên để lọc các sản phẩm cùng loại.'}</p>

          <section className="compare-tco-controls" aria-labelledby="compare-tco-title">
            <div><h2 id="compare-tco-title">Giả định TCO</h2><p>Ước tính trên giao diện từ giá và thông số catalog. Nhập 0 nếu xác nhận không phát sinh vật tư hoặc bảo trì.</p></div>
            <div className="compare-tco-inputs">
              <label>Thời gian <select value={assumptions.years} onChange={event => setAssumptions(current => ({ ...current, years: event.target.value }))}><option value="1">1 năm</option><option value="3">3 năm</option><option value="5">5 năm</option></select></label>
              {[
                ['electricityRate', 'Giá điện (₫/kWh)'],
                ['waterRate', 'Giá nước (₫/m³)'],
                ['usesPerWeek', 'Số lần dùng/tuần'],
                ['hoursPerUse', 'Số giờ/lần dùng'],
                ['consumablesPerYear', 'Vật tư/năm/sản phẩm (₫)'],
                ['maintenancePerYear', 'Bảo trì/năm/sản phẩm (₫)'],
              ].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="any" inputMode="decimal" value={assumptions[key]} onChange={event => setAssumptions(current => ({ ...current, [key]: event.target.value }))} placeholder="Chưa có" /></label>)}
            </div>
            <p>Với tủ lạnh, điện dùng kWh/năm. Với máy giặt hoặc máy lạnh, điện ước tính từ công suất × giờ/lần × lần/tuần × 52 tuần; nước máy giặt từ lít/chu trình. Tủ lạnh và máy lạnh không dùng nước vận hành.</p>
          </section>

          {detailsError && <div className="compare-status compare-error" role="alert"><p>{detailsError}</p><button type="button" onClick={() => setDetailsRetry(value => value + 1)}><RotateCcw size={15} /> Tải lại thông số</button></div>}
          <div className="compare-table-scroll" role="region" aria-label="Bảng so sánh sản phẩm" tabIndex="0">
            <table className="compare-table" style={{ '--compare-columns': slots }}>
              <thead><tr><th scope="col">SẢN PHẨM</th>{fullProducts.map((product, index) => <th scope="col" key={index}><ProductHeading product={product} number={index + 1} onClear={() => removeProduct(index)} /></th>)}</tr></thead>
              <tbody>
                <tr><th scope="row">Tên sản phẩm</th>{fullProducts.map((product, index) => <td key={index}>{valueOrDash(product?.name)}</td>)}</tr>
                <tr><th scope="row">Giá từ</th>{fullProducts.map((product, index) => <td className="compare-price" key={index}>{formatMoney(productPrice(product))}</td>)}</tr>
                <tr><th scope="row">Năm sản xuất</th>{fullProducts.map((product, index) => <td key={index}>{valueOrDash(productionYear(product))}</td>)}</tr>
                <tr><th scope="row">Hãng sản xuất</th>{fullProducts.map((product, index) => <td key={index}>{valueOrDash(product?.brand_name)}</td>)}</tr>
                <tr><th scope="row">Bảo hành</th>{fullProducts.map((product, index) => <td key={index}>{product && product.warranty_months !== null && product.warranty_months !== undefined ? `${product.warranty_months} tháng` : '—'}</td>)}</tr>
                <tr><th scope="row">Đánh giá</th>{detailProducts.map((product, index) => <td key={index}>{selected[index] ? <ReviewValue detail={product} loading={detailsLoading} /> : '—'}</td>)}</tr>
                {specRows.length > 0 && <tr className="compare-section-row"><th colSpan={slots + 1} scope="colgroup">Thông số theo loại sản phẩm</th></tr>}
                {specRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={index}>{valueOrDash(value)}</td>)}</tr>)}
                {detailsLoading && <tr><th scope="row">Thông số</th><td colSpan={slots}>Đang tải thông số…</td></tr>}
                <tr className="compare-section-row"><th colSpan={slots + 1} scope="colgroup">Chi phí sở hữu TCO · {assumptions.years} năm · ước tính</th></tr>
                {costRows.map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{tcoResults.map((result, index) => <td key={index}>{formatMoney(result?.[key])}</td>)}</tr>)}
                <tr className="compare-tco-total"><th scope="row">Tổng TCO</th>{tcoResults.map((result, index) => <td key={index}>{result?.total === null || !result ? <>{selected[index] ? 'Chưa đủ dữ liệu' : '—'}{result?.missing.length > 0 && <small>Thiếu: {result.missing.map(key => costLabels[key]).join(', ')}</small>}</> : formatMoney(result.total)}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="compare-footnote">{!tcoReady && 'Chọn ít nhất 2 sản phẩm để so sánh. '}Giá là mức thấp nhất trong các phiên bản đang bán. TCO là ước tính theo giả định đã nhập, không phải tiền thanh toán; chưa có API TCO chính thức. Dấu “—” nghĩa là chưa có dữ liệu.</p>
        </>}
      </>}
    </div>
  </main>;
}
