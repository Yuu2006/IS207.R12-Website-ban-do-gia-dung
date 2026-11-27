import { useEffect, useState } from 'react';
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
  const [pollCount, setPollCount] = useState(0);
  const result = useOrderQuery(signal => paymentByReference(reference, { signal }), [reference], { enabled: valid });

  useEffect(() => {
    setPollCount(0);
  }, [reference]);

  useEffect(() => {
    if (result.data?.status !== 'pending' || pollCount >= 6) return undefined;
    const timer = window.setTimeout(() => {
      setPollCount(value => value + 1);
      result.reload();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [result.data?.status, pollCount, result.reload]);

  return <main className="oc-main"><section className="oc-card oc-form-section" aria-live="polite"><h1>Kết quả thanh toán</h1><p>Trạng thái được lấy từ xác nhận máy chủ.</p><OrderApiState {...result} retry={result.reload} />{result.data ? <><h2>{paymentLabel(result.data.status)}</h2><p>{result.data.orderCode} · {money(result.data.amount)}</p>{result.data.status === 'pending' && <p>Đang chờ xác nhận từ cổng thanh toán. Trạng thái sẽ tự cập nhật từ máy chủ.</p>}{result.data.status === 'paid' && result.data.refundRequired && <p className="oc-error" role="status">Đơn hàng đã hết hạn hoặc bị hủy trước khi xác nhận thanh toán. Khoản thu cần được đối soát và hoàn theo quy trình hỗ trợ.</p>}{result.data.status === 'failed' && <p>Cổng thanh toán chưa xác nhận giao dịch. Bạn có thể mở đơn hàng để kiểm tra hoặc đặt lại.</p>}{result.data.simulatedRefund && <p role="status">Đã ghi nhận hoàn tiền mô phỏng {money(result.data.simulatedRefund.amount)}. Không có giao dịch hoàn tiền ngân hàng thực tế.</p>}<div className="oc-detail-actions"><Link className="oc-button" to={`/orders/${result.data.orderId}`}>Xem đơn hàng</Link>{result.data.status === 'pending' && pollCount >= 6 && <button type="button" className="oc-button oc-button--outline" onClick={() => { setPollCount(0); result.reload(); }}>Kiểm tra lại</button>}</div></> : !valid && <p className="oc-error">Thiếu mã tham chiếu thanh toán hợp lệ.</p>}</section></main>;
}
