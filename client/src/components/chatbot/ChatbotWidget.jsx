import { Link } from 'react-router-dom';
import { Check, CircleAlert, MessageCircle, Package, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../services/http-client.js';
import { getChatbotQuickQuestions, sendChatbotMessage } from '../../services/chatbot-service.js';
import { useOrderService } from '../../context/OrderServiceContext.jsx';
import './chatbot-preview.css';

const categoryPrompts = ['Tư vấn tủ lạnh', 'Tư vấn máy giặt', 'Tư vấn máy lạnh'];
const compareKeys = ['product', 'with', 'with2', 'with3'];
const initialMessage = { id: 0, role: 'assistant', text: 'Mình gợi ý tủ lạnh, máy giặt, máy lạnh theo ngân sách, thương hiệu và nhu cầu, hoặc trả lời câu hỏi thường gặp.', followUp: 'Bạn đang tìm thiết bị nào, ngân sách khoảng bao nhiêu?' };
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const imageSource = value => !value ? '' : /^https?:\/\//i.test(value) ? value : `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;

// Compare link for 2–4 products of one category; ComparePage reloads price/spec from the catalog API.
export function compareHref(products) {
  const params = new URLSearchParams();
  products.slice(0, 4).forEach((item, index) => params.set(compareKeys[index], item.productId));
  if (products.length > 2) params.set('slots', String(Math.min(products.length, 4)));
  return `/compare?${params}`;
}

// BOT-01..06: rule-based answers from the API; cards only show server price/stock and real routes.
export default function ChatbotWidget() {
  const orderService = useOrderService();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [quickQuestions, setQuickQuestions] = useState([]);
  const [compare, setCompare] = useState({ categoryId: '', items: [] });
  const [cart, setCart] = useState({ pending: '', message: '', error: false });
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const historyRef = useRef(null);
  const nextId = useRef(1);
  const inFlight = useRef(false);
  const quickLoaded = useRef(false);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight; }, [messages, loading, open]);
  useEffect(() => {
    if (!open || quickLoaded.current) return;
    quickLoaded.current = true;
    // Quick FAQ chips are optional; the chat still works when the list cannot load.
    getChatbotQuickQuestions().then(result => setQuickQuestions(result.items || [])).catch(() => { quickLoaded.current = false; });
  }, [open]);

  function closeChat() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  async function send(text) {
    const value = text.trim();
    if (!value || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setDraft('');
    setMessages(current => [...current.slice(-24), { id: nextId.current++, role: 'user', text: value }]);
    try {
      const result = await sendChatbotMessage(value, context);
      setContext(result.context || null);
      setMessages(current => [...current.slice(-24), { id: nextId.current++, role: 'assistant', text: result.reply, followUp: result.followUpQuestion, items: result.recommendations || [], categoryId: result.categoryId || '', faq: result.faq }]);
    } catch (failure) {
      setMessages(current => [...current.slice(-24), { id: nextId.current++, role: 'assistant', text: failure.message || 'Chưa thể trả lời lúc này.', isError: true, retry: value }]);
    } finally { inFlight.current = false; setLoading(false); }
  }

  function toggleCompare(item, categoryId) {
    setCompare(current => {
      // A new category starts a new selection: comparison is only valid within one category.
      const base = current.categoryId === categoryId ? current.items : [];
      if (base.some(selected => selected.productId === item.productId)) return { categoryId, items: base.filter(selected => selected.productId !== item.productId) };
      if (base.length >= 4) return { categoryId, items: base };
      return { categoryId, items: [...base, { productId: item.productId, productName: item.productName }] };
    });
  }

  // The cart API re-checks SKU status and stock; the widget never trusts the stock shown on the card.
  async function addToCart(item) {
    if (cart.pending) return;
    setCart({ pending: item.variantId, message: '', error: false });
    try {
      await orderService.addCartItem(item.variantId, 1);
      setCart({ pending: '', message: `Đã thêm ${item.productName} (${item.sku}) vào giỏ hàng.`, error: false });
    } catch (failure) {
      setCart({ pending: '', message: failure.status === 401 ? 'Hãy đăng nhập tài khoản khách hàng để thêm vào giỏ.' : failure.message || 'Không thể thêm vào giỏ hàng.', error: true, login: failure.status === 401 });
    }
  }

  function submit(event) { event.preventDefault(); send(draft); }

  const selected = compare.items;
  return <div className="hc-chatbot-root">
    <button ref={launcherRef} type="button" className="hc-chatbot-launcher" aria-expanded={open} aria-controls="homecare-chatbot-panel" onClick={() => open ? closeChat() : setOpen(true)}><MessageCircle size={20} aria-hidden="true" /><span>Tư vấn chọn mua</span></button>
    {open && <section id="homecare-chatbot-panel" className="hc-chatbot-panel" aria-label="Tư vấn sản phẩm HomeCare" onKeyDown={event => { if (event.key === 'Escape') closeChat(); }}>
      <header className="hc-chatbot-header"><div><strong>Tư vấn chọn mua</strong><span>Theo quy tắc · dữ liệu catalog hiện tại</span></div><button type="button" aria-label="Đóng hộp thoại" onClick={closeChat}><X size={20} aria-hidden="true" /></button></header>
      <div className="hc-chatbot-history" ref={historyRef} aria-live="polite" aria-relevant="additions text">
        {messages.map(message => <div className={`hc-chatbot-message hc-chatbot-message--${message.role}`} key={message.id}>
          <span className="hc-chatbot-speaker">{message.role === 'assistant' ? 'HomeCare' : 'Bạn'}</span>
          <p>{message.text}</p>
          {message.faq && <small className="hc-chatbot-source">Câu hỏi thường gặp: {message.faq.question}</small>}
          {message.items?.length > 0 && <div className="hc-chatbot-results">{message.items.map(item => {
            const inCompare = compare.categoryId === message.categoryId && selected.some(entry => entry.productId === item.productId);
            return <article className="hc-chatbot-card" key={item.variantId}>
              <Link className="hc-chatbot-product" to={item.href} onClick={closeChat}>
                <span className="hc-chatbot-product__image">{item.imageUrl ? <img src={imageSource(item.imageUrl)} alt="" /> : <Package size={20} aria-hidden="true" />}</span>
                <span className="hc-chatbot-product__details"><strong>{item.productName}</strong><small>{item.brandName} · {item.sku}{item.variantName ? ` · ${item.variantName}` : ''}</small><b>{money(item.currentPrice)}</b></span>
                <span className={`hc-chatbot-stock${item.stockQuantity > 0 ? '' : ' is-empty'}`}>{item.stockQuantity > 0 ? `Còn ${item.stockQuantity}` : 'Hết hàng'}</span>
              </Link>
              <p className="hc-chatbot-why"><Check size={13} aria-hidden="true" /><span>{item.reason}</span></p>
              <p className="hc-chatbot-why hc-chatbot-why--tradeoff"><CircleAlert size={13} aria-hidden="true" /><span>{item.tradeoff}</span></p>
              <div className="hc-chatbot-actions">
                <Link to={item.href} onClick={closeChat}>Xem</Link>
                <button type="button" aria-pressed={inCompare} disabled={!inCompare && compare.categoryId === message.categoryId && selected.length >= 4} onClick={() => toggleCompare(item, message.categoryId)}>{inCompare ? 'Bỏ so sánh' : 'So sánh'}</button>
                <Link to="/customer/decision-tools" onClick={closeChat}>FitCheck</Link>
                <button type="button" disabled={item.stockQuantity < 1 || Boolean(cart.pending)} onClick={() => addToCart(item)}>{cart.pending === item.variantId ? 'Đang thêm…' : 'Thêm giỏ'}</button>
              </div>
            </article>;
          })}</div>}
          {message.followUp && <p className="hc-chatbot-followup">{message.followUp}</p>}
          {message.isError && <><span className="hc-chatbot-error-tag" role="alert">Có lỗi khi xử lý</span> <button type="button" className="hc-chatbot-retry" disabled={loading} onClick={() => send(message.retry)}>Thử lại</button></>}
        </div>)}
        {loading && <div className="hc-chatbot-message hc-chatbot-message--assistant" role="status"><span className="hc-chatbot-speaker">HomeCare</span><p>Đang tra cứu…</p></div>}
      </div>
      {cart.message && <p className={`hc-chatbot-notice${cart.error ? ' is-error' : ''}`} role={cart.error ? 'alert' : 'status'}>{cart.message} {cart.login ? <Link to="/login" onClick={closeChat}>Đăng nhập</Link> : !cart.error && <Link to="/cart" onClick={closeChat}>Xem giỏ</Link>}</p>}
      {selected.length > 0 && <div className="hc-chatbot-compare-bar"><span>Đã chọn {selected.length}/4 để so sánh</span>{selected.length >= 2 ? <Link to={compareHref(selected)} onClick={closeChat}>So sánh ngay</Link> : <small>Chọn thêm ít nhất 1 sản phẩm</small>}<button type="button" onClick={() => setCompare({ categoryId: '', items: [] })}>Bỏ chọn</button></div>}
      <div className="hc-chatbot-input-area"><div className="hc-chatbot-quick-heading">Hỏi nhanh</div><div className="hc-chatbot-quick-list">{[...categoryPrompts, ...quickQuestions.map(item => item.question)].map(query => <button key={query} type="button" disabled={loading} onClick={() => send(query)}>{query}</button>)}</div>
        <form onSubmit={submit}><label className="hc-chatbot-sr-only" htmlFor="chatbot-message">Câu hỏi cho trợ lý</label><input ref={inputRef} id="chatbot-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Ví dụ: máy giặt LG dưới 10 triệu tiết kiệm điện" disabled={loading} /><button type="submit" aria-label="Gửi câu hỏi" disabled={!draft.trim() || loading}><Send size={17} aria-hidden="true" /></button></form>
        <p className="hc-chatbot-disclaimer">Giá và tồn kho là dữ liệu catalog tại thời điểm trả lời, có thể thay đổi trước khi đặt hàng.</p>
      </div>
    </section>}
  </div>;
}
