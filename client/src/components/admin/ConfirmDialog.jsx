import Modal from './Modal.jsx';

// Hộp xác nhận thao tác không thể hoàn tác (thay window.confirm). Đặt ngoài mọi <form>; lỗi của thao tác hiện ngay trong hộp.
export default function ConfirmDialog({ title, description, summary, detail, badge, confirmLabel, busy, error, onConfirm, onCancel }) {
  return <Modal role="alertdialog" title={title} description={description} onClose={() => !busy && onCancel()}>
    <div className="hc-form">
      {summary && <div className="hc-sumbox"><div><b>{summary}</b>{detail && <small>{detail}</small>}</div>{badge && <span className="hc-badge hc-badge--warn">{badge}</span>}</div>}
      {error && <p className="hc-error" role="alert">{error}</p>}
      <div className="hc-form-footer"><span /><span className="hc-actions"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={onCancel}>Hủy</button><button className="hc-button hc-button--danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xử lý…' : confirmLabel}</button></span></div>
    </div>
  </Modal>;
}
