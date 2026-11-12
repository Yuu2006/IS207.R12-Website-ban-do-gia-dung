import { Download, FileText, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ReportExportDialog from '../../components/admin/ReportExportDialog.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { Card, Chips, DataTable, KpiCard, PageHead } from '../../components/admin/ui.jsx';
import { downloadRevenueCsv, getDashboard } from '../../services/reports-service.js';

const periods = [['7', '7 ngày'], ['28', '28 ngày'], ['quarter', 'Quý này'], ['custom', 'Tùy chọn']];
const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', delivered: 'Đã giao', completed: 'Hoàn tất', cancelled: 'Đã hủy' };
const vnd = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
const count = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('vi-VN').format(value);
const topColumns = [
  { key: 'product', label: 'Sản phẩm', width: 'minmax(0, 2fr)', render: row => row.productName },
  { key: 'sold', label: 'Đã bán', width: '110px', render: row => count(row.soldUnits) },
  { key: 'revenue', label: 'Doanh thu dòng hàng', render: row => vnd(row.revenueVnd) },
];
const stockColumns = [
  { key: 'sku', label: 'SKU', width: '130px', render: row => row.sku },
  { key: 'product', label: 'Sản phẩm', width: 'minmax(0, 2fr)', render: row => `${row.productName}${row.variantName ? ` · ${row.variantName}` : ''}` },
  { key: 'stock', label: 'Tồn / ngưỡng', width: '120px', render: row => `${row.stockQuantity} / ${row.threshold}` },
];

// Inclusive local dates for the chosen chip; null while a custom range is incomplete or invalid.
function resolveRange(period, range) {
  if (period === 'custom') {
    const { from, to } = range;
    if (!from || !to || to < from || (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000 > 365) return null;
    return { from, to };
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const start = new Date(today);
  if (period === 'quarter') start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
  else start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  const ymd = value => value.toISOString().slice(0, 10);
  return { from: ymd(start), to: ymd(today) };
}

// DASH-01 + RPT-01..03: KPI, trạng thái đơn, top sản phẩm và cảnh báo tồn lấy từ GET /admin/dashboard; CSV giữ nguyên.
export default function ReportAdminPage() {
  const [period, setPeriod] = useState('28');
  const [range, setRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [dashboard, setDashboard] = useState({ loading: false, error: '', data: null });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { document.title = 'Báo cáo · HomeCare'; }, []);
  const rangeError = period === 'custom' && range.from && range.to && range.to < range.from ? 'Ngày kết thúc phải sau ngày bắt đầu.' : '';
  const periodLabel = periods.find(([key]) => key === period)[1].toLowerCase();
  const resolved = resolveRange(period, range);
  const from = resolved?.from || '';
  const to = resolved?.to || '';

  useEffect(() => {
    if (!from || !to) { setDashboard({ loading: false, error: '', data: null }); return undefined; }
    const controller = new AbortController();
    setDashboard(current => ({ ...current, loading: true, error: '' }));
    getDashboard(from, to, { signal: controller.signal })
      .then(data => setDashboard({ loading: false, error: '', data }))
      .catch(error => { if (error.name !== 'AbortError') setDashboard({ loading: false, error: error.message || 'Không thể tải dashboard.', data: null }); });
    return () => controller.abort();
  }, [from, to, reloadKey]);
  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  async function exportCsv() {
    if (!from || !to) return;
    setDownloading(true);
    setExportError('');
    try {
      const blob = await downloadRevenueCsv(from, to);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `homecare-revenue-${from}-to-${to}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error.message); }
    finally { setDownloading(false); }
  }

  return <section>
    <PageHead title="Báo cáo" subtitle="Doanh thu thuần, đơn hàng, sản phẩm bán chạy và cảnh báo tồn kho theo múi giờ Việt Nam.">
      <button className="hc-button hc-button--outline" type="button" onClick={() => setExporting(true)}><FileText size={18} aria-hidden="true" />Xuất PDF<span className="hc-soon">Chưa triển khai</span></button>
      <button className="hc-button" type="button" disabled={downloading || !from || !to} onClick={exportCsv}><Download size={18} aria-hidden="true" />{downloading ? 'Đang tải…' : 'Xuất CSV'}</button>
    </PageHead>
    <p className="hc-note" role="note">Doanh thu ghi nhận một lần khi đơn chuyển “Hoàn tất” và đã thanh toán, trừ các khoản hoàn tiền mô phỏng ghi sổ trong kỳ; đơn hủy không tính doanh thu. Cảnh báo tồn là ảnh chụp hiện tại, không theo kỳ.</p>
    {exportError && <p className="hc-error" role="alert">{exportError}</p>}
    <Chips label="Khoảng thời gian" options={periods} value={period} onChange={setPeriod} />
    {period === 'custom' && <div className="hc-card"><div className="hc-form-grid">
      <AdminField field={{ id: 'report-from', name: 'from', label: 'Từ ngày', type: 'date' }} value={range.from} onChange={value => setRange(current => ({ ...current, from: value }))} />
      <AdminField field={{ id: 'report-to', name: 'to', label: 'Đến ngày', type: 'date' }} value={range.to} error={rangeError} onChange={value => setRange(current => ({ ...current, to: value }))} />
    </div></div>}
    {from && to && <p className="ad-sub" aria-live="polite">Kỳ báo cáo: {from} → {to}{dashboard.loading ? ' · đang tải…' : ''}</p>}
    {dashboard.error && <p className="hc-error" role="alert">{dashboard.error} <button className="hc-text-button" type="button" onClick={retry}><RefreshCw size={14} aria-hidden="true" /> Thử lại</button></p>}
    {(() => {
      const data = dashboard.data;
      const sales = data?.sales;
      const statuses = data?.ordersByStatus || [];
      const placed = sales?.placedOrders || 0;
      return <>
        <div className="ad-kpis" aria-label="Chỉ số tổng hợp">
          <KpiCard label={`Doanh thu thuần ${periodLabel}`} value={sales ? vnd(sales.netRevenueVnd) : null}>{sales && <span className="ad-sub">Bán {vnd(sales.grossSalesVnd)} · hoàn {vnd(sales.refundsVnd)}</span>}</KpiCard>
          <KpiCard label="Đơn đã đặt" value={sales ? count(sales.placedOrders) : null}>{sales && <span className="ad-sub">{count(sales.completedOrders)} đơn hoàn tất</span>}</KpiCard>
          <KpiCard label="Giá trị đơn trung bình" value={sales ? vnd(sales.averageOrderValueVnd) : null}>{sales && <span className="ad-sub">{count(sales.saleOrders)} đơn ghi nhận doanh thu</span>}</KpiCard>
          <KpiCard label="Khách mua / sản phẩm bán" value={sales ? `${count(sales.purchasingCustomers)} / ${count(sales.soldUnits)}` : null} />
        </div>
        <div className="ad-cols">
          <div className="ad-grow2"><Card title="Đơn theo trạng thái" subtitle="Đơn đặt trong kỳ, nhóm theo trạng thái hiện tại">
            {statuses.length ? <ul className="ad-status-bars">{statuses.map(row => <li key={row.status}><span>{statusLabels[row.status] || row.status}</span><span className="ad-status-track" aria-hidden="true"><span style={{ width: `${placed ? Math.round(row.orders * 100 / placed) : 0}%` }} /></span><b>{count(row.orders)}</b></li>)}</ul> : <p className="ad-sub">{data ? 'Không có đơn đặt trong kỳ.' : '—'}</p>}
          </Card></div>
          <Card title="Công cụ hỗ trợ chọn mua" subtitle="Sự kiện trong kỳ">
            <ul className="ad-status-bars"><li><span>Lượt FitCheck</span><b>{count(data?.decisionTools?.fitChecks)}</b></li><li><span>Tỷ lệ không phù hợp</span><b>{data?.decisionTools?.notFitRate === null || data?.decisionTools?.notFitRate === undefined ? '—' : `${Math.round(data.decisionTools.notFitRate * 1000) / 10}%`}</b></li><li><span>Lượt tính TCO</span><b>{count(data?.decisionTools?.tcoCalculations)}</b></li><li><span>Hoàn tất bảo trì</span><b title="Chờ nhóm chốt cách tính lịch hoãn/hoàn tất muộn">—</b></li></ul>
          </Card>
        </div>
        <section className="hc-card ad-card" aria-labelledby="top-products-title">
          <div className="ad-card-head ad-pad"><div><h2 id="top-products-title">Sản phẩm bán chạy nhất</h2><span className="ad-sub">Xếp theo số lượng của đơn hoàn tất trong kỳ</span></div></div>
          <DataTable bare label="Sản phẩm bán chạy nhất" cols={topColumns} rows={data?.topProducts || []} rowKey={row => row.productId} empty={data ? 'Chưa có đơn hoàn tất trong kỳ.' : 'Chưa có dữ liệu.'} />
        </section>
        <section className="hc-card ad-card" aria-labelledby="low-stock-title">
          <div className="ad-card-head ad-pad"><div><h2 id="low-stock-title">Cảnh báo tồn kho</h2><span className="ad-sub">{data ? `${count(data.lowStock.total)} SKU đang bán có tồn ≤ ngưỡng` : 'SKU đang bán có tồn ≤ ngưỡng'}</span></div></div>
          <DataTable bare label="Cảnh báo tồn kho" cols={stockColumns} rows={data?.lowStock.items || []} rowKey={row => row.variantId} empty={data ? 'Không có SKU dưới ngưỡng.' : 'Chưa có dữ liệu.'} />
        </section>
      </>;
    })()}
    {exporting && <ReportExportDialog initialPeriod={period} onClose={() => setExporting(false)} />}
  </section>;
}
