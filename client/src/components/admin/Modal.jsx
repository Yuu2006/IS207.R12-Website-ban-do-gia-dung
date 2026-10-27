import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

// Hộp thoại nổi dùng <dialog> gốc: tự khóa focus, Esc để đóng, lớp nền che trang. Đóng bằng nút hoặc Esc, không đóng khi bấm nền để khỏi mất dữ liệu đang nhập.
export default function Modal({ title, onClose, wide = false, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className={`hc-modal${wide ? ' hc-modal--wide' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="hc-modal-head"><h2 id={titleId}>{title}</h2><button className="hc-modal-close" type="button" aria-label="Đóng" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <div className="hc-modal-body">{children}</div>
  </dialog>;
}
