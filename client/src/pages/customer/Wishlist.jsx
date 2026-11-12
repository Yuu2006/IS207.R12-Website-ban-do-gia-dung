import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getProduct } from '../../services/catalog-service.js';
import {
    getWishlist,
    removeWishlist,
    moveWishlistToCart
} from '../../services/wishlist-service.js';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import { money } from '../../services/order-ui-data.js';
import OrderApiState from '../../components/order/OrderApiState.jsx';
import { createApiClient } from '../../services/api-client.js';

const request = createApiClient();

export default function Wishlist() {
    const [selectedSkus, setSelectedSkus] = useState({});
    const [quantities, setQuantities] = useState({});
    const [variants, setVariants] = useState({});

    const action = useOrderAction();

    const wishlist = useOrderQuery(
        signal => getWishlist({ signal }),
        []
    );

    async function loadVariants(productId) {
        if (variants[productId]) return;

        try {
            const product = await getProduct(productId);

            setVariants(previous => ({
                ...previous,
                [productId]: product.variants || []
            }));
        } catch (error) {
            action.run;
            console.error(error);
        }
    }

    async function handleRemove(productId) {
        const result = await action.run(
            'wishlist-remove',
            { productId: String(productId) },
            options => removeWishlist(productId, options)
        );

        if (result) wishlist.reload();
    }

    async function handleMove(item) {
        const productId = String(item.product_id);
        const skuId = selectedSkus[productId];
        const quantity = quantities[productId] || 1;

        if (!skuId) {
            alert('Vui lòng chọn phiên bản sản phẩm.');
            return;
        }

        const result = await action.run(
            'wishlist-move',
            {
                productId,
                skuId: String(skuId),
                quantity
            },
            options => moveWishlistToCart(
                productId,
                skuId,
                quantity,
                options
            )
        );

        if (result) {
            alert('Đã chuyển sản phẩm vào giỏ hàng!');
        }
    }

    return (
        <main className="oc-main">
            <h1>Sản phẩm yêu thích</h1>

            <OrderApiState
                {...wishlist}
                retry={wishlist.reload}
            />

            {action.error && (
                <p role="alert" className="oc-error">
                    {action.error.message}
                    <button
                        type="button"
                        onClick={wishlist.reload}
                    >
                        Tải lại
                    </button>
                </p>
            )}

            <section className="oc-card oc-form-section">
                <h2>Danh sách yêu thích</h2>

                {wishlist.data?.length === 0 && (
                    <p>Bạn chưa có sản phẩm yêu thích.</p>
                )}

                {wishlist.data?.map(item => {
                    const productId = String(item.product_id);

                    return (
                        <div
                            className="oc-product"
                            key={item.wishlist_id}
                        >
                            <div className="oc-product-copy">
                                <strong>{item.name}</strong>

                                <p>{item.product_code}</p>

                                {item.image_url && (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        width="100"
                                    />
                                )}

                                <label className="oc-field">
                                    Phiên bản / SKU

                                    <select
                                        value={selectedSkus[productId] || ''}
                                        disabled={action.busy || action.uncertain}
                                        onFocus={() => loadVariants(productId)}
                                        onChange={event =>
                                            setSelectedSkus(previous => ({
                                                ...previous,
                                                [productId]: event.target.value
                                            }))
                                        }
                                    >
                                        <option value="">
                                            Chọn phiên bản
                                        </option>

                                        {variants[productId]?.filter(
                                            variant =>
                                                Number(variant.is_active) &&
                                                Number(variant.stock_quantity) > 0
                                        ).map(variant => (
                                            <option
                                                key={variant.id}
                                                value={variant.id}
                                            >
                                                {variant.variant_name} · {variant.sku}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="oc-field">
                                    Số lượng

                                    <input
                                        type="number"
                                        min="1"
                                        max="999"
                                        value={quantities[productId] || 1}
                                        disabled={action.busy || action.uncertain}
                                        onChange={event =>
                                            setQuantities(previous => ({
                                                ...previous,
                                                [productId]: Number(event.target.value)
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <div className="oc-product-actions">
                                <button
                                    type="button"
                                    className="oc-button"
                                    disabled={
                                        action.busy ||
                                        action.uncertain ||
                                        !selectedSkus[productId]
                                    }
                                    onClick={() => handleMove(item)}
                                >
                                    Thêm vào giỏ
                                </button>

                                <button
                                    type="button"
                                    className="oc-button oc-button--outline"
                                    disabled={action.busy || action.uncertain}
                                    onClick={() => handleRemove(productId)}
                                >
                                    Xóa yêu thích
                                </button>
                            </div>
                        </div>
                    );
                })}

                <Link className="oc-button" to="/cart">
                    Xem giỏ hàng
                </Link>
            </section>
        </main>
    );
}
