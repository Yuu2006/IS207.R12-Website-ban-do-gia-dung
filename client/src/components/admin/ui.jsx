import { Search } from 'lucide-react';

// Khối giao diện dùng chung cho trang nhân viên theo admin-template (lớp .ad-* nằm trong styles/admin-template.css).

export function PageHead({ title, subtitle, children }) {
  return <header className="ad-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div className="ad-head-actions">{children}</div>}</header>;
}

export function SearchBox({ label, placeholder, value, onChange }) {
  return <label className="ad-search"><Search size={18} aria-hidden="true" /><input type="search" placeholder={placeholder} aria-label={label} value={value} onChange={event => onChange(event.target.value)} /></label>;
}

// options: [[giá trị, nhãn]]; bấm lại chip đang chọn không bỏ chọn.
export function Chips({ label, options, value, onChange }) {
  return <div className="ad-chips" role="group" aria-label={label}>{options.map(([key, text]) => <button key={key} type="button" className={`ad-chip${value === key ? ' on' : ''}`} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>)}</div>;
}

// cols: [{ key, label, width, render(row) }]; bảng dạng lưới của template, cuộn ngang khi hẹp.
export function DataTable({ label, cols, rows, rowKey }) {
  const widths = cols.map(col => col.width || 'minmax(0, 1fr)');
  const style = { gridTemplateColumns: widths.join(' ') };
  // Cột px giữ nguyên, cột co giãn tối thiểu 200px; thấp hơn thì bảng cuộn ngang thay vì bóp chữ.
  const minWidth = widths.reduce((sum, width) => sum + (/^\d+px$/.test(width) ? parseInt(width, 10) : 200) + 16, 40);
  return <section className="hc-card ad-card"><div className="ad-scroll"><div role="table" aria-label={label} style={{ minWidth }}>
    <div role="row" className="ad-row ad-hd" style={style}>{cols.map(col => <span role="columnheader" key={col.key}>{col.label}</span>)}</div>
    {rows.map(row => <div role="row" className="ad-row" style={style} key={rowKey(row)}>{cols.map(col => <div role="cell" key={col.key}>{col.render(row)}</div>)}</div>)}
  </div></div></section>;
}

export function EmptyCard({ children }) {
  return <section className="hc-card ad-card ad-empty"><p>{children}</p></section>;
}
