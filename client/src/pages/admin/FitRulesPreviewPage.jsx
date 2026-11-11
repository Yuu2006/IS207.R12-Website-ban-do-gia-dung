import { useEffect, useState } from 'react';
import { createFitRule, deactivateFitRule, getFitRuleOptions, getFitRuleVersions, listFitRules, updateFitRule } from '../../services/fit-rule-service.js';
import './fit-rules.css';

const blank = { scopeType: 'category', scopeId: '', ruleKey: '', title: '', leftSource: 'PRODUCT_ATTRIBUTE', leftKey: '', operator: 'LTE', rightSource: 'ROOM_FIELD', rightKey: '', rightValue: '', marginValue: '0', severity: 'BLOCK', status: 'ACTIVE', passMessage: '', failMessage: '', missingMessage: '' };
const sources = [['PRODUCT_ATTRIBUTE', 'Thông số sản phẩm'], ['ROOM_FIELD', 'Thông tin phòng']];
const operators = [['LT', '<'], ['LTE', '≤'], ['EQ', '='], ['GTE', '≥'], ['GT', '>']];
const when = value => value ? new Date(value).toLocaleString('vi-VN', { hour12: false }) : '—';

// Chỉ hiển thị quy tắc/API thật; form lấy field và đơn vị từ metadata catalog đã duyệt.
export default function FitRulesPreviewPage() {
  const [options, setOptions] = useState(null);
  const [productFields, setProductFields] = useState({});
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [list, setList] = useState(null);
  const [listFailed, setListFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { document.title = 'Quy tắc FitCheck · HomeCare'; }, []);
  useEffect(() => {
    let active = true;
    getFitRuleOptions().then(value => { if (active) setOptions(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => {
    let active = true;
    setList(null); setListFailed(false);
    listFitRules({ page, status }).then(value => { if (active) setList(value); }).catch(err => { if (active) { setError(err.message); setListFailed(true); } });
    return () => { active = false; };
  }, [page, status, reload]);

  const categoryId = draft?.scopeType === 'category' ? Number(draft.scopeId) : Number(options?.products.find(item => String(item.id) === draft?.scopeId)?.category_id);
  useEffect(() => {
    if (!categoryId) { setProductFields({}); setFieldsLoading(false); return; }
    let active = true;
    setProductFields({}); setFieldsLoading(true);
    getFitRuleOptions(categoryId).then(value => { if (active) setProductFields(value.productFields); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setFieldsLoading(false); });
    return () => { active = false; };
  }, [categoryId]);

  const fieldsFor = source => Object.entries(source === 'ROOM_FIELD' ? options?.roomFields || {} : productFields);
  const unit = fieldsFor(draft?.leftSource).find(([key]) => key === draft?.leftKey)?.[1].unit || '';
  const rightFields = fieldsFor(draft?.rightSource).filter(([, field]) => field.unit === unit);
  const change = (name, value) => setDraft(current => ({ ...current, [name]: value }));
  const scopeOptions = draft?.scopeType === 'category' ? options?.categories : options?.products;

  function edit(item = null) {
    setEditing(item); setHistory(null); setConfirmId(null); setError('');
    setDraft(item ? { scopeType: item.categoryId ? 'category' : 'product', scopeId: String(item.categoryId || item.productId), ruleKey: item.ruleKey, title: item.title, leftSource: item.leftSource, leftKey: item.leftKey, operator: item.operator, rightSource: item.rightSource, rightKey: item.rightKey || '', rightValue: item.rightValue ?? '', marginValue: item.marginValue, severity: item.severity, status: item.status, passMessage: item.passMessage, failMessage: item.failMessage, missingMessage: item.missingMessage } : { ...blank });
  }

  async function save(event) {
    event.preventDefault();
    if (busy || !draft) return;
    if (!draft.scopeId || !unit || (draft.rightSource !== 'CONSTANT' && !draft.rightKey)) { setError('Chọn phạm vi và hai trường có đơn vị tương thích.'); return; }
    const payload = { categoryId: draft.scopeType === 'category' ? Number(draft.scopeId) : null, productId: draft.scopeType === 'product' ? Number(draft.scopeId) : null, ruleKey: draft.ruleKey.trim(), title: draft.title.trim(), leftSource: draft.leftSource, leftKey: draft.leftKey, operator: unit === 'boolean' ? 'EQ' : draft.operator, rightSource: draft.rightSource, rightKey: draft.rightSource === 'CONSTANT' ? null : draft.rightKey, rightValue: draft.rightSource === 'CONSTANT' ? draft.rightValue : null, marginValue: unit === 'mm' ? draft.marginValue : '0', unit, severity: draft.severity, status: draft.status, passMessage: draft.passMessage.trim(), failMessage: draft.failMessage.trim(), missingMessage: draft.missingMessage.trim() };
    setBusy(true); setError(''); setNotice('');
    try {
      if (editing) await updateFitRule(editing.id, { ...payload, expectedVersion: editing.version });
      else await createFitRule(payload);
      setDraft(null); setEditing(null); setNotice('Đã lưu quy tắc và phiên bản lịch sử.'); setReload(value => value + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function openHistory(item) {
    setHistory({ rule: item, items: null }); setError('');
    try { const data = await getFitRuleVersions(item.id); setHistory({ rule: item, items: data.items }); }
    catch (err) { setError(err.message); }
  }

  async function deactivate(item) {
    if (busy) return;
    setBusy(true); setError('');
    try { await deactivateFitRule(item.id); setConfirmId(null); setNotice('Đã ngừng áp dụng; lịch sử vẫn được giữ.'); setReload(value => value + 1); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <section className="fr-page"><header className="hc-page-heading"><span className="hc-eyebrow">Quản trị · FIT-01</span><h1>Quy tắc FitCheck</h1><p>Quản lý điều kiện theo danh mục hoặc sản phẩm và xem lịch sử từng phiên bản.</p></header>
    <p className="fr-note">Đơn vị lấy từ metadata catalog/phòng. Sửa hoặc vô hiệu hóa sẽ tạo phiên bản mới; không sửa phiên bản cũ. Màn hình này chưa chạy FitCheck cho khách.</p>
    {notice && <p className="hc-success" role="status">{notice}</p>}{error && <p className="hc-error" role="alert">{error} <button type="button" className="hc-text-button" onClick={() => { setError(''); setReload(value => value + 1); }}>Thử lại</button></p>}
    <div className="fr-toolbar"><label>Trạng thái <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option><option value="ACTIVE">Đang áp dụng</option><option value="INACTIVE">Ngừng áp dụng</option></select></label><button type="button" className="hc-button" disabled={!options || busy} onClick={() => edit()}>Thêm quy tắc</button></div>
    {!list && !listFailed && <p role="status">Đang tải quy tắc…</p>}{list?.items.length === 0 && <p className="hc-muted">Chưa có quy tắc trong bộ lọc này.</p>}
    <div className="fr-list">{list?.items.map(item => <article className="hc-card fr-rule" key={item.id}><div className="fr-rule-info"><strong>{item.title}</strong><span>{item.ruleKey} · {item.categoryId ? `Danh mục #${item.categoryId}` : `Sản phẩm #${item.productId}`}</span><span>{item.leftKey} {operators.find(([key]) => key === item.operator)?.[1]} {item.rightKey ?? item.rightValue} {item.unit} · {item.severity === 'BLOCK' ? 'Bắt buộc' : 'Cảnh báo'}</span><small>v{item.version} · {item.status === 'ACTIVE' ? 'Đang áp dụng' : 'Ngừng áp dụng'} · {item.updatedByName} · {when(item.updatedAt)}</small></div><div className="fr-actions"><button type="button" className="hc-button hc-button--outline" onClick={() => openHistory(item)}>Lịch sử</button><button type="button" className="hc-button hc-button--outline" onClick={() => edit(item)}>Sửa</button>{item.status === 'ACTIVE' && <button type="button" className="hc-button hc-button--outline" onClick={() => setConfirmId(item.id)}>Ngừng áp dụng</button>}</div>{confirmId === item.id && <div className="fr-confirm">Ngừng áp dụng quy tắc này? <button type="button" className="hc-button" disabled={busy} onClick={() => deactivate(item)}>Xác nhận</button><button type="button" className="hc-button hc-button--outline" onClick={() => setConfirmId(null)}>Hủy</button></div>}</article>)}</div>
    {list?.total > 50 && <div className="fr-pagination"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trang trước</button><span>Trang {page}/{Math.ceil(list.total / 50)}</span><button type="button" disabled={page * 50 >= list.total} onClick={() => setPage(value => value + 1)}>Trang sau</button></div>}
    {draft && <section className="hc-card fr-editor"><h2>{editing ? `Sửa quy tắc #${editing.id} · v${editing.version}` : 'Thêm quy tắc'}</h2>{categoryId > 0 && !fieldsLoading && Object.keys(productFields).length === 0 && <p className="hc-muted">Danh mục chưa có thông số FitCheck khớp metadata TV4.</p>}<form className="fr-form" onSubmit={save}>
      <label>Phạm vi<select value={draft.scopeType} onChange={event => setDraft(current => ({ ...current, scopeType: event.target.value, scopeId: '', leftKey: '', rightKey: '' }))}><option value="category">Danh mục</option><option value="product">Sản phẩm</option></select></label>
      <label>{draft.scopeType === 'category' ? 'Danh mục' : 'Sản phẩm'}<select required value={draft.scopeId} onChange={event => setDraft(current => ({ ...current, scopeId: event.target.value, leftKey: '', rightKey: '' }))}><option value="">Chọn…</option>{scopeOptions?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Mã quy tắc<input required maxLength={80} value={draft.ruleKey} onChange={event => change('ruleKey', event.target.value)} placeholder="width_clearance" /></label><label>Tên quy tắc<input required maxLength={150} value={draft.title} onChange={event => change('title', event.target.value)} /></label>
      <label>Nguồn vế trái<select value={draft.leftSource} onChange={event => setDraft(current => ({ ...current, leftSource: event.target.value, leftKey: '', rightKey: '' }))}>{sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Trường vế trái<select required value={draft.leftKey} onChange={event => setDraft(current => ({ ...current, leftKey: event.target.value, rightKey: '' }))}><option value="">Chọn trường…</option>{fieldsFor(draft.leftSource).map(([key, field]) => <option key={key} value={key}>{field.label} ({field.unit})</option>)}</select></label>
      <label>Toán tử<select value={unit === 'boolean' ? 'EQ' : draft.operator} onChange={event => change('operator', event.target.value)}>{operators.filter(([key]) => unit !== 'boolean' || key === 'EQ').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Nguồn vế phải<select value={draft.rightSource} onChange={event => setDraft(current => ({ ...current, rightSource: event.target.value, rightKey: '', rightValue: '' }))}><option value="ROOM_FIELD">Thông tin phòng</option><option value="PRODUCT_ATTRIBUTE">Thông số sản phẩm</option><option value="CONSTANT">Hằng số</option></select></label>
      {draft.rightSource === 'CONSTANT' ? <label>Giá trị hằng số<input required type="number" step={unit === 'boolean' ? 1 : '0.0001'} min={unit === 'boolean' ? 0 : undefined} max={unit === 'boolean' ? 1 : undefined} value={draft.rightValue} onChange={event => change('rightValue', event.target.value)} /></label> : <label>Trường vế phải<select required value={draft.rightKey} onChange={event => change('rightKey', event.target.value)}><option value="">Chọn trường…</option>{rightFields.map(([key, field]) => <option key={key} value={key}>{field.label} ({field.unit})</option>)}</select></label>}
      <label>Đơn vị theo catalog<input readOnly value={unit} /></label><label>Khoảng hở (mm)<input type="number" min="0" step="0.0001" disabled={unit !== 'mm'} value={unit === 'mm' ? draft.marginValue : '0'} onChange={event => change('marginValue', event.target.value)} /></label>
      <label>Mức cảnh báo<select value={draft.severity} onChange={event => change('severity', event.target.value)}><option value="BLOCK">Bắt buộc</option><option value="WARN">Cảnh báo</option></select></label><label>Trạng thái<select value={draft.status} onChange={event => change('status', event.target.value)}><option value="ACTIVE">Đang áp dụng</option><option value="INACTIVE">Ngừng áp dụng</option></select></label>
      <label className="fr-wide">Giải thích khi đạt<input required maxLength={255} value={draft.passMessage} onChange={event => change('passMessage', event.target.value)} /></label><label className="fr-wide">Giải thích khi không đạt<input required maxLength={255} value={draft.failMessage} onChange={event => change('failMessage', event.target.value)} /></label><label className="fr-wide">Giải thích khi thiếu dữ liệu<input required maxLength={255} value={draft.missingMessage} onChange={event => change('missingMessage', event.target.value)} /></label>
      <div className="fr-wide fr-actions"><button className="hc-button" type="submit" disabled={busy || !unit}>{busy ? 'Đang lưu…' : 'Lưu quy tắc'}</button><button type="button" className="hc-button hc-button--outline" disabled={busy} onClick={() => setDraft(null)}>Hủy</button></div>
    </form></section>}
    {history && <section className="hc-card fr-history"><div className="fr-history-head"><h2>Lịch sử: {history.rule.title}</h2><button type="button" onClick={() => setHistory(null)}>Đóng</button></div>{!history.items && <p role="status">Đang tải lịch sử…</p>}{history.items?.map(entry => <details key={entry.version}><summary>v{entry.version} · {entry.action} · {entry.changedByName} · {when(entry.changedAt)}</summary><pre>{JSON.stringify(entry.snapshot, null, 2)}</pre></details>)}</section>}
  </section>;
}
