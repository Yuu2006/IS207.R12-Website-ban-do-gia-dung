import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInstallationChecklist, saveInstallationChecklist, uploadChecklistReferencePhoto } from '../../services/installation-checklist-service.js';
import { API_URL } from '../../services/http-client.js';

// Completion is a customer's preparation record, not a substitute for the model manual or a FitCheck result.
export default function InstallationChecklist({ productId, roomProfileId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const attempt = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    getInstallationChecklist(productId, roomProfileId, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [productId, roomProfileId, revision]);

  async function save(event) {
    event.preventDefault();
    if (!data || pending.current) return;
    pending.current = true; setSaving(true); setError(''); setNotice('');
    const body = { productId: Number(productId), roomProfileId: roomProfileId ? Number(roomProfileId) : null, checks: data.checks, expectedVersion: data.version, referencePhotoUrl: data.referencePhotoUrl || null };
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, requestKey: crypto.randomUUID() };
    try {
      const saved = await saveInstallationChecklist({ ...body, requestKey: attempt.current.requestKey });
      setData(saved); attempt.current = null; setNotice(saved.completed ? 'Đã lưu checklist hoàn tất.' : 'Đã lưu tiến độ checklist.');
    } catch (failure) { setError(failure.message); }
    finally { pending.current = false; setSaving(false); }
  }

  return <section className="hc-card dt-installation" aria-labelledby="installation-title">
    <h2 id="installation-title">Checklist chuẩn bị giao/lắp</h2>
    <p className="hc-muted">Tự xác nhận sau khi kiểm tra thực tế. Checklist không thay thế hướng dẫn của hãng hoặc kết luận FitCheck; không tự xác nhận kích thước, điện nước hay chi phí lắp đặt.</p>
    <Link to={`/catalog/products/${encodeURIComponent(productId)}`}>Xem ảnh và thông số tham khảo của sản phẩm</Link>
    {loading && <p role="status">Đang tải checklist…</p>}
    {error && <p className="hc-error" role="alert">{error} <button className="hc-text-button" type="button" disabled={saving} onClick={() => { attempt.current = null; setRevision(value => value + 1); }}>Tải lại checklist</button></p>}
    {data && <form onSubmit={save}>
      <fieldset disabled={saving}><legend className="oc-sr-only">Các mục chuẩn bị</legend>{Object.entries(data.items).map(([key, label]) => <label className="dt-installation-item" key={key}><input type="checkbox" checked={data.checks[key]} onChange={event => { setNotice(''); setData(current => ({ ...current, checks: { ...current.checks, [key]: event.target.checked } })); }} />{label}</label>)}</fieldset>
      <div className="dt-installation-reference"><label htmlFor="installation-reference-photo">Ảnh tham khảo vị trí/lối lắp (không bắt buộc)</label><input id="installation-reference-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving || uploading} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { setError('Ảnh phải là JPEG, PNG hoặc WebP và không quá 5 MB.'); return; } setUploading(true); setError(''); setNotice(''); try { const url = await uploadChecklistReferencePhoto(file); setData(current => ({ ...current, referencePhotoUrl: url })); setNotice('Ảnh đã tải lên; lưu checklist để gắn ảnh vào phiên bản này.'); } catch (failure) { setError(failure.message || 'Không tải được ảnh tham khảo.'); } finally { setUploading(false); } }} />{uploading && <p role="status">Đang tải ảnh tham khảo…</p>}{data.referencePhotoUrl && <div className="dt-installation-reference__preview"><img src={`${API_URL}${data.referencePhotoUrl}`} alt="Ảnh tham khảo vị trí lắp đặt" /><button type="button" className="hc-text-button" disabled={saving || uploading} onClick={() => setData(current => ({ ...current, referencePhotoUrl: null }))}>Bỏ ảnh</button></div>}<small className="hc-muted">Ảnh chỉ dùng tham khảo; hệ thống không phân tích nội dung. Tối đa 5 MB.</small></div>
      <p className="hc-muted">{data.firstCompletedAt ? `Hoàn tất lần đầu: ${new Date(data.firstCompletedAt).toLocaleString('vi-VN')}.` : 'Chưa ghi nhận hoàn tất.'} Phiên bản {data.version}.</p>
      <button className="hc-button" type="submit" disabled={saving || uploading}>{saving ? 'Đang lưu…' : 'Lưu checklist'}</button>
      {notice && <p className="hc-success" role="status">{notice}</p>}
      {data.history?.length > 0 && <details><summary>Lịch sử checklist (20 bản gần nhất)</summary><ul>{data.history.map(item => <li key={item.version}>Phiên bản {item.version} · {new Date(item.savedAt).toLocaleString('vi-VN')} · {Object.values(item.checks).filter(Boolean).length}/{Object.keys(item.checks).length} mục</li>)}</ul></details>}
    </form>}
  </section>;
}
