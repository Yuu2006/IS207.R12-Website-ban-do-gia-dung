import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../../components/order/OrderParts.jsx';
import OrderApiState from '../../components/order/OrderApiState.jsx';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { useOrderQuery } from '../../hooks/use-order-api.js';

// Resolve the browser return against the signed-in customer's server record; query parameters never settle payment.
export default function VnpayReturnPage() {
  const location = useLocation();
  const service = useOrderService();
  const paymentCode = new URLSearchParams(location.search).get('vnp_TxnRef') || '';
  const [pollCount, setPollCount] = useState(0);
  const resource = useOrderQuery(signal => service.getVnpayAttempt(paymentCode, { signal }), [service, paymentCode], { enabled: Boolean(paymentCode) });

  useEffect(() => {
    if (resource.data?.paymentStatus !== 'pending' || pollCount >= 6) return undefined;
    const timer = window.setTimeout(() => {
      setPollCount(value => value + 1);
      resource.reload();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [resource.data?.paymentStatus, pollCount, resource.reload]);

  let title = 'Đang xác minh thanh toán';
  let message = 'HomeCare đang chờ xác nhận trực tiếp từ VNPay. Trạng thái này sẽ cập nhật theo dữ liệu máy chủ.';
  if (resource.data?.paymentStatus === 'paid' && resource.data.refundRequired) {
    title = 'Đã ghi nhận thanh toán';
    message = 'Đơn hàng đã hết hạn hoặc bị hủy trước khi xác nhận thanh toán. Khoản thanh toán cần được đối soát và hoàn theo quy trình hỗ trợ.';
  } else if (resource.data?.paymentStatus === 'paid') {
    title = 'Thanh toán thành công';
    message = 'Máy chủ đã xác nhận thanh toán và cập nhật đơn hàng của bạn.';
  } else if (resource.data?.paymentStatus === 'failed') {
    title = 'Thanh toán chưa hoàn tất';
    message = resource.data.orderStatus === 'cancelled'
      ? 'Đơn hàng đã hết thời gian giữ tồn và được hủy. Bạn có thể đặt lại sản phẩm.'
      : 'VNPay chưa xác nhận khoản thanh toán. Bạn có thể xem đơn hàng để hủy và đặt lại.';
  }

  return <main className="oc-main"><div className="oc-card oc-empty oc-payment-result" aria-live="polite">
    {!paymentCode ? <><Icon name="box" size={40} /><h1>Thiếu mã giao dịch</h1><p>Không tìm thấy mã tham chiếu thanh toán trong đường dẫn trả về.</p></> : resource.loading || resource.error ? <OrderApiState {...resource} retry={resource.reload} /> : resource.data ? <>
      <span className={`oc-payment-result-icon ${resource.data.paymentStatus === 'paid' && !resource.data.refundRequired ? 'is-success' : resource.data.paymentStatus === 'failed' ? 'is-error' : ''}`}><Icon name={resource.data.paymentStatus === 'paid' && !resource.data.refundRequired ? 'check' : 'clock'} size={28} /></span>
      <h1>{title}</h1><p>{message}</p><small className="oc-muted">Đơn hàng #{resource.data.orderCode} · Trạng thái thanh toán được lấy từ máy chủ.</small>
      {resource.data.orderId && <Link className="oc-button" to={`/orders/${resource.data.orderId}`}>Xem đơn hàng</Link>}
      {resource.data.paymentStatus === 'pending' && pollCount >= 6 && <button className="oc-button oc-button--outline" type="button" onClick={() => { setPollCount(0); resource.reload(); }}>Kiểm tra lại</button>}
    </> : <><Icon name="box" size={40} /><h1>Chưa có kết quả thanh toán</h1><p>Hãy mở lại liên kết trả về từ VNPay hoặc xem đơn hàng của bạn.</p></>}
    <Link className="oc-text-action" to="/orders">Quay lại đơn hàng</Link>
  </div></main>;
}
