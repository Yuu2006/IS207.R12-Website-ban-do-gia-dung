import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StockSheetDialog from '../../components/admin/StockSheetDialog.jsx';
import { listInventory } from '../../services/catalog-service.js';

const statusLabels = { in_stock: 'Còn hàng', low_stock: 'Sắp hết', out_of_stock: 'Hết hàng' };
const sheetKinds = [['in', 'Nhập kho'], ['out', 'Xuất kho'], ['adjust', 'Kiểm kê']];
// Lối tắt từ trang tổng quan: /warehouse/inventory?form=stock-in|stock-out|stock-adjust.
const formKinds = { 'stock-in': 'in', 'stock-out': 'out', 'stock-adjust': 'adjust' };

// WH-01..04: xem tồn/ngưỡng theo SKU, lọc hàng sắp hết, lập phiếu nhập/xuất/kiểm kê kèm lý do (ADMIN, WAREHOUSE).
export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [version, setVersion] = useState(0);
  const [sheet, setSheet] = useState(() => formKinds[params.get('form')] ? { kind: formKinds[params.get('form')] } : null);
  const [notice, setNotice] = useState('');

  useEffect(() => { document.title = 'Tồn kho · HomeCare'; }, []);
  useEffect(() => { if (params.has('form')) setParams({}, { replace: true }); }, []);
  useEffect(() => {
    let active = true;
    setItems(null); setError('');
    listInventory(lowOnly).then(data => { if (active) setItems(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [lowOnly, version]);

  function closeSheet(written) {
    setSheet(null);
    if (written) { setNotice(`Đã ghi ${written} dòng vào kho. Xem Nhật ký kho để đối chiếu.`); setVersion(current => current + 1); }
  }

  const lowCount = items?.filter(item => item.stock_status !== 'in_stock').length ?? 0;
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Kho hàng</span><h1>Tồn kho theo SKU</h1><p>Mỗi dòng phiếu ghi tồn trước/sau, người thực hiện và lý do. Không cho phép tồn âm. <Link to="/warehouse/history">Xem nhật ký kho →</Link></p></div>
    <div className="hc-toolbar">{sheetKinds.map(([kind, label]) => <button key={kind} className={`hc-button${kind === 'in' ? '' : ' hc-button--outline'}`} type="button" onClick={() => { setNotice(''); setSheet({ kind }); }}>{label}</button>)}</div>
    {notice && <p className="hc-success" role="status">{notice}</p>}
    {error && <p className="hc-error" role="alert">{error} {!items && <button className="hc-text-button" type="button" onClick={() => setVersion(current => current + 1)}>Thử lại</button>}</p>}
    {sheet && <StockSheetDialog key={sheet.kind + (sheet.sku ?? '')} kind={sheet.kind} initialSku={sheet.sku} onClose={closeSheet} />}
    <div className="hc-card hc-form">
      <div className="hc-heading-actions"><h2>Danh sách SKU {items && lowCount > 0 && <span className="hc-badge hc-badge--warn">{lowCount} sắp hết/hết hàng</span>}</h2><label className="hc-check"><input type="checkbox" checked={lowOnly} onChange={event => setLowOnly(event.target.checked)} />Chỉ hàng sắp hết (WH-02)</label></div>
      {!items ? !error && <p role="status" className="hc-muted">Đang tải tồn kho…</p> : items.length === 0 ? <p className="hc-muted">{lowOnly ? 'Không có SKU nào dưới ngưỡng cảnh báo.' : 'Chưa có SKU.'}</p>
        : <div className="hc-table-wrap"><table className="hc-table"><thead><tr><th scope="col">SKU</th><th scope="col">Sản phẩm</th><th scope="col">Danh mục</th><th scope="col">Tồn</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.variant_id}><td>{item.sku}</td><td>{item.product_name} · {item.variant_name}</td><td>{item.category_name}</td><td><strong>{item.stock_quantity}</strong></td><td><span className={`hc-badge${item.stock_status !== 'in_stock' ? ' hc-badge--warn' : ''}`}>{statusLabels[item.stock_status]}</span></td><td className="hc-row-actions">{sheetKinds.map(([kind, label]) => <button key={kind} className="hc-text-button" type="button" aria-label={`${label} ${item.sku}`} onClick={() => { setNotice(''); setSheet({ kind, sku: item.sku }); }}>{label}</button>)}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
