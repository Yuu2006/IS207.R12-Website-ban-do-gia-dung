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
  if (summary.total === 0) return <section className="hc-stock-alert hc-stock-alert--ok" role="status"><div className="hc-stock-alert-head"><span className="hc-stock-alert-icon" aria-hidden="true"><CheckCircle2 size={24} /></span><div><h2>Tồn kho ổn định</h2><p>Không có SKU nào dưới ngưỡng cảnh báo.</p></div></div></section>;

  return <section className={`hc-stock-alert${summary.outOfStock > 0 ? ' hc-stock-alert--danger' : ''}`} role="alert" aria-labelledby="low-stock-title">
    <div className="hc-stock-alert-head">
      <span className="hc-stock-alert-icon" aria-hidden="true"><AlertTriangle size={24} /></span>
      <div><h2 id="low-stock-title">Cảnh báo: {summary.total} SKU sắp hết hàng</h2><p>{summary.outOfStock} hết hàng · {summary.total - summary.outOfStock} sắp hết. Hiển thị {summary.top.length} SKU ít tồn nhất.</p></div>
      <Link className="hc-button" to="/warehouse/inventory">Nhập hàng ngay</Link>
    </div>
    <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Sản phẩm</th><th scope="col">Tồn</th></tr></thead>
      <tbody>{summary.top.map(item => <tr key={item.variant_id}><td>{item.sku}</td><td>{item.product_name} · {item.variant_name}</td><td><strong>{item.stock_quantity}</strong> {item.stock_quantity === 0 ? <span className="hc-badge hc-badge--out">Hết hàng</span> : <span className="hc-badge hc-badge--warn">Sắp hết</span>}</td></tr>)}</tbody></table></div>
  </section>;
}
