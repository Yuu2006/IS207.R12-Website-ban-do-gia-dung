import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReportExportDialog from '../../components/admin/ReportExportDialog.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';
import { Card, ChartPending, Chips, DataTable, KpiCard, PageHead } from '../../components/admin/ui.jsx';

const periods = [['7', '7 ngày'], ['28', '28 ngày'], ['quarter', 'Quý này'], ['custom', 'Tùy chọn']];
// Khung bảng theo template; chưa có API báo cáo nên không có dòng nào.
const topColumns = [['product', 'Sản phẩm', 'minmax(0, 2fr)'], ['sold', 'Đã bán', '110px'], ['revenue', 'Doanh thu']].map(([key, label, width]) => ({ key, label, width, render: () => null }));

// DASH-01 + RPT-01..03: API báo cáo chưa có nên số liệu hiện "—", biểu đồ chỉ là khung và xuất báo cáo bị khóa.
export default function ReportAdminPage() {
  const [period, setPeriod] = useState('28');
  const [range, setRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  useEffect(() => { document.title = 'Báo cáo · HomeCare'; }, []);
  const rangeError = period === 'custom' && range.from && range.to && range.to < range.from ? 'Ngày kết thúc phải sau ngày bắt đầu.' : '';
  const periodLabel = periods.find(([key]) => key === period)[1].toLowerCase();

  return <section>
    <PageHead title="Báo cáo" subtitle="Doanh thu, sản phẩm bán chạy và cơ cấu danh mục. Đặc tả MVP chỉ xuất CSV.">
      <button className="hc-button hc-button--outline" type="button" onClick={() => setExporting(true)}><FileText size={18} aria-hidden="true" />Xuất PDF<span className="hc-soon">Chưa triển khai</span></button>
      <button className="hc-button" type="button" disabled title="Chưa triển khai"><Download size={18} aria-hidden="true" />Xuất CSV</button>
    </PageHead>
    <p className="hc-note" role="note"><span className="hc-soon">Chưa triển khai</span> API dashboard và báo cáo chưa có nên các số liệu dưới đây chưa có dữ liệu và chưa xuất được tệp.</p>
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
