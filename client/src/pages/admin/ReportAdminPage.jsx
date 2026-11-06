import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReportExportDialog from '../../components/admin/ReportExportDialog.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { Card, ChartPending, Chips, DataTable, KpiCard, PageHead } from '../../components/admin/ui.jsx';
import { downloadRevenueCsv } from '../../services/reports-service.js';

const periods = [['7', '7 ngày'], ['28', '28 ngày'], ['quarter', 'Quý này'], ['custom', 'Tùy chọn']];
// Khung bảng theo template; chưa có API báo cáo nên không có dòng nào.
const topColumns = [['product', 'Sản phẩm', 'minmax(0, 2fr)'], ['sold', 'Đã bán', '110px'], ['revenue', 'Doanh thu']].map(([key, label, width]) => ({ key, label, width, render: () => null }));

// DASH-01 + RPT-01..03: API báo cáo chưa có nên số liệu hiện "—", biểu đồ chỉ là khung và xuất báo cáo bị khóa.
export default function ReportAdminPage() {
  const [period, setPeriod] = useState('28');
  const [range, setRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState('');
  useEffect(() => { document.title = 'Báo cáo · HomeCare'; }, []);
  const rangeError = period === 'custom' && range.from && range.to && range.to < range.from ? 'Ngày kết thúc phải sau ngày bắt đầu.' : '';
  const periodLabel = periods.find(([key]) => key === period)[1].toLowerCase();

  async function exportCsv() {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const parts = Object.fromEntries(date.map(part => [part.type, part.value]));
    const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    const ymd = value => value.toISOString().slice(0, 10);
    let from = range.from;
    let to = range.to;
    if (period !== 'custom') {
      to = ymd(today);
      const start = new Date(today);
      if (period === 'quarter') start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
      else start.setUTCDate(start.getUTCDate() - Number(period) + 1);
      from = ymd(start);
    }
    if (!from || !to || to < from || (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000 > 365) return;
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
    <PageHead title="Báo cáo" subtitle="Doanh thu, sản phẩm bán chạy và cơ cấu danh mục. Đặc tả MVP chỉ xuất CSV.">
      <button className="hc-button hc-button--outline" type="button" onClick={() => setExporting(true)}><FileText size={18} aria-hidden="true" />Xuất PDF<span className="hc-soon">Chưa triển khai</span></button>
      <button className="hc-button" type="button" disabled={downloading || Boolean(rangeError) || (period === 'custom' && (!range.from || !range.to))} onClick={exportCsv}><Download size={18} aria-hidden="true" />{downloading ? 'Đang tải…' : 'Xuất CSV'}</button>
    </PageHead>
    <p className="hc-note" role="note">Xuất CSV gồm doanh thu đơn hoàn tất đã thanh toán và các khoản hoàn tiền mô phỏng, theo múi giờ Việt Nam. Các biểu đồ và KPI phía dưới chưa có API tổng hợp.</p>
    {exportError && <p className="hc-error" role="alert">{exportError}</p>}
    <Chips label="Khoảng thời gian" options={periods} value={period} onChange={setPeriod} />
    {period === 'custom' && <div className="hc-card"><div className="hc-form-grid">
      <AdminField field={{ id: 'report-from', name: 'from', label: 'Từ ngày', type: 'date' }} value={range.from} onChange={from => setRange(current => ({ ...current, from }))} />
      <AdminField field={{ id: 'report-to', name: 'to', label: 'Đến ngày', type: 'date' }} value={range.to} error={rangeError} onChange={to => setRange(current => ({ ...current, to }))} />
    </div></div>}
    <div className="ad-kpis" aria-label="Chỉ số tổng hợp">
      <KpiCard label={`Doanh thu ${periodLabel}`} pending /><KpiCard label="Số đơn hàng" pending /><KpiCard label="Giá trị đơn trung bình" pending />
    </div>
    <div className="ad-cols">
      <div className="ad-grow2"><Card title="Doanh thu theo tuần" subtitle="Đơn vị: triệu đồng"><ChartPending height={220} /></Card></div>
      <Card title="Cơ cấu doanh thu theo danh mục" subtitle="Tủ lạnh, máy giặt, máy lạnh"><ChartPending height={220} /></Card>
    </div>
    <section className="hc-card ad-card" aria-labelledby="top-products-title">
      <div className="ad-card-head ad-pad"><div><h2 id="top-products-title">Sản phẩm bán chạy nhất</h2><span className="ad-sub">Xếp theo doanh thu</span></div></div>
      <DataTable bare label="Sản phẩm bán chạy nhất" cols={topColumns} rows={[]} rowKey={row => row.id} empty="Chưa có dữ liệu: cần API báo cáo sản phẩm." />
    </section>
    {exporting && <ReportExportDialog initialPeriod={period} onClose={() => setExporting(false)} />}
  </section>;
}
