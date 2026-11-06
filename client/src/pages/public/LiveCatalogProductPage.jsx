import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Minus, Package, Plus, ShieldCheck, ShoppingCart, Truck, Zap } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../services/http-client.js';
import { getProduct, getProductAttributes } from '../../services/catalog-service.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import '../customer/care-pages.css';

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const imageSource = value => !value ? '' : /^https?:\/\//i.test(value) ? value : `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;

function productSpecifications(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function attributeValue(attribute) {
  if (attribute.data_type === 'boolean') {
    if (attribute.value_boolean === null || attribute.value_boolean === undefined) return 'Chưa cập nhật';
    return Number(attribute.value_boolean) === 1 ? 'Có' : 'Không';
  }
  const value = attribute.data_type === 'number' ? attribute.value_number : attribute.value_text;
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật';
  const formatted = attribute.data_type === 'number' && Number.isFinite(Number(value))
    ? new Intl.NumberFormat('vi-VN').format(Number(value)) : String(value);
  return `${formatted}${attribute.unit ? ` ${attribute.unit}` : ''}`;
}

// Customer product page reads real catalog/SKU data; cart writes are owned by the order service.
export default function LiveCatalogProductPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderService = useOrderService();
  const [product, setProduct] = useState(null);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setProduct(null);
    setQuantity(1);
    setActionMessage('');
    setActionError(false);
    Promise.all([getProduct(id), getProductAttributes(id).catch(() => [])])
      .then(([detail, specs]) => {
        if (!active) return;
        setProduct(detail);
        setAttributes(Array.isArray(specs) ? specs : []);
        setSelectedImage(0);
      })
      .catch(failure => { if (active) setError(failure.message || 'Không thể tải sản phẩm.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const variants = product?.variants || [];
  const selectedId = searchParams.get('variantId');
  const selected = variants.find(item => String(item.id) === selectedId) || variants[0];
  const images = product?.images || [];
  const activeImage = images[selectedImage] || images[0];
  const imageUrl = imageSource(activeImage?.image_url);
  useEffect(() => setImageFailed(false), [imageUrl]);
  const baseSpecifications = useMemo(() => productSpecifications(product?.specifications), [product?.specifications]);
  const availableQuantity = Math.min(5, Number(selected?.stock_quantity || 0));

  function selectVariant(variantId) {
    const next = new URLSearchParams(searchParams);
    next.set('variantId', variantId);
    setSearchParams(next, { replace: true });
    setQuantity(1);
    setActionMessage('');
  }

  async function submitCartAction(action) {
    if (!selected || availableQuantity < 1 || quantity > availableQuantity || busy) return;
    setBusy(true);
    setActionMessage('');
    try {
      await orderService.addCartItem(String(selected.id), quantity);
      if (action === 'buy') {
        navigate('/checkout');
        return;
      }
      setActionError(false);
      setActionMessage(`Đã thêm ${quantity} sản phẩm vào giỏ hàng.`);
    } catch (failure) {
      setActionError(true);
      setActionMessage(failure.message || 'Không thể thêm sản phẩm vào giỏ hàng.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="live-product"><div className="hc-card care-loading" role="status">Đang tải thông tin sản phẩm…</div></main>;
  if (error || !product) return <main className="live-product"><section className="hc-card live-product__error" role="alert"><h1>{error || 'Không tìm thấy sản phẩm'}</h1><p>Sản phẩm có thể đã ngừng bán hoặc không còn trong catalog.</p><Link className="care-button" to="/products">Xem sản phẩm</Link></section></main>;

  return <main className="live-product">
    <Link className="live-product__back" to="/products"><ArrowLeft size={15} aria-hidden="true" />Quay lại danh sách sản phẩm</Link>
    <div className="live-product__grid">
      <div className="live-product__gallery">
        <div className="live-product__image">{imageUrl && !imageFailed ? <img src={imageUrl} alt={product.name} onError={() => setImageFailed(true)} /> : <Package size={54} aria-label="Sản phẩm chưa có hình ảnh" />}</div>
        {images.length > 1 && <div className="live-product__thumbnails" aria-label="Hình ảnh sản phẩm">
          {images.map((image, index) => <button type="button" key={image.id || image.image_url} className={index === selectedImage ? 'is-selected' : ''} onClick={() => setSelectedImage(index)} aria-label={`Xem hình ${index + 1}`}>
            {image.image_url ? <img src={imageSource(image.image_url)} alt="" /> : <Package size={18} />}
          </button>)}
        </div>}
      </div>
      <section className="live-product__body">
        <span className="hc-eyebrow">{product.brand_name || 'HomeCare'} · {product.category_name || 'Thiết bị gia dụng'}</span>
        <h1>{product.name}</h1>
        {product.description && <p>{product.description}</p>}
        {variants.length ? <>
          <label className="live-product__variant" htmlFor="live-product-sku">Chọn SKU
            <select id="live-product-sku" value={selected?.id || ''} onChange={event => selectVariant(event.target.value)}>
              {variants.map(variant => <option key={variant.id} value={variant.id}>{variant.sku}{variant.variant_name ? ` · ${variant.variant_name}` : ''}</option>)}
            </select>
          </label>
          <div className="live-product__price">{money(selected?.effective_price)}</div>
          <span className={`live-product__stock${availableQuantity > 0 ? '' : ' live-product__stock--empty'}`}><Package size={15} aria-hidden="true" />{availableQuantity > 0 ? `Còn ${selected.stock_quantity} sản phẩm` : 'Tạm hết hàng'}</span>
          <div className="live-product__service"><p><ShieldCheck size={15} aria-hidden="true" /> Bảo hành: {Number(product.warranty_months) > 0 ? `${product.warranty_months} tháng` : 'chưa công bố'}.</p><p><Truck size={15} aria-hidden="true" /> Phí giao hàng được tính tại bước thanh toán.</p><p><Zap size={15} aria-hidden="true" /> Tồn kho sẽ được kiểm tra lại khi đặt hàng.</p></div>
          <div className="live-product__quantity" aria-label="Số lượng sản phẩm">
            <button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Giảm số lượng"><Minus size={15} /></button>
            <span aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => setQuantity(value => Math.min(availableQuantity, 5, value + 1))} disabled={quantity >= availableQuantity} aria-label="Tăng số lượng"><Plus size={15} /></button>
            <small>Tối đa {Math.min(availableQuantity, 5)} sản phẩm cho SKU này</small>
          </div>
          <div className="live-product__actions">
            <button type="button" className="live-product__add" onClick={() => submitCartAction('add')} disabled={busy || availableQuantity < 1}><ShoppingCart size={17} />{busy ? 'Đang thêm…' : 'Thêm vào giỏ'}</button>
            <button type="button" className="live-product__buy" onClick={() => submitCartAction('buy')} disabled={busy || availableQuantity < 1}>{busy ? 'Đang xử lý…' : 'Mua ngay'}</button>
          </div>
          {actionMessage && <div className={`live-product__action-message${actionError ? ' is-error' : ''}`} role={actionError ? 'alert' : 'status'}>
            <span>{actionMessage}</span>{!actionError && <Link to="/checkout">Tiến hành thanh toán</Link>}
          </div>}
        </> : <p role="status">Sản phẩm hiện chưa có SKU đang bán.</p>}
        <Link className="live-product__compare" to={`/compare?product=${encodeURIComponent(product.id)}`}><ArrowLeftRight size={16} aria-hidden="true" />So sánh với sản phẩm cùng loại</Link>
      </section>
    </div>
    {(attributes.length > 0 || Object.keys(baseSpecifications).length > 0) && <section className="live-product__specs hc-card">
      <h2>Thông số sản phẩm</h2>
      <dl>{attributes.map(attribute => <div key={attribute.attribute_id || attribute.attribute_key}><dt>{attribute.name || attribute.attribute_key}</dt><dd>{attributeValue(attribute)}</dd></div>)}
        {Object.entries(baseSpecifications).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}
      </dl>
    </section>}
  </main>;
}
