export function Switch({ label, disabled, className, children, ...rest }) {
  return <label className={`ds-check ds-switch ${disabled ? 'ds-check--disabled ' : ''}${className || ''}`}><input type="checkbox" role="switch" disabled={disabled} {...rest} />{(label || children) && <span>{label || children}</span>}</label>;
}
