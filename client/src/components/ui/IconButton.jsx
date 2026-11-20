import { Icon } from './Icon.jsx';

// label bắt buộc: nút chỉ có icon cần tên cho trình đọc màn hình.
export function IconButton({ icon, variant = 'ghost', size = 'md', label, className, type = 'button', ...rest }) {
  const cn = ['ds-iconbtn', `ds-iconbtn--${variant}`, size !== 'md' && `ds-iconbtn--${size}`, className].filter(Boolean).join(' ');
  return <button type={type} className={cn} aria-label={label} title={label} {...rest}><Icon name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 22 : 20} /></button>;
}
