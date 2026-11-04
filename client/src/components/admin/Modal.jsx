import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';

// Hộp thoại nổi dùng <dialog> gốc: tự khóa focus, Esc để đóng, lớp nền che trang. Đóng bằng nút hoặc Esc, không đóng khi bấm nền để khỏi mất dữ liệu đang nhập.
// role="alertdialog" cho hộp xác nhận; description liên kết bằng aria-describedby. icon: bố cục hộp xác nhận (biểu tượng tròn, không nút đóng) của template; bare: không tiêu đề, nội dung tự dựng (trang xem trước).
export default function Modal({ title, description, role, onClose, wide = false, icon, bare = false, className = '', children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  // Layout effect: close() chạy trước khi dialog bị gỡ khỏi DOM nên focus mới quay về nút đã mở hộp thoại.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const heading = <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>;
  return <dialog ref={ref} role={role} className={`hc-modal${wide ? ' hc-modal--wide' : ''}${icon ? ' hc-modal--alert' : ''}${bare ? ' hc-modal--bare' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={bare ? undefined : titleId} aria-label={bare ? title : undefined} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); onClose(); }}>
    {bare ? children : icon ? <div className="hc-alertbox"><span className="hc-alert-icon" aria-hidden="true">{icon}</span>{heading}{children}</div> : <>
      <header className="hc-modal-head">{heading}<button className="hc-modal-close" type="button" aria-label="Đóng" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
      <div className="hc-modal-body">{children}</div>
    </>}
  </dialog>;
}
