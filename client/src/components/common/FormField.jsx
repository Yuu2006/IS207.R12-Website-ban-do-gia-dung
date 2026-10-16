// Label, yêu cầu bắt buộc và lỗi theo trường dùng chung cho hồ sơ/địa chỉ.
export default function FormField({ id, label, value, onChange, error, required = false, ...inputProps }) {
  return <div className="hc-field"><label htmlFor={id}>{label}{required && <span aria-label="bắt buộc"> *</span>}</label><input id={id} value={value} onChange={event => onChange(event.target.value)} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />{error && <p className="hc-field-error" id={`${id}-error`}>{error}</p>}</div>;
}
