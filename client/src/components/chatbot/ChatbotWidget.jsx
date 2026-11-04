import { MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ComparisonPreview from './ComparisonPreview.jsx';
import './chatbot-preview.css';

const firstMessage = {
  id: 0,
  role: 'assistant',
  text: 'Tôi có thể giúp bạn xem cách hỏi giá hoặc so sánh sản phẩm. Bạn đang quan tâm sản phẩm nào?',
};

const sessionKey = 'homecare-chatbot-preview-messages';

function restoreMessages() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey));
    if (Array.isArray(saved) && saved.length > 0 && saved.every(message => Number.isSafeInteger(message.id) && message.id >= 0 && ['assistant', 'user'].includes(message.role) && typeof message.text === 'string' && message.text.length <= 1000)) return saved.slice(-40);
  } catch { /* Session storage can be unavailable; the in-memory conversation still works. */ }
  return [firstMessage];
}

const quickQuestions = [
  {
    id: 'price', label: 'Hỏi giá', prompt: 'Giá sản phẩm này bao nhiêu?',
    reply: 'Để báo đúng giá, tôi cần biết sản phẩm và SKU bạn chọn. Bản mẫu chưa lấy giá từ catalog. Bạn muốn xem giá của sản phẩm nào?',
  },
  {
    id: 'compare', label: 'So sánh sản phẩm', prompt: 'So sánh các sản phẩm giúp tôi',
    reply: 'Bạn có thể chọn 2–4 sản phẩm cùng loại ở bảng mẫu bên dưới. Khi chưa nêu tiêu chí, tôi sẽ so sánh giá, thông số hiệu năng và nhu cầu sử dụng. Bạn muốn xem kỹ tiêu chí nào?',
    comparisonScope: 'default',
  },
  {
    id: 'compare-price', label: 'Chỉ so sánh giá', prompt: 'Chỉ so sánh giá các sản phẩm',
    reply: 'Bảng mẫu bên dưới chỉ hiển thị giá của các sản phẩm cùng loại. Bạn muốn hỏi thêm về tiêu chí nào?',
    comparisonScope: 'price',
  },
];

// Bản mẫu không phân tích ý định từ tin nhắn tự do và không gọi chatbot hoặc catalog API.
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(restoreMessages);
  const [draft, setDraft] = useState('');
  const [comparisonScope, setComparisonScope] = useState(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const historyRef = useRef(null);
  const latestReplyRef = useRef(null);
  const nextMessageIdRef = useRef(Math.max(...messages.map(message => message.id)) + 1);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const history = historyRef.current;
    if (!open || !history) return;
    if (comparisonScope && latestReplyRef.current) {
      history.scrollTop += latestReplyRef.current.getBoundingClientRect().top - history.getBoundingClientRect().top - 8;
    } else {
      history.scrollTop = history.scrollHeight;
    }
  }, [messages, open, comparisonScope]);
  useEffect(() => { try { sessionStorage.setItem(sessionKey, JSON.stringify(messages.slice(-40))); } catch { /* Keep the current tab usable without storage. */ } }, [messages]);

  function closeChat() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function appendExchange(question, reply) {
    const userId = nextMessageIdRef.current++;
    const assistantId = nextMessageIdRef.current++;
    setMessages(current => [...current.slice(-38), { id: userId, role: 'user', text: question }, { id: assistantId, role: 'assistant', text: reply }]);
  }

  function askQuickQuestion(question) {
    appendExchange(question.prompt, question.reply);
    setComparisonScope(question.comparisonScope || null);
  }

  function sendDraft(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    appendExchange(question, 'Đây là bản mẫu giao diện nên tôi chưa thể xử lý câu hỏi tự nhập hoặc tra dữ liệu sản phẩm. Bạn muốn thử hỏi về giá hay so sánh sản phẩm nào?');
    setDraft('');
    setComparisonScope(null);
  }

  return <div className="hc-chatbot-root"><button ref={launcherRef} type="button" className="hc-chatbot-launcher" aria-expanded={open} aria-controls="homecare-chatbot-panel" onClick={() => open ? closeChat() : setOpen(true)}><MessageCircle size={20} aria-hidden="true" /><span>Tư vấn chọn mua</span></button>
    {open && <section id="homecare-chatbot-panel" className="hc-chatbot-panel" aria-label="Trợ lý chọn mua - bản mẫu" onKeyDown={event => { if (event.key === 'Escape') closeChat(); }}>
      <header className="hc-chatbot-header"><div><strong>Trợ lý chọn mua</strong><span>Bản mẫu giao diện · chưa kết nối API</span></div><button type="button" aria-label="Đóng hộp thoại" onClick={closeChat}><X size={20} aria-hidden="true" /></button></header>
      <div className="hc-chatbot-history" ref={historyRef} aria-live="polite" aria-relevant="additions text">{messages.map((message, index) => <div className={`hc-chatbot-message hc-chatbot-message--${message.role}`} key={message.id} ref={index === messages.length - 1 && message.role === 'assistant' ? latestReplyRef : null}><span className="hc-chatbot-speaker">{message.role === 'assistant' ? 'HomeCare' : 'Bạn'}</span><p>{message.text}</p></div>)}{comparisonScope && <ComparisonPreview key={comparisonScope} initialScope={comparisonScope} />}</div>
      <div className="hc-chatbot-input-area"><div className="hc-chatbot-quick-heading">Câu hỏi thường gặp</div><div className="hc-chatbot-quick-list">{quickQuestions.map(question => <button key={question.id} type="button" onClick={() => askQuickQuestion(question)}>{question.label}</button>)}</div><form onSubmit={sendDraft}><label className="hc-chatbot-sr-only" htmlFor="chatbot-message">Nhập câu hỏi</label><input ref={inputRef} id="chatbot-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Nhập câu hỏi của bạn…" /><button type="submit" aria-label="Gửi câu hỏi" disabled={!draft.trim()}><Send size={17} aria-hidden="true" /></button></form><p className="hc-chatbot-disclaimer">Tin nhắn tự nhập chưa được xử lý. Bản mẫu chỉ phản hồi các câu hỏi có sẵn; không cung cấp báo giá thật.</p></div>
    </section>}
  </div>;
}
