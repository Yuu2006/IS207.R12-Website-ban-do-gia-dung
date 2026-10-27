import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInventory } from '../../services/catalog-service.js';
import { summarizeLowStock } from '../../utils/inventory-alert.js';

// WH-02: khối cảnh báo SKU đang bán sắp hết/hết hàng trên trang tổng quan ADMIN và WAREHOUSE.
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

  return <section className="hc-card hc-form" aria-labelledby="low-stock-title">
    <div className="hc-heading-actions"><h2 id="low-stock-title">Cảnh báo sắp hết hàng {summary?.total > 0 && <span className="hc-badge hc-badge--warn">{summary.total} SKU</span>}</h2><Link to="/warehouse/inventory">Mở tồn kho →</Link></div>
    {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></p>}
    {!summary ? !error && <p className="hc-muted" role="status">Đang kiểm tra tồn kho…</p>
      : summary.total === 0 ? <p className="hc-success" role="status">Không có SKU nào dưới ngưỡng cảnh báo.</p>
      : <><p className="hc-muted">{summary.outOfStock} hết hàng · {summary.total - summary.outOfStock} sắp hết. Hiển thị {summary.top.length} SKU ít tồn nhất.</p>
        <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Sản phẩm</th><th scope="col">Tồn</th><th scope="col">Ngưỡng</th></tr></thead>
          <tbody>{summary.top.map(item => <tr key={item.variant_id}><td>{item.sku}</td><td>{item.product_name} · {item.variant_name}</td><td><strong>{item.stock_quantity}</strong> {item.stock_quantity === 0 && <span className="hc-badge hc-badge--warn">Hết hàng</span>}</td><td>{item.low_stock_threshold}</td></tr>)}</tbody></table></div></>}
  </section>;
}
