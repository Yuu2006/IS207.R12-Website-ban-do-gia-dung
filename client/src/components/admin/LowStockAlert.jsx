import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInventory } from '../../services/catalog-service.js';
import { summarizeLowStock } from '../../utils/inventory-alert.js';

// WH-02: cảnh báo SKU đang bán sắp hết/hết hàng ở đầu trang tổng quan ADMIN và WAREHOUSE.
export default function LowStockAlert() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSummary(null); setError('');
    listInventory(true).then(items => { if (active) setSummary(summarizeLowStock(items)); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [attempt]);

  if (error) return <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></p>;
  if (!summary) return <p className="hc-muted" role="status">Đang kiểm tra tồn kho…</p>;
  if (summary.total === 0) return <section className="hc-stock-alert hc-stock-alert--ok" role="status"><div className="hc-stock-alert-head"><span className="hc-stock-alert-title"><CheckCircle2 size={20} aria-hidden="true" /><h2>Tồn kho ổn định — không có SKU dưới ngưỡng cảnh báo</h2></span></div></section>;

  const low = summary.total - summary.outOfStock;
  return <section className={`hc-stock-alert${summary.outOfStock > 0 ? ' hc-stock-alert--danger' : ''}`} role="alert" aria-labelledby="low-stock-title">
    <div className="hc-stock-alert-head">
      <span className="hc-stock-alert-title"><AlertTriangle size={20} aria-hidden="true" /><h2 id="low-stock-title">Cảnh báo tồn kho</h2></span>
      <span className="hc-stock-alert-figure hc-stock-alert-figure--out"><strong>{summary.outOfStock}</strong><span>SKU hết hàng</span></span>
      <span className="hc-stock-alert-figure"><strong>{low}</strong><span>SKU sắp hết</span></span>
      <Link className="hc-button" to="/warehouse/inventory?form=stock-in">Nhập hàng</Link>
    </div>
    <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Sản phẩm</th><th scope="col">Tồn</th><th scope="col">Tình trạng</th></tr></thead>
      <tbody>{summary.top.map(item => <tr key={item.variant_id}><td>{item.sku}</td><td>{item.product_name} · {item.variant_name}</td><td><strong>{item.stock_quantity}</strong></td><td>{item.stock_quantity === 0 ? <span className="hc-badge hc-badge--out">Hết hàng</span> : <span className="hc-badge hc-badge--warn">Sắp hết</span>}</td></tr>)}</tbody></table></div>
    {summary.total > summary.top.length && <p className="hc-muted">Hiển thị {summary.top.length}/{summary.total} SKU ít tồn nhất. <Link to="/warehouse/inventory">Xem tất cả</Link></p>}
  </section>;
}
