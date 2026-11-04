import { Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';

// Hộp xác nhận thao tác không thể hoàn tác (thay window.confirm). Đặt ngoài mọi <form>; lỗi của thao tác hiện ngay trong hộp.
export default function ConfirmDialog({ title, description, summary, detail, badge, confirmLabel, confirmDisabled = false, busy, error, onConfirm, onCancel, children }) {
  return <Modal role="alertdialog" icon={<Trash2 size={24} />} title={title} description={description} onClose={() => !busy && onCancel()}>
    {summary && <div className="hc-sumbox"><div><b>{summary}</b>{detail && <small>{detail}</small>}</div>{badge && <span className="hc-badge hc-badge--warn">{badge}</span>}</div>}
    {children}
    {error && <p className="hc-error" role="alert">{error}</p>}
    <div className="hc-alert-acts"><button className="hc-button hc-button--outline" type="button" disabled={busy} onClick={onCancel}>Hủy</button><button className="hc-button hc-button--danger" type="button" disabled={busy || confirmDisabled} onClick={onConfirm}>{busy ? 'Đang xử lý…' : confirmLabel}</button></div>
  </Modal>;
}
