import { useEffect, useState } from 'react';
import { PageHead } from '../../components/admin/ui.jsx';
import { listAdminReviews, setReviewVisibility } from '../../services/review-service.js';
import '../../components/reviews/product-reviews.css';

// REV-01: ADMIN may hide/restore a review with an audit reason; customer content has no edit control.
export default function ReviewModerationPage() {
  const [visibility, setVisibility] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { document.title = 'Đánh giá · HomeCare'; }, []);
  useEffect(() => {
    let active = true; setResult(null); setError('');
    listAdminReviews({ visibility, rating, page, pageSize: 20 }).then(data => { if (active) setResult(data); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [visibility, rating, page, reload]);
  async function toggle(review) {
    const reason = (reasons[review.id] || '').trim();
    if (reason.length < 3) { setError('Nhập lý do ít nhất 3 ký tự trước khi ẩn hoặc khôi phục.'); return; }
    setBusyId(review.id); setError(''); setNotice('');
    try {
      await setReviewVisibility(review.id, { isVisible: !review.isVisible, reason });
      setNotice(review.isVisible ? 'Đã ẩn đánh giá và ghi nhật ký kiểm duyệt.' : 'Đã khôi phục đánh giá.');
      setReasons(current => ({ ...current, [review.id]: '' })); setReload(value => value + 1);
    } catch (failure) { setError(failure.message || 'Không thể cập nhật trạng thái đánh giá.'); }
    finally { setBusyId(null); }
  }
  return <section>
    <PageHead title="Kiểm duyệt đánh giá" subtitle="ADMIN chỉ được ẩn hoặc khôi phục; nội dung của khách hàng được giữ nguyên." />
    {notice && <p className="hc-success" role="status">{notice}</p>}
    {error && <p className="hc-error" role="alert">{error} <button className="hc-button hc-button--outline" type="button" onClick={() => setReload(value => value + 1)}>Tải lại</button></p>}
    <div className="pr-admin-filter" role="search" aria-label="Lọc đánh giá">
      <label>Trạng thái<select value={visibility} onChange={event => { setVisibility(event.target.value); setPage(1); }}><option value="">Tất cả</option><option value="visible">Đang hiển thị</option><option value="hidden">Đã ẩn</option></select></label>
      <label>Điểm<select value={rating} onChange={event => { setRating(event.target.value); setPage(1); }}><option value="">Mọi mức điểm</option>{[5, 4, 3, 2, 1].map(value => <option value={value} key={value}>{value} sao</option>)}</select></label>
    </div>
    {result === null && !error ? <p role="status">Đang tải đánh giá…</p> : <div className="pr-list">
      {result?.items?.length ? result.items.map(review => <article className="pr-admin-card" key={review.id}>
        <header><b>{review.product_name} · {review.sku}</b><span className={review.isVisible ? 'hc-badge hc-badge--in' : 'hc-badge hc-badge--out'}>{review.isVisible ? 'Đang hiển thị' : 'Đã ẩn'}</span></header>
        <p><span className="pr-stars" aria-label={`${review.rating} sao`}>{'★'.repeat(Number(review.rating))}{'☆'.repeat(5 - Number(review.rating))}</span></p>
        <p>{review.content}</p>
        {review.photos?.length > 0 && <div className="pr-photos">{review.photos.map(photo => <img className="pr-admin-photo" key={photo} src={photo.startsWith('http') ? photo : `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${photo}`} alt="Ảnh khách hàng đính kèm" loading="lazy" />)}</div>}
        {review.followups?.map(entry => <section className="pr-followup-note" key={entry.milestoneDays}><b>Cập nhật sau {entry.milestoneDays} ngày</b><p>{Object.values(entry.context).filter(value => value !== null).join(' · ')}</p></section>)}
        <div className="pr-admin-actions"><input aria-label={`Lý do ${review.isVisible ? 'ẩn' : 'khôi phục'} đánh giá ${review.id}`} placeholder="Lý do kiểm duyệt" value={reasons[review.id] || ''} onChange={event => setReasons(current => ({ ...current, [review.id]: event.target.value }))} />
          <button type="button" data-hidden={!review.isVisible} disabled={busyId === review.id} onClick={() => toggle(review)}>{busyId === review.id ? 'Đang lưu…' : review.isVisible ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}</button>
        </div>
      </article>) : <p className="pr-empty">Không có đánh giá phù hợp.</p>}
    </div>}
    {result?.pagination?.total > 0 && <footer className="ad-foot"><span>{result.pagination.total} đánh giá · Trang {page}/{Math.max(1, Math.ceil(result.pagination.total / result.pagination.pageSize))}</span><span className="hc-actions"><button className="hc-button hc-button--outline" type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><button className="hc-button hc-button--outline" type="button" disabled={page >= Math.ceil(result.pagination.total / result.pagination.pageSize)} onClick={() => setPage(value => value + 1)}>Sau</button></span></footer>}
  </section>;
}
