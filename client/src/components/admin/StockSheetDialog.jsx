import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { adjustStock, listInventory } from '../../services/catalog-service.js';
import { adjustmentRequest, lineCode, sheetCode, submitStockLines } from '../../utils/stock-sheet.js';
import Modal from './Modal.jsx';
import { AdminField } from './SimpleCrud.jsx';

// Ba loại phiếu dùng chung một form, khác nhau ở cấu hình. Lý do gửi vào `note` (≤ 500 ký tự theo API).
const kinds = {
  in: { title: 'Nhập kho', description: 'Tạo phiếu nhập để tăng tồn kho.', legend: 'Sản phẩm nhập', prefix: 'PN', submit: 'Xác nhận nhập kho', movement: 'import', reasons: ['Nhập hàng bổ sung', 'Hàng đổi trả nhập lại', 'Khác'], columns: ['Sản phẩm', 'Tồn', 'Số lượng nhập', 'Tồn sau'] },
  out: { title: 'Xuất kho', description: 'Tạo phiếu xuất để giảm tồn kho.', legend: 'Sản phẩm xuất', prefix: 'PX', submit: 'Xác nhận xuất kho', movement: 'export', reasons: ['Bảo hành, đổi trả', 'Hủy hàng hỏng', 'Khác'], columns: ['Sản phẩm', 'Tồn', 'Số lượng xuất', 'Tồn sau'] },
  adjust: { title: 'Kiểm kê tồn kho', description: 'Đối chiếu số lượng thực tế với hệ thống và điều chỉnh chênh lệch.', legend: 'Sản phẩm kiểm kê', prefix: 'DC', submit: 'Xác nhận điều chỉnh', reasons: ['Kiểm kê định kỳ', 'Hàng hỏng, thất thoát', 'Sai sót nhập liệu', 'Khác'], columns: ['Sản phẩm', 'Hệ thống', 'Thực tế', 'Chênh lệch'] },
};
const MAX_NOTE = 500;
const signed = number => (number > 0 ? `+${number}` : String(number));

// Kiểm tra một dòng với tồn của SKU; `live` = lỗi hiện ngay khi gõ, lỗi khác chỉ hiện sau lần bấm gửi đầu tiên.
function checkLine(kind, line, stock) {
  if (!line.sku) return { error: 'Chọn SKU.' };
  const quantity = /^\d+$/.test(line.quantity) ? Number(line.quantity) : NaN;
  if (kind === 'adjust') return Number.isNaN(quantity) ? { error: 'Nhập số lượng thực tế (số nguyên từ 0).' } : { quantity, delta: quantity - stock };
  if (!(quantity > 0)) return { error: 'Số lượng là số nguyên dương.' };
  if (kind === 'out' && quantity > stock) return { error: `Số lượng xuất vượt tồn hiện tại (${stock}).`, live: true };
  return { quantity, after: kind === 'in' ? stock + quantity : stock - quantity };
}

// WH-03/04: phiếu nhập/xuất/kiểm kê nhiều dòng. Mỗi dòng là một POST riêng (không atomic): dòng đã ghi bị khóa, gửi lại chỉ gửi dòng còn lại với cùng mã chứng từ.
export default function StockSheetDialog({ kind, initialSku = '', onClose }) {
  const config = kinds[kind];
  const uid = useId();
  const [inventory, setInventory] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [code] = useState(() => sheetCode(config.prefix));
  const [lines, setLines] = useState([{ key: 1, sku: initialSku, quantity: '', result: null, error: '', warning: '' }]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);
  const [written, setWritten] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError('');
    listInventory(false).then(data => { if (active) setInventory(data.map(item => ({ ...item, stock_quantity: Number(item.stock_quantity) }))); }).catch(err => { if (active) setLoadError(err.message); });
    return () => { active = false; };
  }, [attempt]);

  const bySku = Object.fromEntries((inventory ?? []).map(item => [item.sku, item]));
  const checked = lines.map(line => ({ line, item: bySku[line.sku], ...(bySku[line.sku] ? checkLine(kind, line, bySku[line.sku].stock_quantity) : { error: line.sku ? 'SKU không có trong danh sách tồn kho.' : 'Chọn SKU.' }) }));
  const pending = checked.filter(entry => !entry.line.result);
  const showError = entry => entry.line.error || (!entry.line.result && entry.error && (attempted || entry.live) ? entry.error : '');
  const noteText = note.trim() ? `${reason}: ${note.trim()}` : reason;
  const reasonError = reason ? '' : 'Chọn lý do.';
  const noteError = reason === 'Khác' && !note.trim() ? 'Chọn "Khác" thì phải ghi chú lý do.' : noteText.length > MAX_NOTE ? `Lý do và ghi chú tối đa ${MAX_NOTE} ký tự.` : '';
  const changed = kind === 'adjust' ? pending.filter(entry => entry.delta).length : pending.length;
  const blocked = submitting || !inventory || changed === 0 || pending.some(entry => entry.live);
  const usedSkus = new Set(lines.map(line => line.sku));

  const setLine = (key, patch) => setLines(current => current.map(line => line.key === key ? { ...line, ...patch, error: '' } : line));
  const addLine = () => setLines(current => [...current, { key: Math.max(0, ...current.map(line => line.key)) + 1, sku: '', quantity: '', result: null, error: '', warning: '' }]);

  async function submit(event) {
    event.preventDefault();
    if (blocked) return;
    setAttempted(true);
    if (reasonError || noteError || pending.some(entry => entry.error)) return;
    setSubmitting(true); setBanner(null);
    const requests = pending.map(entry => ({ key: entry.line.key, request: kind === 'adjust' ? adjustmentRequest({ sku: entry.line.sku, system: entry.item.stock_quantity, actual: entry.quantity, reference_code: lineCode(code, entry.line.key), note: noteText }) : { sku: entry.line.sku, movement_type: config.movement, quantity: entry.quantity, reference_code: lineCode(code, entry.line.key), note: noteText } })).filter(entry => entry.request);
    const { results, failure } = await submitStockLines(requests, adjustStock);
    const count = Object.keys(results).length;
    setWritten(current => current + count);
    setLines(current => current.map(line => results[line.key] ? { ...line, result: results[line.key], error: '', warning: kind === 'adjust' && results[line.key].quantity_after !== Number(line.quantity) ? `Tồn sau khi ghi là ${results[line.key].quantity_after}, khác số đếm ${line.quantity}: tồn đã đổi trong lúc kiểm kê. Hãy kiểm tra lại SKU này.` : '' } : { ...line, error: line.key === failure?.key ? failure.message : '' }));
    setBanner(failure ? { error: true, text: `${count ? `Đã ghi ${count} dòng. ` : ''}Dừng ở một dòng lỗi: sửa dòng đó rồi gửi lại, các dòng đã ghi được giữ nguyên.` } : { error: false, text: `Đã ghi ${count} dòng vào kho. Đối chiếu trong Nhật ký kho.` });
    setSubmitting(false);
  }

  const totalQuantity = checked.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
  const totalDelta = pending.reduce((sum, entry) => sum + (entry.delta ?? 0), 0);
  const close = () => !submitting && onClose(written);

  return <Modal wide title={config.title} description={config.description} onClose={close}>
    <form className="hc-form" noValidate onSubmit={submit}>
      {banner && <p className={banner.error ? 'hc-error' : 'hc-success'} role={banner.error ? 'alert' : 'status'}>{banner.text}</p>}
      <div className="hc-form-grid">
        <div className="hc-field"><label htmlFor={`${uid}-code`}>Mã phiếu</label><input id={`${uid}-code`} readOnly value={code} /></div>
        <AdminField field={{ id: `${uid}-reason`, name: 'reason', label: 'Lý do', type: 'select', options: config.reasons.map(item => [item, item]), placeholder: 'Chọn lý do', required: true }} value={reason} error={attempted ? reasonError : ''} disabled={submitting} onChange={setReason} />
      </div>
      {loadError ? <p className="hc-error" role="alert">{loadError} <button className="hc-text-button" type="button" onClick={() => setAttempt(current => current + 1)}>Thử lại</button></p>
        : !inventory ? <p className="hc-muted" role="status">Đang tải danh sách SKU…</p>
        : <fieldset className="hc-lines"><legend>{config.legend} <span aria-hidden="true">*</span></legend>
          <div className="hc-ln hc-ln--head" aria-hidden="true">{config.columns.map(label => <span key={label}>{label}</span>)}<span /></div>
          {checked.map((entry, index) => { const { line, item } = entry; const message = showError(entry); const noteId = `${uid}-note-${line.key}`; const done = Boolean(line.result);
            return <div className={`hc-ln${message ? ' hc-ln--bad' : ''}${done ? ' hc-ln--done' : ''}`} key={line.key}>
              <select aria-label={`Sản phẩm, dòng ${index + 1}`} aria-invalid={Boolean(message)} aria-describedby={message ? noteId : undefined} value={line.sku} disabled={done || submitting} onChange={event => setLine(line.key, { sku: event.target.value })}>
                <option value="">Chọn SKU</option>{inventory.filter(option => option.sku === line.sku || !usedSkus.has(option.sku)).map(option => <option key={option.sku} value={option.sku}>{option.sku} · {option.product_name} · {option.variant_name}</option>)}
              </select>
              <span className="hc-ln-cell" data-label={config.columns[1]}>{item ? (done ? line.result.quantity_before : item.stock_quantity) : '—'}</span>
              <input className="hc-ln-qty" aria-label={`${config.columns[2]}, dòng ${index + 1}`} aria-invalid={Boolean(message)} aria-describedby={message ? noteId : undefined} inputMode="numeric" autoComplete="off" value={line.quantity} disabled={done || submitting} onChange={event => setLine(line.key, { quantity: event.target.value.replace(/\D/g, '').slice(0, 9) })} />
              <span className="hc-ln-cell hc-ln-result" data-label={config.columns[3]}>{done ? <>{line.result.quantity_before} → <strong>{line.result.quantity_after}</strong></> : entry.error ? '—' : kind === 'adjust' ? <span className={`hc-badge ${entry.delta > 0 ? 'hc-badge--in' : entry.delta < 0 ? 'hc-badge--warn' : 'hc-badge--mute'}`}>{signed(entry.delta)}</span> : entry.after}</span>
              <button className="hc-icon-button" type="button" aria-label={`Xóa dòng ${index + 1}`} disabled={done || submitting} onClick={() => setLines(current => current.filter(other => other.key !== line.key))}><Trash2 size={18} aria-hidden="true" /></button>
              {message && <p className="hc-ln-note hc-field-error" id={noteId} role={line.error ? 'alert' : undefined}>{message}</p>}
              {line.warning && <p className="hc-ln-note hc-ln-note--warn" role="alert">{line.warning}</p>}
            </div>; })}
          <div><button className="hc-button hc-button--outline" type="button" disabled={submitting || lines.length >= inventory.length} onClick={addLine}><Plus size={16} aria-hidden="true" />Thêm dòng sản phẩm</button></div>
        </fieldset>}
      <AdminField field={{ id: `${uid}-note`, name: 'note', label: reason === 'Khác' ? 'Ghi chú (bắt buộc khi chọn "Khác")' : 'Ghi chú', type: 'textarea', maxLength: MAX_NOTE - reason.length - 2 }} value={note} error={noteError && attempted ? noteError : ''} disabled={submitting} onChange={setNote} />
      <div className="hc-form-footer">
        <div className="hc-tots">{kind === 'adjust' ? <><div className="hc-tot"><small>{changed} trên {pending.length} dòng có chênh lệch</small><b>Tổng điều chỉnh: {signed(totalDelta)}</b></div></> : <div className="hc-tot"><small>Tổng số lượng</small><b>{totalQuantity}</b></div>}</div>
        <span className="hc-actions"><button className="hc-button hc-button--outline" type="button" disabled={submitting} onClick={close}>{written ? 'Đóng' : 'Hủy'}</button><button className="hc-button" type="submit" disabled={blocked}>{submitting ? 'Đang ghi…' : config.submit}</button></span>
      </div>
    </form>
  </Modal>;
}
