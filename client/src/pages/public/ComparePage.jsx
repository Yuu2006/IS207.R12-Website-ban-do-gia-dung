import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, Package, RotateCcw, X } from 'lucide-react';
import { getProduct, getProductAttributes, listProducts } from '../../services/catalog-service.js';
import { API_URL } from '../../services/http-client.js';
import {
  comparableCandidates,
  comparisonSpecs,
  findRequestedProduct,
  productImage,
  productPrice,
  productionYear,
  sameCategory,
} from '../../utils/product-comparison.js';
import './compare-page.css';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const valueOrDash = value => value === null || value === undefined || value === '' ? '—' : String(value);

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
      {product && <button type="button" onClick={onClear} aria-label={`Bỏ sản phẩm ${number}`} title="Bỏ chọn"><X size={17} /></button>}
    </div>
    <ProductVisual product={product} />
    <strong>{product?.name || 'Chưa chọn sản phẩm'}</strong>
    {product && <small>{product.brand_name} · {product.category_name}</small>}
  </div>;
}

// Trang so sánh dùng cùng API catalog cho cả hai cột và bỏ phản hồi cũ khi đổi lựa chọn nhanh.
export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [details, setDetails] = useState([null, null]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsRetry, setDetailsRetry] = useState(0);

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

  const first = findRequestedProduct(catalog, searchParams.get('product'), searchParams.get('name') || '');
  const secondCandidate = findRequestedProduct(catalog, searchParams.get('with'));
  const second = first && secondCandidate && String(first.id) !== String(secondCandidate.id)
    && sameCategory(first, secondCandidate) ? secondCandidate : null;
  const candidates = useMemo(() => comparableCandidates(catalog, first), [catalog, first]);
  const requestedId = searchParams.get('product');
  const hasInvalidRequest = !catalogLoading && !catalogError && requestedId && !first;
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
    if (!first && !second) { setDetails([null, null]); setDetailsError(''); setDetailsLoading(false); return; }
    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError('');
    setDetails([null, null]);
    Promise.all([first, second].map(async product => {
      if (!product) return null;
      const [detail, attributes] = await Promise.all([
        getProduct(product.id),
        getProductAttributes(product.id),
      ]);
      return { ...product, ...detail, attributes: Array.isArray(attributes) ? attributes : [] };
    }))
      .then(result => { if (!cancelled) setDetails(result); })
      .catch(error => { if (!cancelled) setDetailsError(error.message || 'Không thể tải thông số sản phẩm.'); })
      .finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [first?.id, second?.id, detailsRetry]);

  function selectFirst(id) {
    setSearchParams(id ? { product: id } : {});
  }

  function selectSecond(id) {
    if (!first) return;
    const params = new URLSearchParams(searchParams);
    if (id) params.set('with', id);
    else params.delete('with');
    setSearchParams(params);
  }

  const firstDetail = first && String(details[0]?.id) === String(first.id) ? details[0] : null;
  const secondDetail = second && String(details[1]?.id) === String(second.id) ? details[1] : null;
  const firstFull = firstDetail || first;
  const secondFull = secondDetail || second;
  const specRows = !detailsLoading && !detailsError ? comparisonSpecs(firstDetail, secondDetail) : [];

  return <main className="compare-page">
    <div className="compare-container">
      <nav className="compare-breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link><ChevronRight size={14} /><span>So sánh</span>
      </nav>
      <div className="compare-title">
        <div><span className="compare-eyebrow">CHỌN SẢN PHẨM PHÙ HỢP</span><h1>So sánh sản phẩm</h1><p>Đặt hai sản phẩm cùng loại cạnh nhau để xem giá và thông số.</p></div>
        <ArrowLeftRight size={29} strokeWidth={1.7} aria-hidden="true" />
      </div>

      {catalogLoading && <div className="compare-status" role="status">Đang tải danh sách sản phẩm…</div>}
      {catalogError && <div className="compare-status compare-error" role="alert"><p>{catalogError}</p><button type="button" onClick={() => setCatalogRetry(value => value + 1)}><RotateCcw size={15} /> Thử lại</button></div>}
      {!catalogLoading && !catalogError && <>
        {hasInvalidRequest && <div className="compare-notice" role="status"><span>Sản phẩm từ trang trước chưa có trong danh mục API hoặc đã ngừng bán. {matchingCategories.length ? `Hãy chọn sản phẩm thuộc loại ${matchingCategories[0].name} để tiếp tục.` : 'Vui lòng chọn một sản phẩm bên dưới.'}</span>{matchingCategories.length > 0 && <button type="button" onClick={() => setSearchParams({})}>Xem mọi danh mục</button>}</div>}
        {catalog.length === 0 ? <div className="compare-status">Hiện chưa có sản phẩm đang bán để so sánh.</div> : <>
          <div className="compare-pickers">
            <div className="compare-picker"><label htmlFor="compare-first">Sản phẩm đầu tiên</label><select id="compare-first" value={first?.id ?? ''} onChange={event => selectFirst(event.target.value)}>
              <option value="">Chọn sản phẩm</option>
              {selectableCategories.map(group => <optgroup key={group.id} label={group.name}>{group.products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
            </select></div>
            <span className="compare-picker-symbol" aria-hidden="true"><ArrowLeftRight size={20} /></span>
            <div className="compare-picker"><label htmlFor="compare-second">Sản phẩm so sánh</label><select id="compare-second" value={second?.id ?? ''} disabled={!first || candidates.length === 0} onChange={event => selectSecond(event.target.value)}>
              <option value="">{!first ? 'Chọn sản phẩm đầu tiên' : candidates.length ? 'Chọn sản phẩm cùng loại' : 'Chưa có sản phẩm cùng loại'}</option>
              {candidates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></div>
          </div>
          <p className="compare-filter-note" role="status">{first ? candidates.length ? `Có ${candidates.length} sản phẩm khác thuộc loại ${first.category_name}.` : `Chưa có sản phẩm khác thuộc loại ${first.category_name}.` : 'Chọn sản phẩm đầu tiên để lọc các sản phẩm cùng loại.'}</p>

          {detailsError && <div className="compare-status compare-error" role="alert"><p>{detailsError}</p><button type="button" onClick={() => setDetailsRetry(value => value + 1)}><RotateCcw size={15} /> Tải lại thông số</button></div>}
          <div className="compare-table-scroll" role="region" aria-label="Bảng so sánh sản phẩm" tabIndex="0">
            <table className="compare-table">
              <thead><tr><th scope="col">SẢN PHẨM</th><th scope="col"><ProductHeading product={firstFull} number={1} onClear={() => selectFirst('')} /></th><th scope="col"><ProductHeading product={secondFull} number={2} onClear={() => selectSecond('')} /></th></tr></thead>
              <tbody>
                <tr><th scope="row">Tên sản phẩm</th><td>{valueOrDash(firstFull?.name)}</td><td>{valueOrDash(secondFull?.name)}</td></tr>
                <tr><th scope="row">Giá từ</th><td className="compare-price">{productPrice(firstFull) === null ? '—' : money.format(productPrice(firstFull))}</td><td className="compare-price">{productPrice(secondFull) === null ? '—' : money.format(productPrice(secondFull))}</td></tr>
                <tr><th scope="row">Năm sản xuất</th><td>{valueOrDash(productionYear(firstFull))}</td><td>{valueOrDash(productionYear(secondFull))}</td></tr>
                <tr><th scope="row">Hãng sản xuất</th><td>{valueOrDash(firstFull?.brand_name)}</td><td>{valueOrDash(secondFull?.brand_name)}</td></tr>
                {specRows.length > 0 && <tr className="compare-section-row"><th colSpan={3} scope="colgroup">Thông số theo loại sản phẩm</th></tr>}
                {specRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{valueOrDash(row.values[0])}</td><td>{valueOrDash(row.values[1])}</td></tr>)}
                {detailsLoading && <tr><th scope="row">Thông số</th><td colSpan={2}>Đang tải thông số…</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="compare-footnote">Giá hiển thị là mức thấp nhất trong các phiên bản đang bán. Dấu “—” nghĩa là dữ liệu chưa được cập nhật.</p>
        </>}
      </>}
    </div>
  </main>;
}
