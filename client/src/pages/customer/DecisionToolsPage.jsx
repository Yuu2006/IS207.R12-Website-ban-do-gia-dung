import { useEffect, useState } from 'react';
import { Calculator, House, PackageCheck } from 'lucide-react';
import RoomFitPanel from './RoomFitPanel.jsx';
import './decision-tools.css';

const tabs = [
  ['room', 'Không gian & FitCheck', House],
  ['tco', 'Chi phí sở hữu', Calculator],
  ['devices', 'Thiết bị & bảo trì', PackageCheck],
];

function PageHeading({ eyebrow, title, description }) {
  return <div className="hc-page-heading"><span className="hc-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function TcoPanel() {
  const [years, setYears] = useState(3);
  return <div className="dt-stack"><section className="hc-card"><h2>Kịch bản chi phí sở hữu</h2><p className="hc-muted">Chọn hai sản phẩm cùng danh mục và giả định sử dụng. Kết quả sẽ do API tính từ giá hiện tại và thông số sản phẩm.</p><div className="hc-form-grid"><div className="hc-field"><label htmlFor="tco-first">Sản phẩm thứ nhất</label><select id="tco-first" disabled><option>Chờ API sản phẩm</option></select></div><div className="hc-field"><label htmlFor="tco-second">Sản phẩm thứ hai</label><select id="tco-second" disabled><option>Chờ API sản phẩm cùng danh mục</option></select></div><div className="hc-field"><label htmlFor="tco-frequency">Tần suất sử dụng mỗi tuần</label><input id="tco-frequency" type="number" min="0" placeholder="Ví dụ: 5 lần" /></div><div className="hc-field"><label htmlFor="tco-electricity">Giá điện (₫/kWh)</label><input id="tco-electricity" type="number" min="0" placeholder="Nhập giá điện dự kiến" /></div><div className="hc-field"><label htmlFor="tco-water">Giá nước (₫/m³)</label><input id="tco-water" type="number" min="0" placeholder="Nhập giá nước dự kiến" /></div><div className="hc-field"><label htmlFor="tco-years">Thời gian sở hữu</label><select id="tco-years" value={years} onChange={event => setYears(Number(event.target.value))}><option value="1">1 năm</option><option value="3">3 năm</option><option value="5">5 năm</option></select></div></div><div className="dt-note">TCO {years} năm = giá mua + điện + nước + vật tư + bảo trì trong {years} năm. Dữ liệu thiếu sẽ được chỉ rõ, không mặc định là 0.</div><button className="hc-button" type="button" disabled>Tính TCO (chưa khả dụng)</button></section><section className="hc-card"><h2>Kết quả so sánh</h2><div className="dt-placeholder">Chưa có phép tính. Cần API TCO và hai sản phẩm cùng danh mục để hiển thị tổng tiền, từng khoản và giả định.</div></section></div>;
}

function DevicesPanel() {
  return <div className="dt-stack"><section className="hc-card"><h2>Thiết bị của tôi</h2><div className="dt-placeholder">Chưa có dữ liệu thiết bị từ API. Sau khi đơn hàng hoàn thành, thiết bị sẽ được tạo theo từng chiếc đã mua, kèm SKU, ngày mua và bảo hành.</div></section><section className="hc-card"><h2>Lịch bảo trì</h2><div className="dt-placeholder">Khi đã có thiết bị, lịch vệ sinh, kiểm tra và thay vật tư sẽ xuất hiện ở đây. Người dùng có thể đánh dấu hoàn thành hoặc hoãn theo quy tắc bảo trì.</div></section></div>;
}

// Tab TCO và thiết bị còn là bản mẫu: không ghi dữ liệu hoặc giả lập phản hồi API.
export default function DecisionToolsPage() {
  const [activeTab, setActiveTab] = useState('room');
  useEffect(() => { document.title = 'Không gian và thiết bị · HomeCare'; }, []);
  return <section className="dt-page"><PageHeading eyebrow="Công cụ lựa chọn và chăm sóc" title="Không gian & thiết bị" description="Kiểm tra độ phù hợp, ước tính chi phí sở hữu và theo dõi thiết bị sau mua." /><div className="hc-demo-banner" role="note">Tab chi phí sở hữu và thiết bị & bảo trì là màn hình mẫu: chưa có API, dữ liệu nhập không được lưu.</div><div className="hc-tabs" aria-label="Công cụ không gian và thiết bị">{tabs.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}><Icon size={16} aria-hidden="true" />{label}</button>)}</div><div>{activeTab === 'room' ? <RoomFitPanel /> : activeTab === 'tco' ? <TcoPanel /> : <DevicesPanel />}</div></section>;
}
