import { money, statusLabels } from '../../services/order-ui-data.js';

// Icon SVG dùng chung, không cần dependency icon mới.
export function Icon({ name = 'box', size = 20 }) {
  const paths = { box: 'M12 3 3 8l9 5 9-5-9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5', bag: 'M5 7h14l1 14H4L5 7ZM8 7V5a4 4 0 0 1 8 0v2', arrow: 'm9 5 7 7-7 7', check: 'm5 12 4 4L19 6', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8', pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0', clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', user: 'M20 21v-2a8 8 0 0 0-16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', card: 'M3 5h18v14H3V5ZM3 10h18M7 15h3', truck: 'M1 4h14v13H1V4ZM15 9h4l4 4v4h-8M8 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.box} /></svg>;
}
export function StatusBadge({ status }) { return <span className={`oc-badge oc-badge--${status}`}>{statusLabels[status]}</span>; }
// Hiển thị snapshot dòng hàng; ảnh lỗi có nhãn thay thế.
export function ProductLines({ items }) {
  return <div className="oc-products">{items.map(item => <div className="oc-product" key={item.sku}><div className="oc-product-image"><img src={item.image} alt={item.name} onError={e => { e.currentTarget.hidden = true; }} /><Icon name="box" size={28} /></div><div className="oc-product-copy"><strong>{item.name}</strong><span>{item.variant}</span><small>×{item.quantity} · Bảo hành {item.warranty} tháng</small></div><strong className="oc-price">{money(item.price * item.quantity)}</strong></div>)}</div>;
}
export function Totals({ subtotal, discount = 0, shipping = 0 }) { const shippingText = shipping === null ? 'Xác nhận khi đặt hàng' : shipping ? money(shipping) : 'Miễn phí'; const totalText = shipping === null ? 'Xác nhận khi đặt hàng' : money(subtotal + shipping - discount); return <div className="oc-totals"><div><span>Tạm tính</span><span>{money(subtotal)}</span></div><div><span>Phí vận chuyển</span><span>{shippingText}</span></div>{discount > 0 && <div className="oc-discount"><span>Giảm giá</span><span>−{money(discount)}</span></div>}<div className="oc-grand-total"><strong>Tổng thanh toán</strong><strong>{totalText}</strong></div></div>; }
