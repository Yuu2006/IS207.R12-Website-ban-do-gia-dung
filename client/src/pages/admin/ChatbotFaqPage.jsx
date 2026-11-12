import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, X } from 'lucide-react';
import { PageHead } from '../../components/admin/ui.jsx';
import { createChatbotFaq, listChatbotFaqs, updateChatbotFaq } from '../../services/chatbot-service.js';
import '../customer/care-pages.css';

const statusLabels = { DRAFT: 'Bản nháp', ACTIVE: 'Đang trả lời', INACTIVE: 'Tạm ngưng' };
const emptyForm = () => ({ question: '', answer: '', keywords: '', status: 'DRAFT', sortOrder: '0' });

// BOT-05 / ADM-BOT: ADMIN approves FAQ/policy answers; only ACTIVE rows reach customers, as plain text.
export default function ChatbotFaqPage() {
  const [faqs, setFaqs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setFaqs((await listChatbotFaqs()).items || []); }
    catch (failure) { setError(failure.message || 'Chưa thể tải FAQ. Kiểm tra migration 018 và API rồi thử lại.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { document.title = 'FAQ chatbot · HomeCare'; load(); }, [load]);

  const update = (name, value) => setForm(current => ({ ...current, [name]: value }));
  function reset() { setEditing(null); setForm(emptyForm()); setFieldErrors({}); }
  function startEdit(faq) {
    setEditing(faq);
    setForm({ question: faq.question, answer: faq.answer, keywords: faq.keywords, status: faq.status, sortOrder: String(faq.sortOrder) });
    setNotice(''); setError(''); setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice(''); setFieldErrors({});
    const payload = { question: form.question.trim(), answer: form.answer.trim(), keywords: form.keywords.trim(), status: form.status, sortOrder: Number(form.sortOrder) };
    try {
      if (editing) await updateChatbotFaq(editing.id, { ...payload, expectedVersion: editing.version });
      else await createChatbotFaq(payload);
      setNotice(editing ? 'Đã cập nhật câu hỏi thường gặp.' : 'Đã tạo câu hỏi thường gặp.');
      reset();
      await load();
    } catch (failure) {
      setError(failure.message || 'Chưa thể lưu FAQ.');
      setFieldErrors(failure.errors || {});
    } finally { setSaving(false); }
  }

  const fieldError = name => typeof fieldErrors[name] === 'string' ? <small className="hc-error">{fieldErrors[name]}</small> : null;
  return <section className="dt-page care-page">
    <PageHead title="FAQ chatbot" subtitle="Câu trả lời chính sách do quản trị viên duyệt. Chatbot chỉ dùng FAQ đang trả lời, không tự suy diễn cam kết giao hàng, đổi trả hay bảo hành." />
    {notice && <p className="care-notice" role="status">{notice}</p>}
    {error && <div className="care-error" role="alert"><span>{error}</span><button type="button" onClick={load}>Thử lại</button></div>}
    <div className="care-admin-layout">
      <form className="hc-card care-admin-form" onSubmit={save}>
        <h2>{editing ? 'Chỉnh sửa FAQ' : 'Thêm FAQ'}</h2>
        <div className="hc-field"><label htmlFor="faq-question">Câu hỏi *</label><input id="faq-question" value={form.question} maxLength={200} onChange={event => update('question', event.target.value)} required />{fieldError('question')}</div>
        <div className="hc-field"><label htmlFor="faq-answer">Câu trả lời đã duyệt *</label><textarea id="faq-answer" value={form.answer} maxLength={2000} onChange={event => update('answer', event.target.value)} required />{fieldError('answer')}</div>
        <div className="hc-field"><label htmlFor="faq-keywords">Từ khóa nhận diện *</label><input id="faq-keywords" value={form.keywords} maxLength={500} onChange={event => update('keywords', event.target.value)} placeholder="đổi trả, trả hàng, hoàn tiền" required /><small>1–20 từ khóa cách nhau bằng dấu phẩy; khớp cả khi khách gõ không dấu.</small>{fieldError('keywords')}</div>
        <div className="hc-form-grid">
          <div className="hc-field"><label htmlFor="faq-status">Trạng thái</label><select id="faq-status" value={form.status} onChange={event => update('status', event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="hc-field"><label htmlFor="faq-order">Thứ tự hiển thị</label><input id="faq-order" type="number" min="0" max="1000" value={form.sortOrder} onChange={event => update('sortOrder', event.target.value)} />{fieldError('sortOrder')}</div>
        </div>
        <div className="care-admin-form__actions"><button type="submit" className="care-button" disabled={saving || loading}><Save size={16} aria-hidden="true" />{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo FAQ'}</button>{editing ? <button type="button" className="care-button care-button--quiet" onClick={reset}><X size={16} aria-hidden="true" />Hủy sửa</button> : <button type="button" className="care-button care-button--quiet" onClick={reset}><Plus size={16} aria-hidden="true" />Làm trống</button>}</div>
      </form>
      <section className="care-rule-list" aria-label="Danh sách FAQ">
        <div className="care-toolbar"><h2>FAQ hiện có</h2><button type="button" className="care-button care-button--quiet" onClick={load} disabled={loading}><RefreshCw size={15} aria-hidden="true" />Làm mới</button></div>
        {loading ? <div className="hc-card care-loading" role="status">Đang tải FAQ…</div> : faqs.length ? faqs.map(faq => <article className="care-rule" key={faq.id}>
          <div className="care-rule__head"><div><h3>{faq.question}</h3><p>Từ khóa: {faq.keywords}</p><p>Cập nhật bởi {faq.updatedBy} · {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(faq.updatedAt))} · phiên bản {faq.version}</p></div><span className={`care-rule__status${faq.status === 'ACTIVE' ? '' : ' care-rule__status--inactive'}`}>{statusLabels[faq.status]}</span></div>
          <p>{faq.answer}</p>
          <button type="button" className="care-button care-button--quiet" onClick={() => startEdit(faq)}><Pencil size={15} aria-hidden="true" />Chỉnh sửa</button>
        </article>) : <div className="hc-card care-empty"><h2>Chưa có FAQ</h2><p>Tạo câu hỏi thường gặp với nội dung chính sách đã được nhóm xác nhận; chỉ FAQ “Đang trả lời” được chatbot dùng.</p></div>}
      </section>
    </div>
  </section>;
}
