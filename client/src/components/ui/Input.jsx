import { useId } from 'react';
import { Icon } from './Icon.jsx';

// Nhãn, mô tả và lỗi gắn vào ô bằng aria-describedby.
export function Input({ label, hint, error, icon, suffix, size = 'md', disabled, id, className, ...rest }) {
  const auto = useId();
  const uid = id || auto;
  const note = error || hint;
  return <div className={`ds-field ${className || ''}`}>{label && <label className="ds-field__label" htmlFor={uid}>{label}</label>}
    <div className={['ds-input', size !== 'md' && `ds-input--${size}`, error && 'ds-input--error', disabled && 'ds-input--disabled'].filter(Boolean).join(' ')}>{icon && <Icon name={icon} size={18} />}<input id={uid} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={note ? `${uid}-note` : undefined} {...rest} />{suffix && <span className="ds-input__suffix">{suffix}</span>}</div>
    {note && <span id={`${uid}-note`} className={error ? 'ds-field__error' : 'ds-field__hint'}>{note}</span>}</div>;
}
