import { useId, useLayoutEffect, useRef } from 'react';
import { IconButton } from './IconButton.jsx';

// Dùng <dialog> gốc: giữ focus bên trong, Esc gọi onClose (nơi dùng quyết định có đóng không), trả focus về nút đã mở khi đóng.
// Bấm nền không đóng để khỏi mất dữ liệu đang nhập. Trình duyệt không cho chặn Esc khi chưa có thao tác người dùng (cancel không hủy được): lúc đó mở lại hộp thoại vì nơi dùng vẫn còn giữ nó.
export function Dialog({ title, subtitle, onClose, footer, role, className, children }) {
  const ref = useRef(null);
  const mounted = useRef(true);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    mounted.current = true;
    if (!dialog.open) dialog.showModal();
    return () => { mounted.current = false; if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} role={role} className={`ds-dialog ${className || ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose?.(); }} onClose={event => { if (mounted.current && !event.currentTarget.open) event.currentTarget.showModal(); }}>
    <div className="ds-dialog__head"><div><h3 id={titleId} className="ds-dialog__title">{title}</h3>{subtitle && <p className="ds-dialog__sub">{subtitle}</p>}</div>{onClose && <IconButton icon="x" label="Đóng" size="sm" onClick={onClose} />}</div>
    <div className="ds-dialog__body">{children}</div>{footer && <div className="ds-dialog__foot">{footer}</div>}
  </dialog>;
}
