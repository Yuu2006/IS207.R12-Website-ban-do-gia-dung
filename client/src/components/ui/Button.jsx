import { Icon } from './Icon.jsx';

export function Button({ variant = 'primary', size = 'md', icon, iconRight, fullWidth = false, className, children, type = 'button', ...rest }) {
  const cn = ['ds-btn', `ds-btn--${variant}`, size !== 'md' && `ds-btn--${size}`, fullWidth && 'ds-btn--block', className].filter(Boolean).join(' ');
  return <button type={type} className={cn} {...rest}>{icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}{children}{iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}</button>;
}
