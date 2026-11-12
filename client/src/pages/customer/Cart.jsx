
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, getProduct } from '../../services/catalog-service.js';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { money } from '../../services/order-ui-data.js';
import OrderApiState from '../../components/order/OrderApiState.jsx';

// Catalog IDs are resolved through the API so mock storefront IDs cannot create a different purchase.
export default function Cart() {
  const service = useOrderService();

  const [productId, setProductId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');

  const action = useOrderAction();

  const cart = useOrderQuery(
    signal => service.getCart({ signal }),
    [service]
  );

  const products = useOrderQuery(
    () => listProducts({ is_active: 1 }),
    [],
    { enabled: service.mode === 'http' }
  );

  const variants = useOrderQuery(
    async () => (await getProduct(productId)).variants,
    [productId],
    { enabled: Boolean(productId) && service.mode === 'http' }
  );

  // Each action goes through the cart item API (POST/PATCH/DELETE /cart/items) with the current cart version;
  // the server rechecks SKU state and stock and rejects a stale version with 409.
  async function mutate(name, input, call) {
    if (!cart.data || action.busy) return;
    const result = await action.run(name, input, call);
    if (result) cart.setData(result);
  }

  // Thêm sản phẩm vào giỏ hàng (trùng SKU thì server cộng dồn số lượng)
  function add(event) {
    event.preventDefault();
    if (!skuId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return;
    mutate('addCartItem', { variantId: skuId, quantity }, options => service.addCartItem(skuId, quantity, options));
  }

  // Cập nhật số lượng sản phẩm
  function updateQuantity(item, newQuantity) {
    if (!Number.isSafeInteger(newQuantity) || newQuantity < 1 || newQuantity > 999 || newQuantity === item.quantity) return;
    const input = { variantId: String(item.sku_id), quantity: newQuantity, expectedCartVersion: cart.data.cartVersion };
    mutate('updateCartItem', input, options => service.updateCartItem(input.variantId, input.quantity, input.expectedCartVersion, options));
  }

  // Xóa sản phẩm khỏi giỏ hàng
  function removeItem(item) {
    const input = { variantId: String(item.sku_id), expectedCartVersion: cart.data.cartVersion };
    mutate('removeCartItem', input, options => service.removeCartItem(input.variantId, input.expectedCartVersion, options));
  }

  return (
    <main className="oc-main">
      <h1>Giỏ hàng</h1>

      <OrderApiState {...cart} retry={cart.reload} />

      {action.error && (
        <p role="alert" className="oc-error">
          {action.error.message}
          <button type="button" onClick={cart.reload}>
            Tải lại giỏ
          </button>
        </p>
      )}

      {/* Chọn sản phẩm */}
      {service.mode === 'http' && (
        <section className="oc-card oc-form-section">
          <h2>Chọn sản phẩm</h2>

          <OrderApiState {...products} retry={products.reload} />

          <label className="oc-field">
            Tìm sản phẩm
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Tên hoặc thương hiệu…"
            />
          </label>

          <form onSubmit={add} className="oc-form-grid">
            <label className="oc-field">
              Sản phẩm
              <select
                value={productId}
                disabled={action.busy || action.uncertain}
                onChange={event => {
                  setProductId(event.target.value);
                  setSkuId('');
                }}
              >
                <option value="">Chọn sản phẩm</option>

                {products.data
                  ?.filter(item =>
                    item.name
                      .toLocaleLowerCase('vi')
                      .includes(search.toLocaleLowerCase('vi'))
                  )
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="oc-field">
              Phiên bản / SKU
              <select
                required
                value={skuId}
                disabled={action.busy || action.uncertain}
                onChange={event => setSkuId(event.target.value)}
              >
                <option value="">Chọn phiên bản</option>

                {variants.data
                  ?.filter(
                    item =>
                      Number(item.is_active) &&
                      Number(item.stock_quantity) > 0
                  )
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.variant_name} · {item.sku}
                    </option>
                  ))}
              </select>
            </label>

            <label className="oc-field">
              Số lượng
              <input
                type="number"
                required
                min="1"
                max="999"
                value={quantity}
                disabled={action.busy || action.uncertain}
                onChange={event =>
                  setQuantity(Number(event.target.value))
                }
              />
            </label>

            <button
              type="submit"
              className="oc-button"
              disabled={action.busy || action.uncertain || !skuId}
            >
              Thêm vào giỏ
            </button>
          </form>

          <OrderApiState {...variants} retry={variants.reload} />
        </section>
      )}

      {/* Danh sách sản phẩm trong giỏ */}
      <section className="oc-card oc-form-section">
        <h2>Sản phẩm đã chọn</h2>

        {cart.data?.items.length === 0 && (
          <p>Giỏ hàng đang trống.</p>
        )}

        {cart.data?.items.map(item => (
          <div className="oc-product" key={item.sku_id}>
            <div className="oc-product-copy">
              <strong>{item.name}</strong>

              <p>
                {item.variant} · {item.sku}
              </p>

              <p>{money(item.price)} / sản phẩm</p>

              <label className="oc-field">
                Số lượng
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={item.quantity}
                  disabled={action.busy || action.uncertain}
                  onChange={event =>
                    updateQuantity(item, Number(event.target.value))
                  }
                />
              </label>
            </div>

            {service.mode === 'http' && (
              <button
                type="button"
                className="oc-button oc-button--outline"
                disabled={action.busy || action.uncertain}
                onClick={() => removeItem(item)}
              >
                Xóa
              </button>
            )}
          </div>
        ))}

        {/* Tổng kết đơn hàng lấy từ API */}
        {cart.data?.totals && (
          <div className="oc-card oc-form-section">
            <h2>Tổng kết đơn hàng</h2>

            <p>
              Tạm tính: {money(cart.data.totals.subtotal)}
            </p>

            <p>
              Giảm giá: -{money(cart.data.totals.discount)}
            </p>

            <p>
              Phí vận chuyển: {money(cart.data.totals.shipping)}
            </p>

            <hr />

            <h3>
              Tổng thanh toán: {money(cart.data.totals.total)}
            </h3>
          </div>
        )}

        <Link className="oc-button" to="/checkout">
          Tiếp tục thanh toán
        </Link>
      </section>
    </main>
  );
}
