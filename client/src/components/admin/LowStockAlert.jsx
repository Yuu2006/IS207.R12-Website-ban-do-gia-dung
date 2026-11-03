import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInventory } from '../../services/catalog-service.js';
import { summarizeLowStock } from '../../utils/inventory-alert.js';

// WH-02: tải SKU đang bán sắp hết/hết hàng (đã lọc ở server) và tóm tắt, ít tồn nhất trước.
export function useLowStock() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSummary(null); setError('');
    listInventory(true).then(items => { if (active) setSummary(summarizeLowStock(items)); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [attempt]);
  return { summary, error, retry: () => setAttempt(current => current + 1) };
}

// Thẻ "Cảnh báo tồn kho" của tổng quan/báo cáo; nhận state từ useLowStock để trang cha dùng chung số liệu.
export function LowStockCard({ state: { summary, error, retry } }) {
  let body;
  if (error) body = <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={retry}>Thử lại</button></p>;
  else if (!summary) body = <p className="hc-muted" role="status">Đang kiểm tra tồn kho…</p>;
  else if (summary.total === 0) body = <p className="hc-muted" role="status">Tồn kho ổn định, không có SKU dưới ngưỡng cảnh báo.</p>;
  else body = <>
    <div>{summary.top.map(item => <div className="ad-list-item" key={item.variant_id}>
      <div><b>{item.product_name} · {item.variant_name}</b><span className="ad-sub">{item.sku}</span></div>
      <span className={`hc-badge ${item.stock_quantity === 0 ? 'hc-badge--out' : 'hc-badge--warn'}`}>{item.stock_quantity === 0 ? 'Hết hàng' : `Còn ${item.stock_quantity}`}</span>
    </div>)}</div>
    <p className="hc-muted">{summary.total} SKU dưới ngưỡng, trong đó {summary.outOfStock} hết hàng.{summary.total > summary.top.length && ` Hiển thị ${summary.top.length} SKU ít tồn nhất.`} <Link to="/warehouse/inventory?form=stock-in">Nhập hàng</Link></p>
  </>;
  return <section className="hc-card" aria-labelledby="low-stock-title">
    <div className="ad-card-head"><h2 id="low-stock-title">Cảnh báo tồn kho</h2><Link className="ad-link" to="/warehouse/inventory">Xem tất cả</Link></div>
    {body}
  </section>;
}

export default function LowStockAlert() { return <LowStockCard state={useLowStock()} />; }
