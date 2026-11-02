import { useEffect, useState } from 'react';
import LowStockAlert from '../../components/admin/LowStockAlert.jsx';
import { AdminField } from '../../components/admin/SimpleCrud.jsx';

const periods = [['7', '7 ngày'], ['28', '28 ngày'], ['quarter', 'Quý này'], ['custom', 'Tùy chọn']];
const reports = [['RPT-01', 'Báo cáo doanh thu'], ['RPT-02', 'Báo cáo đơn và sản phẩm'], ['RPT-03', 'Báo cáo hiệu quả chức năng khác biệt']];
const tiles = ['Doanh thu', 'Số đơn', 'Khách hàng', 'Sản phẩm đã bán'];

// DASH-01 + RPT-01..03: API báo cáo chưa có nên các ô số liệu hiện "—", không vẽ biểu đồ và nút CSV bị khóa. Chỉ khối cảnh báo tồn kho là dữ liệu thật.
export default function ReportAdminPage() {
  const [period, setPeriod] = useState('28');
  const [range, setRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState('RPT-01');
  useEffect(() => { document.title = 'Báo cáo · HomeCare'; }, []);
  const rangeError = period === 'custom' && range.from && range.to && range.to < range.from ? 'Ngày kết thúc phải sau ngày bắt đầu.' : '';

  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Quản trị viên</span><h1>Báo cáo</h1><p>Dashboard theo khoảng thời gian và xuất báo cáo CSV.</p></div>
    <p className="hc-note" role="note"><span className="hc-soon">Chưa triển khai</span> API dashboard và báo cáo chưa có nên các số liệu dưới đây chưa có dữ liệu và chưa xuất được CSV. Chỉ khối cảnh báo tồn kho là dữ liệu thật.</p>
    <LowStockAlert />
    <div className="hc-card hc-form">
      <h2>Kỳ báo cáo</h2>
      <fieldset className="hc-fieldset"><legend>Khoảng thời gian <span aria-hidden="true">*</span></legend>
        <div className="hc-seg-row">{periods.map(([value, label]) => <label className="hc-seg" key={value}><input type="radio" name="report-period" value={value} checked={period === value} onChange={() => setPeriod(value)} />{label}</label>)}</div></fieldset>
      {period === 'custom' && <div className="hc-form-grid">
        <AdminField field={{ id: 'report-from', name: 'from', label: 'Từ ngày', type: 'date' }} value={range.from} onChange={from => setRange(current => ({ ...current, from }))} />
        <AdminField field={{ id: 'report-to', name: 'to', label: 'Đến ngày', type: 'date' }} value={range.to} error={rangeError} onChange={to => setRange(current => ({ ...current, to }))} />
      </div>}
    </div>
    <div className="hc-tiles">{tiles.map(label => <div className="hc-card hc-tile" key={label}><small>{label}</small><b aria-label={`${label}: chưa có dữ liệu`}>—</b><span className="hc-soon">Chưa có API</span></div>)}</div>
    <div className="hc-form-grid">
      <div className="hc-card"><h2>Đơn theo trạng thái</h2><p className="hc-muted">Chưa có dữ liệu: cần API báo cáo đơn hàng.</p></div>
      <div className="hc-card"><h2>Top sản phẩm bán chạy</h2><p className="hc-muted">Chưa có dữ liệu: cần API báo cáo sản phẩm.</p></div>
    </div>
    <form className="hc-card hc-form" noValidate onSubmit={event => event.preventDefault()}>
      <h2>Xuất báo cáo CSV</h2>
      <AdminField field={{ id: 'report-kind', name: 'report', label: 'Loại báo cáo', type: 'select', options: reports.map(([code, name]) => [code, `${code} · ${name}`]), required: true }} value={report} onChange={value => setReport(value || 'RPT-01')} />
      <p className="hc-muted">Báo cáo dùng kỳ đã chọn ở trên. Chỉ hỗ trợ CSV.</p>
      <div className="hc-form-footer"><span /><button className="hc-button" type="submit" disabled aria-disabled="true">Chưa triển khai</button></div>
    </form>
  </section>;
}
