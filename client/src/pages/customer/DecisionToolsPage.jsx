import { useEffect, useState } from 'react';
import { Calculator, CheckCircle2, CircleHelp, House, PackageCheck, Ruler, TriangleAlert } from 'lucide-react';
import './decision-tools.css';

const tabs = [
  ['room', 'Không gian & FitCheck', House],
  ['tco', 'Chi phí sở hữu', Calculator],
  ['devices', 'Thiết bị & bảo trì', PackageCheck],
];

const exampleChecks = [
  { title: 'Phù hợp', icon: CheckCircle2, tone: 'fit', detail: 'Ví dụ: kích thước sản phẩm và khoảng hở đều nằm trong giới hạn của hồ sơ phòng.' },
  { title: 'Cần kiểm tra thêm', icon: CircleHelp, tone: 'check', detail: 'Ví dụ: thiếu chiều cao hoặc thông tin nguồn điện. Không tự suy ra là phù hợp.' },
  { title: 'Không phù hợp', icon: TriangleAlert, tone: 'no-fit', detail: 'Ví dụ: chiều rộng cần lắp lớn hơn chiều rộng vị trí đặt.' },
];

const roomFields = [
  ['placementWidthMm', 'Chiều rộng vị trí đặt (mm)'],
  ['placementDepthMm', 'Chiều sâu vị trí đặt (mm)'],
  ['placementHeightMm', 'Chiều cao vị trí đặt (mm)'],
  ['doorWidthMm', 'Chiều rộng cửa đi qua (mm)'],
  ['floorAreaM2', 'Diện tích phòng (m²)'],
  ['occupantCount', 'Số người sử dụng'],
];

function PageHeading({ eyebrow, title, description }) {
  return <div className="hc-page-heading"><span className="hc-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function RoomPanel({ room, setRoom }) {
  const setField = (key, value) => setRoom(current => ({ ...current, [key]: value }));
  return <div className="dt-stack">
    <div className="dt-grid dt-grid--room">
      <section className="hc-card"><div className="dt-section-head"><Ruler size={21} aria-hidden="true" /><div><h2>Hồ sơ không gian</h2><p className="hc-muted">Nhập kích thước theo mm. 32 cm tương đương 320 mm.</p></div></div>
        <div className="hc-form dt-room-form"><div className="hc-field"><label htmlFor="room-name">Tên không gian</label><input id="room-name" value={room.name} onChange={event => setField('name', event.target.value)} placeholder="Ví dụ: Góc bếp" /></div>
          <div className="hc-form-grid">{roomFields.map(([key, label]) => <div className="hc-field" key={key}><label htmlFor={key}>{label}</label><input id={key} type="number" min="0" step={key === 'floorAreaM2' ? '0.01' : '1'} value={room[key]} onChange={event => setField(key, event.target.value)} placeholder="Chưa nhập" /></div>)}</div>
          <div className="hc-form-grid">{[['powerAvailable', 'Có nguồn điện phù hợp?'], ['waterSupply', 'Có nguồn cấp nước?'], ['drainage', 'Có đường thoát nước?']].map(([key, label]) => <div className="hc-field" key={key}><label htmlFor={key}>{label}</label><select id={key} value={room[key]} onChange={event => setField(key, event.target.value)}><option value="">Chưa rõ</option><option value="yes">Có</option><option value="no">Không</option></select></div>)}</div>
          <div className="hc-form-footer"><span className="hc-muted">Bản mẫu giao diện: dữ liệu nhập chỉ nằm trên trang, chưa lưu vào tài khoản.</span><button className="hc-button" type="button" disabled title="Chờ API hồ sơ phòng">Lưu hồ sơ (chưa khả dụng)</button></div>
        </div>
      </section>
      <section className="hc-card"><h2>Kiểm tra sản phẩm với không gian</h2><p className="hc-muted">Khi nối catalog và API FitCheck, người dùng sẽ chọn hồ sơ đã lưu cùng sản phẩm cần kiểm tra.</p><div className="hc-field"><label htmlFor="fit-product">Sản phẩm</label><select id="fit-product" disabled><option>Chờ danh sách sản phẩm từ API</option></select></div><div className="dt-note">Kết quả phụ thuộc kích thước sản phẩm, khoảng hở lắp đặt và quy tắc theo danh mục do quản trị cấu hình. Không chỉ so chiều rộng và chiều sâu.</div><button className="hc-button hc-button--outline" type="button" disabled>Chạy FitCheck (chưa khả dụng)</button></section>
    </div>
    <section className="hc-card"><h2>Ba mức kết quả cần hiển thị</h2><p className="hc-muted">Các thẻ dưới đây minh họa giao diện, không phải kết quả kiểm tra của dữ liệu vừa nhập.</p><div className="dt-grid dt-grid--three">{exampleChecks.map(({ title, icon: Icon, tone, detail }) => <article className={`dt-result dt-result--${tone}`} key={title}><Icon size={22} aria-hidden="true" /><strong>{title}</strong><p>{detail}</p></article>)}</div></section>
  </div>;
}

function TcoPanel() {
  const [years, setYears] = useState(3);
  return <div className="dt-stack"><section className="hc-card"><h2>Kịch bản chi phí sở hữu</h2><p className="hc-muted">Chọn hai sản phẩm cùng danh mục và giả định sử dụng. Kết quả sẽ do API tính từ giá hiện tại và thông số sản phẩm.</p><div className="hc-form-grid"><div className="hc-field"><label htmlFor="tco-first">Sản phẩm thứ nhất</label><select id="tco-first" disabled><option>Chờ API sản phẩm</option></select></div><div className="hc-field"><label htmlFor="tco-second">Sản phẩm thứ hai</label><select id="tco-second" disabled><option>Chờ API sản phẩm cùng danh mục</option></select></div><div className="hc-field"><label htmlFor="tco-frequency">Tần suất sử dụng mỗi tuần</label><input id="tco-frequency" type="number" min="0" placeholder="Ví dụ: 5 lần" /></div><div className="hc-field"><label htmlFor="tco-electricity">Giá điện (₫/kWh)</label><input id="tco-electricity" type="number" min="0" placeholder="Nhập giá điện dự kiến" /></div><div className="hc-field"><label htmlFor="tco-water">Giá nước (₫/m³)</label><input id="tco-water" type="number" min="0" placeholder="Nhập giá nước dự kiến" /></div><div className="hc-field"><label htmlFor="tco-years">Thời gian sở hữu</label><select id="tco-years" value={years} onChange={event => setYears(Number(event.target.value))}><option value="1">1 năm</option><option value="3">3 năm</option><option value="5">5 năm</option></select></div></div><div className="dt-note">TCO {years} năm = giá mua + điện + nước + vật tư + bảo trì trong {years} năm. Dữ liệu thiếu sẽ được chỉ rõ, không mặc định là 0.</div><button className="hc-button" type="button" disabled>Tính TCO (chưa khả dụng)</button></section><section className="hc-card"><h2>Kết quả so sánh</h2><div className="dt-placeholder">Chưa có phép tính. Cần API TCO và hai sản phẩm cùng danh mục để hiển thị tổng tiền, từng khoản và giả định.</div></section></div>;
}

function DevicesPanel() {
  return <div className="dt-stack"><section className="hc-card"><h2>Thiết bị của tôi</h2><div className="dt-placeholder">Chưa có dữ liệu thiết bị từ API. Sau khi đơn hàng hoàn thành, thiết bị sẽ được tạo theo từng chiếc đã mua, kèm SKU, ngày mua và bảo hành.</div></section><section className="hc-card"><h2>Lịch bảo trì</h2><div className="dt-placeholder">Khi đã có thiết bị, lịch vệ sinh, kiểm tra và thay vật tư sẽ xuất hiện ở đây. Người dùng có thể đánh dấu hoàn thành hoặc hoãn theo quy tắc bảo trì.</div></section></div>;
}

// Bản mẫu chỉ phác họa trạng thái giao diện; không ghi dữ liệu hoặc giả lập phản hồi API.
export default function DecisionToolsPage() {
  const [activeTab, setActiveTab] = useState('room');
  const [room, setRoom] = useState({ name: '', placementWidthMm: '', placementDepthMm: '', placementHeightMm: '', doorWidthMm: '', floorAreaM2: '', occupantCount: '', powerAvailable: '', waterSupply: '', drainage: '' });
  useEffect(() => { document.title = 'Không gian và thiết bị · HomeCare'; }, []);
  return <section className="dt-page"><PageHeading eyebrow="Công cụ lựa chọn và chăm sóc" title="Không gian & thiết bị" description="Kiểm tra độ phù hợp, ước tính chi phí sở hữu và theo dõi thiết bị sau mua." /><div className="hc-demo-banner" role="note">Màn hình mẫu để duyệt luồng. Chưa có API hồ sơ phòng, FitCheck, TCO hoặc thiết bị/bảo trì; dữ liệu nhập không được lưu.</div><div className="hc-tabs" aria-label="Công cụ không gian và thiết bị">{tabs.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}><Icon size={16} aria-hidden="true" />{label}</button>)}</div><div>{activeTab === 'room' ? <RoomPanel room={room} setRoom={setRoom} /> : activeTab === 'tco' ? <TcoPanel /> : <DevicesPanel />}</div></section>;
}
