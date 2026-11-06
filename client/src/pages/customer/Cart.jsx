import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createApiClient } from '../../services/api-client.js';
import { listProducts, getProduct } from '../../services/catalog-service.js';
import { mapCart } from '../../services/order-service.js';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { money } from '../../services/order-ui-data.js';
import OrderApiState from '../../components/order/OrderApiState.jsx';

const request = createApiClient();

// Catalog IDs are resolved through the API so mock storefront IDs cannot create a different purchase.
export default function Cart() {
  const service = useOrderService();
  const [productId, setProductId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const action = useOrderAction();
  const cart = useOrderQuery(signal => service.getCart({ signal }), [service]);
  const products = useOrderQuery(() => listProducts({ is_active: 1 }), [], { enabled: service.mode === 'http' });
  const variants = useOrderQuery(async () => (await getProduct(productId)).variants, [productId], { enabled: Boolean(productId) && service.mode === 'http' });

  async function replace(items) {
    if (!cart.data || action.busy) return;
    const input = { expectedCartVersion: cart.data.cartVersion, items };
    const result = await action.run('replace-cart', input, options => request('/cart', { ...options, method: 'PUT', body: input }));
    if (result) cart.setData(mapCart(result));
  }

  const lines = cart.data?.items.map(item => ({ skuId: String(item.sku_id), quantity: item.quantity })) || [];
  function add(event) {
    event.preventDefault();
    if (!skuId || !Number.isSafeInteger(quantity) || quantity < 1) return;
    const existing = lines.find(item => item.skuId === skuId);
    replace(existing ? lines.map(item => item.skuId === skuId ? { ...item, quantity: item.quantity + quantity } : item) : [...lines, { skuId, quantity }]);
  }

  return <main className="oc-main"><h1>Giỏ hàng</h1><OrderApiState {...cart} retry={cart.reload} />{action.error && <p role="alert" className="oc-error">{action.error.message} <button type="button" onClick={cart.reload}>Tải lại giỏ</button></p>}
    {service.mode === 'http' && <section className="oc-card oc-form-section"><h2>Chọn sản phẩm</h2><OrderApiState {...products} retry={products.reload} /><label className="oc-field">Tìm sản phẩm<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc thương hiệu…" /></label><form onSubmit={add} className="oc-form-grid"><label className="oc-field">Sản phẩm<select value={productId} disabled={action.busy || action.uncertain} onChange={event => { setProductId(event.target.value); setSkuId(''); }}><option value="">Chọn sản phẩm</option>{products.data?.filter(item => item.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="oc-field">Phiên bản / SKU<select required value={skuId} disabled={action.busy || action.uncertain} onChange={event => setSkuId(event.target.value)}><option value="">Chọn phiên bản</option>{variants.data?.filter(item => Number(item.is_active) && Number(item.stock_quantity) > 0).map(item => <option key={item.id} value={item.id}>{item.variant_name} · {item.sku}</option>)}</select></label><label className="oc-field">Số lượng<input type="number" required min="1" max="999" value={quantity} disabled={action.busy || action.uncertain} onChange={event => setQuantity(Number(event.target.value))} /></label><button type="submit" className="oc-button" disabled={action.busy || !skuId}>Thêm vào giỏ</button></form><OrderApiState {...variants} retry={variants.reload} /></section>}
    <section className="oc-card oc-form-section"><h2>Sản phẩm đã chọn</h2>{cart.data?.items.length === 0 && <p>Giỏ hàng đang trống.</p>}{cart.data?.items.map(item => <div className="oc-product" key={item.sku_id}><div className="oc-product-copy"><strong>{item.name}</strong><p>{item.variant} · {item.sku} · {item.quantity} sản phẩm</p><p>{money(item.price)} / sản phẩm</p></div>{service.mode === 'http' && <button type="button" className="oc-button oc-button--outline" disabled={action.busy || action.uncertain} onClick={() => replace(lines.filter(line => line.skuId !== String(item.sku_id)))}>Xóa</button>}</div>)}<Link className="oc-button" to="/checkout">Tiếp tục thanh toán</Link></section>
  </main>;
}
