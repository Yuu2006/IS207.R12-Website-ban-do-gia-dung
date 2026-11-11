import { Link } from 'react-router-dom';
import { MessageCircle, Package, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../services/http-client.js';
import { searchChatbotCatalog } from '../../services/chatbot-service.js';
import './chatbot-preview.css';

const quickSearches = ['Tủ lạnh', 'Máy giặt', 'Máy lạnh'];
const initialMessage = { id: 0, role: 'assistant', text: 'Nhập tên sản phẩm, thương hiệu hoặc SKU để tra thông tin catalog hiện tại.' };
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const imageSource = value => !value ? '' : /^https?:\/\//i.test(value) ? value : `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;

// Catalog lookup assistant; replies only with active SKU, server price, stock and a real detail route.
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const historyRef = useRef(null);
  const nextId = useRef(1);
  const searchInFlight = useRef(false);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight; }, [messages, loading, open]);

  function closeChat() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  async function search(query) {
    const value = query.trim();
    if (!value || searchInFlight.current) return;
    searchInFlight.current = true;
    setLoading(true);
    setDraft('');
    setMessages(current => [...current.slice(-24), { id: nextId.current++, role: 'user', text: value }]);
    try {
      const result = await searchChatbotCatalog(value, { limit: 8 });
      const items = result.items || [];
      setMessages(current => [...current.slice(-24), {
        id: nextId.current++, role: 'assistant',
        text: items.length ? `Tìm thấy ${items.length} SKU phù hợp. Giá và tồn kho được lấy lúc ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.checkedAt))}.` : 'Không tìm thấy SKU phù hợp trong sản phẩm đang bán. Hãy thử tên ngắn hơn, thương hiệu hoặc mã SKU.',
        items, checkedAt: result.checkedAt,
      }]);
    } catch (failure) {
      setMessages(current => [...current.slice(-24), { id: nextId.current++, role: 'assistant', text: failure.message || 'Chưa thể tra cứu catalog. Vui lòng thử lại.', isError: true }]);
    } finally { searchInFlight.current = false; setLoading(false); }
  }

  function submit(event) { event.preventDefault(); search(draft); }

  return <div className="hc-chatbot-root">
    <button ref={launcherRef} type="button" className="hc-chatbot-launcher" aria-expanded={open} aria-controls="homecare-chatbot-panel" onClick={() => open ? closeChat() : setOpen(true)}><MessageCircle size={20} aria-hidden="true" /><span>Tư vấn chọn mua</span></button>
    {open && <section id="homecare-chatbot-panel" className="hc-chatbot-panel" aria-label="Tra cứu sản phẩm HomeCare" onKeyDown={event => { if (event.key === 'Escape') closeChat(); }}>
      <header className="hc-chatbot-header"><div><strong>Tra cứu sản phẩm</strong><span>Tên sản phẩm · thương hiệu · SKU</span></div><button type="button" aria-label="Đóng hộp thoại" onClick={closeChat}><X size={20} aria-hidden="true" /></button></header>
      <div className="hc-chatbot-history" ref={historyRef} aria-live="polite" aria-relevant="additions text">
        {messages.map(message => <div className={`hc-chatbot-message hc-chatbot-message--${message.role}`} key={message.id}>
          <span className="hc-chatbot-speaker">{message.role === 'assistant' ? 'HomeCare' : 'Bạn'}</span>
          <p>{message.text}</p>
          {message.items?.length > 0 && <div className="hc-chatbot-results">{message.items.map(item => <Link className="hc-chatbot-product" key={item.variantId} to={item.href} onClick={closeChat}>
            <span className="hc-chatbot-product__image">{item.imageUrl ? <img src={imageSource(item.imageUrl)} alt="" /> : <Package size={20} aria-hidden="true" />}</span>
            <span className="hc-chatbot-product__details"><strong>{item.productName}</strong><small>{item.brandName} · {item.sku}{item.variantName ? ` · ${item.variantName}` : ''}</small><b>{money(item.currentPrice)}</b></span>
            <span className={`hc-chatbot-stock${item.stockQuantity > 0 ? '' : ' is-empty'}`}>{item.stockQuantity > 0 ? `Còn ${item.stockQuantity}` : 'Hết hàng'}</span>
          </Link>)}</div>}
          {message.isError && <span className="hc-chatbot-error-tag" role="alert">Có lỗi khi tra cứu</span>}
        </div>)}
        {loading && <div className="hc-chatbot-message hc-chatbot-message--assistant" role="status"><span className="hc-chatbot-speaker">HomeCare</span><p>Đang tra cứu catalog…</p></div>}
      </div>
      <div className="hc-chatbot-input-area"><div className="hc-chatbot-quick-heading">Tìm nhanh</div><div className="hc-chatbot-quick-list">{quickSearches.map(query => <button key={query} type="button" disabled={loading} onClick={() => search(query)}>{query}</button>)}</div>
        <form onSubmit={submit}><label className="hc-chatbot-sr-only" htmlFor="chatbot-message">Tìm tên sản phẩm, thương hiệu hoặc SKU</label><input ref={inputRef} id="chatbot-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={100} placeholder="Ví dụ: máy giặt LG, SKU…" disabled={loading} /><button type="submit" aria-label="Tìm sản phẩm" disabled={!draft.trim() || loading}><Send size={17} aria-hidden="true" /></button></form>
        <p className="hc-chatbot-disclaimer">Giá và tồn kho là dữ liệu catalog tại thời điểm tra cứu, có thể thay đổi trước khi đặt hàng.</p>
      </div>
    </section>}
  </div>;
}
