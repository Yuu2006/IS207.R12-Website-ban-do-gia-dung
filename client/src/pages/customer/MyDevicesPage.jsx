import { useCallback, useEffect, useState } from 'react';
import { Archive, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Package, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AnimatedTabs from '../../components/common/AnimatedTabs.jsx';
import { careService } from '../../services/care-service.js';
import './care-pages.css';

const dateLabel = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'Chưa xác nhận';
const deviceStatusTabs = [['ACTIVE', 'Đang sử dụng'], ['ARCHIVED', 'Đã lưu trữ']];
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const vietnamDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
};
const vietnamDateString = (parts = vietnamDate()) => `${parts.year}-${parts.month}-${parts.day}`;
const tomorrowVietnam = () => {
  const parts = vietnamDate();
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1)).toISOString().slice(0, 10);
};

function TaskCard({ task, onComplete, onPostpone, busy }) {
  const [showPostpone, setShowPostpone] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const tomorrow = tomorrowVietnam();
  const overdue = task.status !== 'COMPLETED' && task.dueDate < vietnamDateString();

  async function submitPostpone(event) {
    event.preventDefault();
    if (await onPostpone(task.id, { newDueDate, reason })) {
      setShowPostpone(false);
      setNewDueDate('');
      setReason('');
    }
  }

  return <article className="care-task">
    <div className="care-task__main">
      <div className="care-task__heading"><strong>{task.title}</strong><span className={`care-status care-status--${task.status.toLowerCase()}`}>{task.status === 'COMPLETED' ? 'Đã hoàn thành' : task.status === 'POSTPONED' ? 'Đã hoãn' : overdue ? 'Quá hạn' : 'Đến hạn'}</span></div>
      <p>{task.instructions}</p>
      <div className="care-task__meta"><span><CalendarClock size={15} aria-hidden="true" /> Hạn: {dateLabel(task.dueDate)}</span>{task.originalDueDate !== task.dueDate && <span>Hạn ban đầu: {dateLabel(task.originalDueDate)}</span>}</div>
      {task.postponeReason && <p className="care-task__reason">Lý do hoãn: {task.postponeReason}</p>}
      {task.supplies?.length > 0 && <div className="care-supplies"><span className="care-supplies__label">Vật tư liên quan</span>{task.supplies.map(supply => <Link className="care-supply" key={supply.variantId} to={supply.href}>
        <span><strong>{supply.productName}</strong><small>{supply.sku} · {supply.variantName} · {money(supply.currentPrice)}</small></span>
        <span className={supply.available ? 'care-supply__stock' : 'care-supply__stock care-supply__stock--empty'}>{supply.available ? `Còn ${supply.stockQuantity}` : 'Tạm hết'}<span aria-hidden="true"> →</span></span>
      </Link>)}</div>}
    </div>
    {task.status !== 'COMPLETED' && <div className="care-task__actions">
      <button type="button" className="care-button" disabled={busy} onClick={() => onComplete(task.id)}><Check size={16} aria-hidden="true" /> Hoàn thành</button>
      <button type="button" className="care-button care-button--quiet" disabled={busy} onClick={() => setShowPostpone(value => !value)}><ChevronDown size={16} aria-hidden="true" /> Hoãn lịch</button>
    </div>}
    {showPostpone && <form className="care-postpone" onSubmit={submitPostpone}>
      <div className="hc-form-grid"><div className="hc-field"><label htmlFor={`care-date-${task.id}`}>Ngày mới</label><input id={`care-date-${task.id}`} type="date" min={tomorrow} value={newDueDate} onChange={event => setNewDueDate(event.target.value)} required /></div>
        <div className="hc-field"><label htmlFor={`care-reason-${task.id}`}>Lý do hoãn</label><input id={`care-reason-${task.id}`} value={reason} onChange={event => setReason(event.target.value)} maxLength={255} required /></div></div>
      <button type="submit" className="care-button" disabled={busy}>Lưu lịch mới</button>
    </form>}
  </article>;
}

function DeviceCard({ device, onComplete, onPostpone, onArchive, busyTaskId, busyDeviceId, onSerialSave }) {
  const [serial, setSerial] = useState(device.serialNumber || '');
  const [serialDirty, setSerialDirty] = useState(false);
  return <article className="care-device hc-card">
    <div className="care-device__top">
      <div className="care-device__image">{device.imageUrl ? <img src={device.imageUrl} alt="" /> : <Package size={28} aria-hidden="true" />}</div>
      <div className="care-device__identity"><span className="hc-eyebrow">{device.categoryName || 'Thiết bị gia dụng'}</span><h2>{device.productName}</h2><p>Mã SKU: <strong>{device.sku}</strong>{device.unitNumber > 1 ? ` · Thiết bị ${device.unitNumber}` : ''}</p></div>
      <button type="button" className="care-icon-button" aria-label={device.status === 'ARCHIVED' ? 'Khôi phục thiết bị' : 'Lưu trữ thiết bị'} title={device.status === 'ARCHIVED' ? 'Khôi phục thiết bị' : 'Lưu trữ thiết bị'} disabled={busyDeviceId === device.id} onClick={() => onArchive(device.id)}><Archive size={18} aria-hidden="true" /></button>
    </div>
    <div className="care-device__facts">
      <div><ShieldCheck size={17} aria-hidden="true" /><span>Bảo hành<strong>{device.warrantyMonths ? `${device.warrantyMonths} tháng` : 'Chưa có thời hạn'}</strong><small>{device.warrantyStartConfirmed ? `Bắt đầu ${dateLabel(device.warrantyStartDate)}` : 'Ngày bắt đầu chưa được xác nhận'}</small></span></div>
      <div><CalendarClock size={17} aria-hidden="true" /><span>Hoàn tất đơn<strong>{dateLabel(device.completedAt)}</strong><small>Ngày mua: {dateLabel(device.purchasedAt)}</small></span></div>
    </div>
    <form className="care-serial" onSubmit={async event => { event.preventDefault(); if (await onSerialSave(device.id, serial)) setSerialDirty(false); }}>
      <div className="hc-field"><label htmlFor={`serial-${device.id}`}>Số serial (tùy chọn)</label><input id={`serial-${device.id}`} value={serial} onChange={event => { setSerial(event.target.value); setSerialDirty(true); }} maxLength={100} placeholder="Nhập số serial trên thiết bị" /></div>
      {serialDirty && <button type="submit" className="care-button care-button--quiet" disabled={busyDeviceId === device.id}>Lưu serial</button>}
    </form>
    <div className="care-schedule"><div className="care-schedule__heading"><h3>Lịch bảo trì</h3><span>{device.careTasks.length} chu kỳ</span></div>
      {device.careTasks.length ? <div className="care-task-list">{device.careTasks.map(task => <TaskCard key={task.id} task={task} onComplete={onComplete} onPostpone={onPostpone} busy={busyTaskId === task.id} />)}</div>
        : <p className="care-empty-inline">Chưa có chu kỳ bảo trì được cấu hình cho thiết bị này.</p>}
    </div>
  </article>;
}

export default function MyDevicesPage() {
  const [status, setStatus] = useState('ACTIVE');
  const [devices, setDevices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyTaskId, setBusyTaskId] = useState('');
  const [busyDeviceId, setBusyDeviceId] = useState('');

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await careService.listDevices({ status, page, pageSize: 20 });
      if (result.pagination?.totalPages > 0 && page > result.pagination.totalPages) { setPage(result.pagination.totalPages); return; }
      setDevices(result.items || []);
      setPagination(result.pagination || { page, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch (failure) {
      setError(failure.message || 'Chưa thể tải thiết bị. Hãy thử lại.');
    } finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { document.title = 'Thiết bị của tôi · HomeCare'; loadDevices(); }, [loadDevices]);

  async function runTaskAction(taskId, action) {
    if (busyTaskId) return;
    setBusyTaskId(taskId); setError(''); setNotice('');
    try { await action(); await loadDevices(); setNotice('Lịch bảo trì đã được cập nhật.'); return true; }
    catch (failure) { setError(failure.message || 'Chưa thể cập nhật lịch.'); return false; }
    finally { setBusyTaskId(''); }
  }

  async function archiveDevice(deviceId) {
    if (busyDeviceId) return;
    setBusyDeviceId(deviceId); setError(''); setNotice('');
    try { await careService.updateDevice(deviceId, { status: status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' }); await loadDevices(); setNotice(status === 'ACTIVE' ? 'Thiết bị đã được lưu trữ.' : 'Thiết bị đã được khôi phục.'); }
    catch (failure) { setError(failure.message || 'Chưa thể cập nhật thiết bị.'); }
    finally { setBusyDeviceId(''); }
  }

  async function saveSerial(deviceId, serialNumber) {
    setBusyDeviceId(deviceId); setError(''); setNotice('');
    try { await careService.updateDevice(deviceId, { serialNumber }); await loadDevices(); setNotice('Số serial đã được lưu.'); return true; }
    catch (failure) { setError(failure.message || 'Chưa thể lưu số serial.'); return false; }
    finally { setBusyDeviceId(''); }
  }

  return <section className="dt-page care-page">
    <div className="hc-page-heading"><span className="hc-eyebrow">TÀI KHOẢN</span><h1>Thiết bị của tôi</h1><p>Thông tin thiết bị, bảo hành và lịch chăm sóc được tạo từ các đơn hàng đã hoàn tất.</p></div>
    <div className="care-toolbar"><AnimatedTabs className="care-tabs" options={deviceStatusTabs} value={status} onChange={value => { setPage(1); setStatus(value); }} label="Lọc thiết bị" idPrefix="device-tab" panelId="devices-panel" /><button type="button" className="care-button care-button--quiet" onClick={loadDevices} disabled={loading}><RefreshCw size={15} aria-hidden="true" /> Làm mới</button></div>
    {notice && <p className="care-notice" role="status">{notice}</p>}{error && <div className="care-error" role="alert"><span>{error}</span><button type="button" onClick={loadDevices}>Thử lại</button></div>}
    <div id="devices-panel" key={status} className="hc-tab-content" role="tabpanel" aria-labelledby={`device-tab-${status}`}>
      {loading ? <div className="hc-card care-loading" role="status">Đang tải thiết bị và lịch bảo trì…</div> : devices.length ? <div className="care-device-list">{devices.map(device => <DeviceCard key={device.id} device={device} onComplete={taskId => runTaskAction(taskId, () => careService.completeTask(taskId))} onPostpone={(taskId, values) => runTaskAction(taskId, () => careService.postponeTask(taskId, values))} onArchive={archiveDevice} onSerialSave={saveSerial} busyTaskId={busyTaskId} busyDeviceId={busyDeviceId} />)}</div>
        : <div className="hc-card care-empty"><Package size={36} aria-hidden="true" /><h2>{status === 'ACTIVE' ? 'Chưa có thiết bị được ghi nhận' : 'Không có thiết bị lưu trữ'}</h2><p>Thiết bị sẽ xuất hiện tại đây khi đơn hàng của bạn được hoàn tất.</p><Link className="care-button" to="/orders">Xem đơn hàng</Link></div>}
      {!loading && pagination.totalPages > 1 && <nav className="care-pagination" aria-label="Phân trang thiết bị"><button type="button" className="care-button care-button--quiet" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}><ChevronLeft size={16} aria-hidden="true" />Trước</button><span>Trang {pagination.page} / {pagination.totalPages} · {pagination.totalItems} thiết bị</span><button type="button" className="care-button care-button--quiet" onClick={() => setPage(value => Math.min(pagination.totalPages, value + 1))} disabled={page >= pagination.totalPages}>Sau<ChevronRight size={16} aria-hidden="true" /></button></nav>}
    </div>
  </section>;
}
