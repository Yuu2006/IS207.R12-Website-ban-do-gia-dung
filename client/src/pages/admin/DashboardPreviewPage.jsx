import { useEffect, useState } from 'react';
import '../customer/decision-tools.css';

const metricCards = [
  ['Doanh thu thuần', 'Đơn hoàn thành trừ khoản hoàn đã ghi nhận'],
  ['Đơn hàng', 'Đơn được đặt trong kỳ'],
  ['Khách mua hàng', 'Khách duy nhất có đơn hợp lệ trong kỳ'],
  ['Sản phẩm đã bán', 'Tổng số lượng sản phẩm của đơn hoàn thành'],
];

const decisionMetrics = [
  ['Lượt FitCheck', 'Mỗi lần chạy kiểm tra có kết quả'],
  ['Tỷ lệ không phù hợp', 'Lượt Không phù hợp / lượt FitCheck có kết quả'],
  ['Lượt tính TCO', 'Mỗi lần tính TCO thành công'],
  ['Tỷ lệ hoàn tất bảo trì', 'Việc bảo trì hoàn thành / việc đến hạn trong kỳ'],
];

// Dashboard mẫu chỉ thể hiện cấu trúc và định nghĩa dự thảo, không phát sinh số liệu giả.
export default function DashboardPreviewPage() {
  const [period, setPeriod] = useState('30');
  useEffect(() => { document.title = 'Dashboard mẫu · HomeCare'; }, []);
  return <section className="dt-page"><div className="hc-page-heading"><span className="hc-eyebrow">Quản trị</span><h1>Dashboard</h1><p>Theo dõi bán hàng, FitCheck, TCO và chăm sóc thiết bị.</p></div><div className="hc-demo-banner" role="note">Màn hình mẫu. Các định nghĩa KPI đang chờ TV2/TV3 xác nhận; API tổng hợp chưa được triển khai nên không hiển thị số liệu.</div><div className="hc-card" style={{ marginBottom: 18 }}><div className="hc-field"><label htmlFor="dashboard-period">Khoảng thời gian</label><select id="dashboard-period" value={period} onChange={event => setPeriod(event.target.value)}><option value="7">7 ngày gần nhất</option><option value="30">30 ngày gần nhất</option><option value="90">90 ngày gần nhất</option></select></div><p className="hc-muted">Bộ lọc sẽ áp dụng theo múi giờ Asia/Ho_Chi_Minh khi nối API.</p></div><div className="dt-dashboard-grid">{metricCards.map(([label, definition]) => <article className="dt-metric" key={label}><span>{label}</span><strong aria-label={`${label}: chưa có dữ liệu`}>—</strong><small>{definition}</small></article>)}</div><div className="dt-dashboard-row"><section className="hc-card"><h2>Đơn hàng theo trạng thái</h2><div className="dt-placeholder">Chưa có dữ liệu từ API báo cáo cho {period} ngày đã chọn.</div></section><section className="hc-card"><h2>Sản phẩm bán chạy & cảnh báo tồn</h2><div className="dt-placeholder">Chưa có dữ liệu từ API báo cáo và tồn kho.</div></section></div><section className="hc-card" style={{ marginTop: 18 }}><h2>Chỉ số tính năng mở rộng</h2><div className="hc-table-wrap"><table className="hc-table"><thead><tr><th>Chỉ số</th><th>Giá trị</th><th>Định nghĩa dự thảo</th></tr></thead><tbody>{decisionMetrics.map(([label, definition]) => <tr key={label}><td>{label}</td><td>—</td><td>{definition}</td></tr>)}</tbody></table></div></section></section>;
}
