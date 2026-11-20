import { useId } from 'react';
import { Icon } from './Icon.jsx';

// options: [{ value, label }] hoặc chuỗi.
export function Select({ label, hint, error, size = 'md', options = [], placeholder, disabled, id, className, children, ...rest }) {
  const auto = useId();
  const uid = id || auto;
  const note = error || hint;
  return <div className={`ds-field ${className || ''}`}>{label && <label className="ds-field__label" htmlFor={uid}>{label}</label>}
    <div className={['ds-input', size !== 'md' && `ds-input--${size}`, error && 'ds-input--error', disabled && 'ds-input--disabled'].filter(Boolean).join(' ')}><select id={uid} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={note ? `${uid}-note` : undefined} {...rest}>{placeholder && <option value="">{placeholder}</option>}{children || options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select><Icon name="chevron-down" size={18} /></div>
    {note && <span id={`${uid}-note`} className={error ? 'ds-field__error' : 'ds-field__hint'}>{note}</span>}</div>;
}
