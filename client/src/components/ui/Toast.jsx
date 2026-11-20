import { Icon } from './Icon.jsx';
import { IconButton } from './IconButton.jsx';

const icons = { success: 'check-circle', info: 'info', warning: 'alert-triangle', danger: 'alert-circle' };

// Thông báo ngắn; nơi dùng tự đặt vị trí cố định (góc dưới bên phải, z-index var(--z-toast)) và tự tắt.
export function Toast({ tone = 'success', title, message, onClose, className }) {
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={['ds-toast', `ds-toast--${tone}`, className].filter(Boolean).join(' ')}><span className="ds-toast__icon"><Icon name={icons[tone]} size={16} /></span><div className="ds-toast__text"><div className="ds-toast__title">{title}</div>{message && <div className="ds-toast__msg">{message}</div>}</div>{onClose && <IconButton icon="x" label="Đóng thông báo" size="sm" onClick={onClose} />}</div>;
}
