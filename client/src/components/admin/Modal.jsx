import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';

// Hộp thoại nổi dùng <dialog> gốc: tự khóa focus, Esc để đóng, lớp nền che trang. Đóng bằng nút hoặc Esc, không đóng khi bấm nền để khỏi mất dữ liệu đang nhập.
// role="alertdialog" cho hộp xác nhận; description liên kết bằng aria-describedby.
export default function Modal({ title, description, role, onClose, wide = false, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  // Layout effect: close() chạy trước khi dialog bị gỡ khỏi DOM nên focus mới quay về nút đã mở hộp thoại.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} role={role} className={`hc-modal${wide ? ' hc-modal--wide' : ''}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="hc-modal-head"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button className="hc-modal-close" type="button" aria-label="Đóng" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <div className="hc-modal-body">{children}</div>
  </dialog>;
}
