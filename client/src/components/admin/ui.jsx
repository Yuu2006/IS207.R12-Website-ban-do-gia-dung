import { Search } from 'lucide-react';
import { useId } from 'react';

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
export function DataTable({ label, cols, rows, rowKey, bare = false }) {
  const widths = cols.map(col => col.width || 'minmax(0, 1fr)');
  const style = { gridTemplateColumns: widths.join(' ') };
  // Cột px giữ nguyên, cột co giãn tối thiểu 200px; thấp hơn thì bảng cuộn ngang thay vì bóp chữ.
  const minWidth = widths.reduce((sum, width) => sum + (/^\d+px$/.test(width) ? parseInt(width, 10) : 200) + 16, 40);
  const table = <div className="ad-scroll"><div role="table" aria-label={label} style={{ minWidth }}>
    <div role="row" className="ad-row ad-hd" style={style}>{cols.map(col => <span role="columnheader" key={col.key}>{col.label}</span>)}</div>
    {rows.map(row => <div role="row" className="ad-row" style={style} key={rowKey(row)}>{cols.map(col => <div role="cell" key={col.key}>{col.render(row)}</div>)}</div>)}
  </div></div>;
  return bare ? table : <section className="hc-card ad-card">{table}</section>;
}

export function EmptyCard({ children }) {
  return <section className="hc-card ad-card ad-empty"><p>{children}</p></section>;
}

// Thẻ có tiêu đề, phụ đề và liên kết/hành động ở góc phải (khối "card" của template).
export function Card({ title, subtitle, action, className = '', children }) {
  const id = useId();
  return <section className={`hc-card ${className}`} aria-labelledby={id}><div className="ad-card-head"><div><h2 id={id}>{title}</h2>{subtitle && <span className="ad-sub">{subtitle}</span>}</div>{action}</div>{children}</section>;
}

// Thẻ chỉ số; pending: API chưa có nên hiện "—" và nhãn Chưa triển khai, không dùng số mẫu.
export function KpiCard({ label, value, pending = false, children }) {
  return <div className="hc-card ad-kpi"><small>{label}</small><b aria-label={pending ? `${label}: chưa có dữ liệu` : undefined}>{value ?? '—'}</b>{pending ? <span className="hc-soon">Chưa triển khai</span> : children}</div>;
}

// Khung biểu đồ chưa có dữ liệu: lưới mờ như biểu đồ thật, không vẽ số liệu giả.
export function ChartPending({ height = 180 }) {
  return <div className="ad-chart-pending" style={{ height }} role="img" aria-label="Biểu đồ chưa có dữ liệu"><span className="hc-soon">Chưa triển khai</span></div>;
}
