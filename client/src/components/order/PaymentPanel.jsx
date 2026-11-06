import { useEffect, useRef, useState } from 'react';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import { useOrderAction, useOrderQuery } from '../../hooks/use-order-api.js';
import { confirmBankTransfer, orderDocument, paymentStatus } from '../../services/payment-service.js';
import { money, paymentLabel, statusLabels } from '../../services/order-ui-data.js';
import OrderApiState from './OrderApiState.jsx';
import './payment-panel.css';

// Genuine payment evidence comes from the HTTP ledger; the local order mock cannot confirm transfers.
export default function PaymentPanel({ order, staff = false, onUpdated }) {
  const service = useOrderService();
  const resource = useOrderQuery(signal => paymentStatus(order.id, staff, { signal }), [order.id, order.version, staff], { enabled: service.mode === 'http' });
  const action = useOrderAction();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState(null);
  const [documentError, setDocumentError] = useState('');
  const [documentBusy, setDocumentBusy] = useState(false);
  const payment = resource.data;
  useEffect(() => {
    if (payment?.status !== 'pending') return undefined;
    const timer = setInterval(resource.reload, 10000);
    return () => clearInterval(timer);
  }, [payment?.status, order.id]);

  async function confirm(event) {
    event.preventDefault();
    const input = { expectedVersion: payment.version, amount: Number(amount), bankTransactionRef: reference.trim(), reason: reason.trim() };
    const result = await action.run(`confirm-bank:${order.id}`, input, options => confirmBankTransfer(order.id, input, options));
    if (result) { resource.setData(result); onUpdated?.(); }
  }

  async function showDocument(type) {
    if (documentBusy) return;
    setDocumentBusy(true); setDocumentError('');
    try { setDocument(await orderDocument(order.id, staff, type)); }
    catch (error) { setDocumentError(error.message); }
    finally { setDocumentBusy(false); }
  }

  if (service.mode !== 'http') return <p className="oc-muted">Chứng từ và xác nhận chuyển khoản cần dữ liệu đơn hàng thật.</p>;
  return <section className="oc-card oc-form-section payment-panel"><h2>Giao dịch và chứng từ</h2><OrderApiState {...resource} retry={resource.reload} />
    {payment && <><p><strong>{paymentLabel(payment.status)}</strong> · {money(payment.amount)}</p><small>Mã thanh toán: {payment.reference}</small>
      {payment.refundRequired && <p className="oc-error" role="status">Khoản thu cần đối soát/hoàn tiền. Đơn không được tiếp tục giao tự động.</p>}
      {payment.bank && <div className="payment-bank"><img src={payment.bank.qrUrl} alt="QR chuyển khoản theo số tiền và nội dung của đơn" referrerPolicy="no-referrer" /><div><p>Ngân hàng (BIN): {payment.bank.bankBin}</p><p>Số tài khoản: <strong>{payment.bank.accountNo}</strong></p><p>Chủ tài khoản: {payment.bank.accountName}</p><p>Nội dung: <strong>{payment.bank.content}</strong></p><p>Chuyển đúng {money(payment.amount)}. Trạng thái sẽ cập nhật sau khi nhân viên kiểm tra tiền vào.</p><small>Nếu ảnh QR không tải được, dùng thông tin tài khoản và nội dung bên trên.</small></div></div>}
      {staff && payment.method === 'BANK_TRANSFER' && payment.status === 'pending' && <form className="payment-confirm" onSubmit={confirm}><h3>Xác nhận tiền vào từ sao kê</h3><label className="oc-field">Số tiền thực nhận (VND)<input type="number" required min="1" step="1" value={amount} disabled={action.busy || action.uncertain} onChange={event => setAmount(event.target.value)} /></label><label className="oc-field">Mã giao dịch ngân hàng<input required maxLength={80} value={reference} disabled={action.busy || action.uncertain} onChange={event => setReference(event.target.value)} /></label><label className="oc-field">Ghi chú nguồn đối soát<textarea required minLength={10} maxLength={500} value={reason} disabled={action.busy || action.uncertain} onChange={event => setReason(event.target.value)} placeholder="Đã kiểm tra tiền vào trên sao kê/tài khoản nhận…" /></label>{action.error && <p className="oc-error" role="alert">{action.error.message}</p>}<button type="submit" className="oc-button" disabled={action.busy}>{action.busy ? 'Đang xác nhận…' : action.uncertain ? 'Thử lại cùng xác nhận' : 'Xác nhận đã nhận đủ tiền'}</button></form>}
      <div className="oc-detail-actions"><button type="button" className="oc-button oc-button--outline" disabled={documentBusy || !['paid', 'refunded'].includes(payment.status)} onClick={() => showDocument('CUSTOMER')}>Bill khách hàng</button>{staff && <button type="button" className="oc-button oc-button--outline" disabled={documentBusy || !['paid', 'refunded'].includes(payment.status)} onClick={() => showDocument('INTERNAL')}>Chứng từ nội bộ</button>}<button type="button" className="oc-text-action" onClick={resource.reload}>Kiểm tra trạng thái</button></div>
      {!['paid', 'refunded'].includes(payment.status) && <p className="oc-muted">Biên nhận chỉ phát hành khi đã xác nhận thu tiền.</p>}
      {staff && payment.audit?.length > 0 && <details><summary>Lịch sử xử lý thanh toán</summary>{payment.audit.map((event, index) => <p key={index}>{event.created_at} · {event.event_type} · {event.actor_role} #{event.actor_id || 'SYSTEM'} · {event.reference_code || ''} · {event.reason}</p>)}</details>}
    </>}{documentError && <p className="oc-error" role="alert">{documentError}</p>}
    {document && <Receipt document={document} onClose={() => setDocument(null)} />}
  </section>;
}

function Receipt({ document, onClose }) {
  const sale = document.snapshot;
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = window.document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    return () => previous?.focus?.();
  }, []);
  return <div ref={dialogRef} onKeyDown={event => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const buttons = dialogRef.current?.querySelectorAll("button"); if (buttons?.length && (event.shiftKey ? window.document.activeElement === buttons[0] : window.document.activeElement === buttons[buttons.length - 1])) { event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0].focus(); } } }} className="payment-receipt-overlay" role="dialog" aria-modal="true" aria-label="Chứng từ bán hàng"><article className="payment-receipt"><div className="payment-print-actions"><button type="button" onClick={() => window.print()}>In / Lưu PDF</button><button type="button" onClick={onClose}>Đóng</button></div><header><h2>{sale.merchant.name}</h2><p>{sale.merchant.address} · {sale.merchant.phone}</p><h3>{document.type === 'INTERNAL' ? 'CHỨNG TỪ KIỂM SOÁT NỘI BỘ' : 'BIÊN NHẬN BÁN HÀNG'}</h3><p>{document.code} · Đơn {sale.orderCode}</p><p>Phát hành: {new Date(document.issuedAt).toLocaleString('vi-VN')}</p></header><p>Khách hàng: {sale.customer.recipientName} · {sale.customer.phone}</p><p>{sale.customer.addressLine}</p><table><thead><tr><th>Sản phẩm / SKU</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{sale.items.map(item => <tr key={item.orderItemId}><td>{item.productName}<br /><small>{item.skuCode} · {item.variantName}</small></td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table><dl><dt>Tiền hàng</dt><dd>{money(sale.totals.subtotal)}</dd><dt>Giảm giá</dt><dd>−{money(sale.totals.discount)}</dd><dt>Giao hàng</dt><dd>{money(sale.totals.shipping)}</dd><dt>Tổng đã thu</dt><dd><strong>{money(sale.totals.total)}</strong></dd></dl><p>{sale.paymentMethod} · Thu tiền: {new Date(sale.paidAt).toLocaleString('vi-VN')}</p><p>Trạng thái hiện tại: {statusLabels[document.currentOrderStatus]} · {paymentLabel(document.currentPaymentStatus)}{document.refundRequired ? ' · Cần đối soát/hoàn tiền' : ''}</p>{document.type === 'INTERNAL' && <><h4>Nhật ký thanh toán</h4>{document.paymentAudit?.map((event, index) => <p key={index}>{event.event_type} · {event.reference_code} · {event.actor_role} #{event.actor_id || 'SYSTEM'} · {event.reason}</p>)}</>}<footer>Biên nhận bán hàng; không phải hóa đơn điện tử thuế. Bản in lại giữ nguyên snapshot giao dịch bán.</footer></article></div>;
}
