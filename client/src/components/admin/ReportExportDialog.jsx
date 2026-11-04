import { ChevronLeft, Download } from 'lucide-react';
import { useId, useState } from 'react';
import Modal from './Modal.jsx';
import { AdminField } from './SimpleCrud.jsx';

const periods = [['7', '7 ngày'], ['28', '28 ngày'], ['quarter', 'Quý này'], ['custom', 'Tùy chọn']];
const sections = [['kpi', 'Chỉ số tổng hợp'], ['weeks', 'Doanh thu theo tuần'], ['cats', 'Cơ cấu theo danh mục'], ['top', 'Sản phẩm bán chạy nhất']];
const papers = ['A4', 'A3', 'Letter'];
const slug = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Hộp thoại "Xuất báo cáo PDF" theo template (kèm xem trước). Đặc tả chỉ có CSV và API báo cáo chưa có,
// nên bố cục dựng đủ nhưng mọi nút xuất bị khóa, trang xem trước không chứa số liệu.
export default function ReportExportDialog({ initialPeriod = '28', onClose }) {
  const uid = useId();
  const [values, setValues] = useState({ title: 'Báo cáo doanh thu', period: initialPeriod, from: '', to: '', sections: sections.map(([key]) => key), paper: 'A4', landscape: false, footer: true });
  const [preview, setPreview] = useState(false);
  const set = (name, value) => setValues(current => ({ ...current, [name]: value }));
  const rangeError = values.period === 'custom' && values.from && values.to && values.to < values.from ? 'Ngày kết thúc phải sau ngày bắt đầu.' : '';
  const fileName = `${slug(values.title) || 'bao-cao'}.pdf`;
  const periodLabel = periods.find(([key]) => key === values.period)[1];
  const orientation = values.landscape ? 'Ngang' : 'Dọc';
  const toggleSection = key => set('sections', values.sections.includes(key) ? values.sections.filter(item => item !== key) : [...values.sections, key]);
  const today = new Date().toLocaleDateString('vi-VN');

  if (preview) return <Modal bare className="ad-pv" title="Xem trước báo cáo PDF" onClose={() => setPreview(false)}>
    <div className="ad-pv-bar">
      <button className="hc-button hc-button--outline hc-icon-btn" type="button" aria-label="Quay lại" onClick={() => setPreview(false)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <div><b>{fileName}</b><span>{values.paper} · {orientation}</span></div>
      <button className="hc-button hc-button--outline" type="button" disabled title="Chưa triển khai">In</button>
      <button className="hc-button" type="button" disabled title="Chưa triển khai"><Download size={18} aria-hidden="true" />Tải PDF</button>
    </div>
    <div className="ad-pv-wrap"><article className="ad-pv-page" aria-label="Trang xem trước, chưa có dữ liệu">
      <header><div><span className="eyebrow">BÁO CÁO · HOMECARE</span><h1>{values.title || 'Báo cáo'}</h1></div><div className="meta">Kỳ báo cáo: {periodLabel}<br />Ngày xuất: {today}</div></header>
      {sections.filter(([key]) => values.sections.includes(key)).map(([key, label]) => <section key={key}><h3>{label}</h3><p className="hc-muted">Chưa có dữ liệu: cần API báo cáo.</p></section>)}
      {values.footer && <footer><span>HomeCare · Báo cáo nội bộ</span><span>Trang 1/1 · {today}</span></footer>}
    </article></div>
  </Modal>;

  return <Modal wide title="Xuất báo cáo PDF" description="Chọn kỳ báo cáo, nội dung và định dạng trang." onClose={onClose}>
    <form className="hc-form" noValidate onSubmit={event => event.preventDefault()}>
      <p className="hc-note" role="note"><span className="hc-soon">Chưa triển khai</span> API báo cáo chưa có và đặc tả MVP chỉ yêu cầu CSV nên chưa xuất được tệp. Bố cục chỉ để xem trước.</p>
      <AdminField field={{ id: `${uid}-title`, name: 'title', label: 'Tiêu đề báo cáo', required: true, maxLength: 150 }} value={values.title} onChange={value => set('title', value)} />
      <fieldset className="hc-fieldset"><legend>Kỳ báo cáo <span aria-hidden="true">*</span></legend>
        <div className="hc-seg-row">{periods.map(([key, label]) => <label className="hc-seg" key={key}><input type="radio" name={`${uid}-period`} value={key} checked={values.period === key} onChange={() => set('period', key)} />{label}</label>)}</div></fieldset>
      {values.period === 'custom' && <div className="hc-form-grid">
        <AdminField field={{ id: `${uid}-from`, name: 'from', label: 'Từ ngày', type: 'date' }} value={values.from} onChange={value => set('from', value)} />
        <AdminField field={{ id: `${uid}-to`, name: 'to', label: 'Đến ngày', type: 'date' }} value={values.to} error={rangeError} onChange={value => set('to', value)} />
      </div>}
      <fieldset className="hc-fieldset"><legend>Nội dung đưa vào báo cáo</legend>
        <div className="ad-checks hc-subform">{sections.map(([key, label]) => <label className="hc-check" key={key}><input type="checkbox" checked={values.sections.includes(key)} onChange={() => toggleSection(key)} />{label}</label>)}</div></fieldset>
      <div className="hc-form-grid">
        <AdminField field={{ id: `${uid}-paper`, name: 'paper', label: 'Khổ giấy', type: 'select', options: papers.map(item => [item, item]) }} value={values.paper} onChange={value => set('paper', value || 'A4')} />
        <fieldset className="hc-fieldset"><legend>Hướng trang</legend><div className="hc-seg-row">{[[false, 'Dọc'], [true, 'Ngang']].map(([landscape, label]) => <label className="hc-seg" key={label}><input type="radio" name={`${uid}-orient`} checked={values.landscape === landscape} onChange={() => set('landscape', landscape)} />{label}</label>)}</div></fieldset>
      </div>
      <label className="hc-check"><input type="checkbox" checked={values.footer} onChange={event => set('footer', event.target.checked)} />Hiển thị số trang và ngày xuất ở chân trang</label>
      <div className="hc-form-footer"><span className="hc-muted">Tên tệp: {fileName}</span><span className="hc-actions">
        <button className="hc-button hc-button--outline" type="button" onClick={onClose}>Hủy</button>
        <button className="hc-button hc-button--outline" type="button" onClick={() => setPreview(true)}>Xem trước</button>
        <button className="hc-button" type="submit" disabled aria-disabled="true">Chưa triển khai</button>
      </span></div>
    </form>
  </Modal>;
}
