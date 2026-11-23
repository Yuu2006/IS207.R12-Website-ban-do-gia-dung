import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, House, PackageCheck } from 'lucide-react';
import AnimatedTabs from '../../components/common/AnimatedTabs.jsx';
import RoomFitPanel from './RoomFitPanel.jsx';
import TcoComparison from '../../components/decision/TcoComparison.jsx';
import './decision-tools.css';

const tabs = [
  ['room', 'Không gian & FitCheck', House],
  ['tco', 'Chi phí sở hữu', Calculator],
  ['devices', 'Thiết bị & bảo trì', PackageCheck],
];
const tabOptions = tabs.map(([value, label, icon]) => ({ value, label, icon }));

function PageHeading({ eyebrow, title, description }) {
  return <div className="hc-page-heading"><span className="hc-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}


function DevicesPanel() {
  return <section className="hc-card"><h2>Thiết bị của tôi</h2><p className="dt-note">Theo dõi thiết bị được ghi nhận từ đơn hàng đã hoàn tất, thời hạn bảo hành và lịch chăm sóc. Bạn có thể cập nhật số serial, hoàn thành hoặc hoãn mốc bảo trì.</p><Link className="hc-button" to="/customer/devices">Mở thiết bị của tôi</Link></section>;
}

// Each tab owns its API service layer; no tab fabricates a server response.
export default function DecisionToolsPage() {
  const [activeTab, setActiveTab] = useState('room');
  useEffect(() => { document.title = 'Không gian và thiết bị · HomeCare'; }, []);
  return <section className="dt-page"><PageHeading eyebrow="Công cụ lựa chọn và chăm sóc" title="Không gian & thiết bị" description="Kiểm tra độ phù hợp, ước tính chi phí sở hữu và theo dõi thiết bị sau mua." />
    <AnimatedTabs className="dt-tabs" options={tabOptions} value={activeTab} onChange={setActiveTab} label="Công cụ không gian và thiết bị" idPrefix="decision-tool-tab" panelId="decision-tool-panel" />
    <div id="decision-tool-panel" key={activeTab} className="hc-tab-content" role="tabpanel" aria-labelledby={`decision-tool-tab-${activeTab}`}>
      {activeTab === 'room' ? <RoomFitPanel /> : activeTab === 'tco' ? <TcoComparison /> : <DevicesPanel />}
    </div>
  </section>;
}
