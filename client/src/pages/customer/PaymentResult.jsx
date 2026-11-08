import { Link, useSearchParams } from 'react-router-dom';
import { useOrderQuery } from '../../hooks/use-order-api.js';
import { paymentByReference } from '../../services/payment-service.js';
import { money, paymentLabel } from '../../services/order-ui-data.js';
import OrderApiState from '../../components/order/OrderApiState.jsx';

// Return query is only a lookup reference; only server IPN can confirm payment.
export default function PaymentResult() {
  const [params] = useSearchParams();
  const reference = params.get('vnp_TxnRef') || '';
  const valid = /^[A-Za-z0-9-]{1,80}$/.test(reference);
  const result = useOrderQuery(signal => paymentByReference(reference, { signal }), [reference], { enabled: valid });
  return <main className="oc-main"><section className="oc-card oc-form-section"><h1>Kết quả thanh toán</h1><p>Trạng thái được lấy từ xác nhận máy chủ.</p><OrderApiState {...result} retry={result.reload} />{result.data ? <><h2>{paymentLabel(result.data.status)}</h2><p>{result.data.orderCode} · {money(result.data.amount)}</p>{result.data.status === 'pending' && <p>Đang chờ xác nhận từ cổng thanh toán. Bạn có thể kiểm tra lại sau.</p>}<Link className="oc-button" to={`/orders/${result.data.orderId}`}>Xem đơn hàng</Link></> : !valid && <p className="oc-error">Thiếu mã tham chiếu thanh toán hợp lệ.</p>}</section></main>;
}
