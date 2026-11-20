import { useId } from 'react';

export function Textarea({ label, hint, error, rows = 3, disabled, id, className, ...rest }) {
  const auto = useId();
  const uid = id || auto;
  const note = error || hint;
  return <div className={`ds-field ${className || ''}`}>{label && <label className="ds-field__label" htmlFor={uid}>{label}</label>}
    <div className={['ds-input', 'ds-input--area', error && 'ds-input--error', disabled && 'ds-input--disabled'].filter(Boolean).join(' ')}><textarea id={uid} rows={rows} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={note ? `${uid}-note` : undefined} {...rest} /></div>
    {note && <span id={`${uid}-note`} className={error ? 'ds-field__error' : 'ds-field__hint'}>{note}</span>}</div>;
}
