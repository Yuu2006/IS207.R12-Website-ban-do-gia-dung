import { useEffect, useState } from 'react';
import { API_URL } from '../../services/http-client.js';
import { useAuth } from '../../context/auth-context.js';
import { listEligibleReviews, listProductReviews, submitReview, submitReviewFollowup, uploadReviewPhoto } from '../../services/review-service.js';
import './product-reviews.css';

const contextFields = [
  ['roomAreaM2', 'Diện tích phòng (m²)', 'number'],
  ['householdSize', 'Số người trong gia đình', 'number'],
  ['usageFrequency', 'Tần suất sử dụng', [['RARELY', 'Hiếm khi'], ['FEW_TIMES_WEEK', 'Vài lần mỗi tuần'], ['DAILY', 'Hằng ngày'], ['MULTIPLE_DAILY', 'Nhiều lần mỗi ngày']]],
  ['noisePerception', 'Cảm nhận độ ồn', [['QUIET', 'Êm'], ['ACCEPTABLE', 'Chấp nhận được'], ['NOISY', 'Ồn'], ['VERY_NOISY', 'Rất ồn']]],
  ['consumptionPerception', 'Cảm nhận mức tiêu thụ', [['LOWER_THAN_EXPECTED', 'Thấp hơn mong đợi'], ['AS_EXPECTED', 'Đúng như mong đợi'], ['HIGHER_THAN_EXPECTED', 'Cao hơn mong đợi'], ['UNKNOWN', 'Chưa xác định']]],
  ['cleaningEase', 'Vệ sinh sản phẩm', [['EASY', 'Dễ'], ['ACCEPTABLE', 'Bình thường'], ['DIFFICULT', 'Khó'], ['NOT_APPLICABLE', 'Không áp dụng']]],
];
const blankContext = () => Object.fromEntries(contextFields.map(([key]) => [key, '']));
const contextLabels = Object.fromEntries(contextFields.map(([key, label]) => [key, label]));
const optionLabels = Object.fromEntries(contextFields.flatMap(([key, , options]) => Array.isArray(options) ? options.map(([value, label]) => [`${key}:${value}`, label]) : []));

function normalizedContext(context) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, value === '' ? null : key === 'roomAreaM2' ? Number(value) : key === 'householdSize' ? Number.parseInt(value, 10) : value]));
}

function displayContext(context) {
  if (!context) return null;
  const values = Object.entries(context).filter(([, value]) => value !== null && value !== '' && value !== undefined);
  if (!values.length) return null;
  return <dl className="pr-context">{values.map(([key, value]) => <div key={key}><dt>{contextLabels[key] || key}</dt><dd>{optionLabels[`${key}:${value}`] || (key === 'roomAreaM2' ? `${value} m²` : value)}</dd></div>)}</dl>;
}

function ContextFields({ value, onChange, required = false }) {
  return <div className="pr-context-form">
    {contextFields.map(([key, label, type]) => <label key={key}>
      {label}{required ? ' *' : ''}
      {Array.isArray(type) ? <select required={required} value={value[key]} onChange={event => onChange(key, event.target.value)}>
        <option value="">{required ? 'Chọn một mục' : 'Chưa chia sẻ'}</option>{type.map(([option, text]) => <option value={option} key={option}>{text}</option>)}
      </select> : <input required={required} type="number" min={key === 'roomAreaM2' ? '0.1' : '1'} max={key === 'roomAreaM2' ? '1000' : '30'} step={key === 'roomAreaM2' ? '0.1' : '1'} value={value[key]} onChange={event => onChange(key, event.target.value)} placeholder="Chưa chia sẻ" />}
    </label>)}
  </div>;
}

function ReviewComposer({ item, maxImages, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [context, setContext] = useState(blankContext());
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const photos = await Promise.all(files.map(uploadReviewPhoto));
      await submitReview({ orderItemId: item.orderItemId, rating, content, photos, context: normalizedContext(context) });
      onSubmitted();
    } catch (failure) { setError(failure.message || 'Chưa thể gửi đánh giá.'); }
    finally { setBusy(false); }
  }
  return <details className="pr-composer"><summary>Đánh giá sản phẩm này</summary>
    <form onSubmit={send}>
      <p className="pr-order">Đơn {item.orderCode} · {item.sku} · đã hoàn tất {new Date(`${item.completedAt.replace(' ', 'T')}Z`).toLocaleDateString('vi-VN')}</p>
      <label>Điểm đánh giá<select required value={rating} onChange={event => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} sao</option>)}</select></label>
      <label>Nội dung<textarea required minLength={1} maxLength={3000} value={content} onChange={event => setContent(event.target.value)} placeholder="Chia sẻ trải nghiệm sử dụng" /></label>
      <details><summary>Chia sẻ thêm về bối cảnh sử dụng (không bắt buộc)</summary><ContextFields value={context} onChange={(key, value) => setContext(current => ({ ...current, [key]: value }))} /></details>
      {maxImages > 0 && <label>Ảnh trải nghiệm (tối đa {maxImages})<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { const next = Array.from(event.target.files || []).slice(0, maxImages); setFiles(next); event.target.value = ''; }} />
        {files.length > 0 && <small>{files.map(file => file.name).join(', ')}</small>}</label>}
      {error && <p className="pr-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
    </form>
  </details>;
}

function FollowupComposer({ item, milestoneDays, onSubmitted }) {
  const [context, setContext] = useState(blankContext());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await submitReviewFollowup(item.reviewId, { milestoneDays, context: normalizedContext(context) }); onSubmitted(); }
    catch (failure) { setError(failure.message || 'Chưa thể gửi cập nhật.'); }
    finally { setBusy(false); }
  }
  return <details className="pr-composer pr-followup"><summary>Cập nhật trải nghiệm sau {milestoneDays} ngày</summary>
    <form onSubmit={send}><p>Thông tin này bổ sung bối cảnh sử dụng cho đánh giá trước đó; không thay đổi điểm hoặc nội dung ban đầu.</p>
      <ContextFields required value={context} onChange={(key, value) => setContext(current => ({ ...current, [key]: value }))} />
      {error && <p className="pr-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi cập nhật'}</button>
    </form>
  </details>;
}

function ReviewCard({ review }) {
  const created = new Date(`${String(review.created_at).replace(' ', 'T')}Z`);
  return <article className="pr-review">
    <header><span className="pr-stars" aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(Number(review.rating))}{'☆'.repeat(5 - Number(review.rating))}</span><span>Đã mua hàng · {Number.isNaN(created.getTime()) ? '' : created.toLocaleDateString('vi-VN')}</span></header>
    <p className="pr-product-name">{review.product_name}</p><p>{review.content}</p>
    {displayContext({ roomAreaM2: review.room_area_m2, householdSize: review.household_size, usageFrequency: review.usage_frequency, noisePerception: review.noise_perception, consumptionPerception: review.consumption_perception, cleaningEase: review.cleaning_ease })}
    {review.photos?.length > 0 && <div className="pr-photos">{review.photos.map(photo => <img key={photo} src={photo.startsWith('http') ? photo : `${API_URL}${photo}`} alt="Ảnh khách hàng đính kèm" loading="lazy" />)}</div>}
    {review.followups?.map(entry => <section className="pr-followup-note" key={entry.milestoneDays}><b>Cập nhật sau {entry.milestoneDays} ngày</b>{displayContext(entry.context)}</section>)}
  </article>;
}

export default function ProductReviews({ productId, productName }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ rating: '', usageFrequency: '', noisePerception: '', consumptionPerception: '', cleaningEase: '' });
  const [reviews, setReviews] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [maxImages, setMaxImages] = useState(5);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true; setReviews(null); setError('');
    listProductReviews(productId, filters).then(data => { if (active) setReviews(data); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [productId, filters, reload]);
  useEffect(() => {
    let active = true;
    if (user?.role !== 'CUSTOMER') { setEligible([]); return undefined; }
    listEligibleReviews(productId).then(data => { if (active) { setEligible(data.items || []); setMaxImages(data.maxImages || 0); } }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [productId, user?.id, user?.role, reload]);
  const refresh = () => setReload(value => value + 1);
  return <section className="pr-section" aria-labelledby="pr-title">
    <div className="pr-heading"><div><span className="hc-eyebrow">Trải nghiệm thực tế</span><h2 id="pr-title">Đánh giá sản phẩm</h2><p>{productName}</p></div><span className="pr-total">{reviews?.pagination?.total ?? '…'} đánh giá</span></div>
    {user?.role === 'CUSTOMER' && <div className="pr-eligible"><h3>Đơn hàng đủ điều kiện đánh giá hoặc cập nhật</h3>
      {eligible.length === 0 ? <p>Chưa có đơn hàng hoàn tất cho sản phẩm này.</p> : eligible.map(item => <div className="pr-eligible-item" key={item.orderItemId}>
        <b>{item.product_name} · {item.sku}</b>
        {!item.reviewId && <ReviewComposer item={item} maxImages={maxImages} onSubmitted={refresh} />}
        {item.reviewId && item.followupDays.map(days => <FollowupComposer key={days} item={item} milestoneDays={days} onSubmitted={refresh} />)}
        {item.reviewId && item.followupDays.length === 0 && <small>Đã gửi đánh giá; cập nhật REV-03 sẽ mở theo mốc 30/90 ngày.</small>}
      </div>)}</div>}
    <div className="pr-filters" aria-label="Lọc đánh giá">
      <label>Điểm<select value={filters.rating} onChange={event => setFilters(value => ({ ...value, rating: event.target.value }))}><option value="">Mọi mức điểm</option>{[5, 4, 3, 2, 1].map(value => <option value={value} key={value}>{value} sao</option>)}</select></label>
      {contextFields.slice(2).map(([key, label, options]) => <label key={key}>{label}<select value={filters[key]} onChange={event => setFilters(value => ({ ...value, [key]: event.target.value }))}><option value="">Tất cả</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>)}
    </div>
    {error && <p className="pr-error" role="alert">{error} <button type="button" onClick={refresh}>Tải lại</button></p>}
    {reviews === null && !error ? <p role="status">Đang tải đánh giá…</p> : reviews?.items?.length ? <div className="pr-list">{reviews.items.map(review => <ReviewCard review={review} key={review.id} />)}</div> : <p className="pr-empty">Chưa có đánh giá phù hợp.</p>}
  </section>;
}
