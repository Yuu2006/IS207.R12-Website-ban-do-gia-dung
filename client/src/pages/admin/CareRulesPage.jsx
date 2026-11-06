import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, X } from 'lucide-react';
import { PageHead } from '../../components/admin/ui.jsx';
import { categories, listProducts } from '../../services/catalog-service.js';
import { careService } from '../../services/care-service.js';
import '../customer/care-pages.css';

const emptyForm = () => ({ scope: 'category', categoryId: '', productId: '', ruleKey: '', title: '', instructions: '', firstDueDays: '30', intervalDays: '180', status: 'ACTIVE', supplyVariantIds: [] });
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));

// Admin configures future care schedules; saved tasks on existing devices remain unchanged.
export default function CareRulesPage() {
  const [rules, setRules] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [supplySearch, setSupplySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ruleResult, categoryRows, productRows, supplyResult] = await Promise.all([
        careService.listRules(), categories.list(), listProducts({ is_active: '1' }), careService.listSupplyOptions(),
      ]);
      setRules(ruleResult.items || []);
      setCategoryOptions(categoryRows.filter(row => Number(row.is_active) !== 0).map(row => ({ id: String(row.id), name: row.name })));
      setProductOptions(productRows.map(row => ({ id: String(row.id), name: row.name, categoryName: row.category_name })));
      setSupplies(supplyResult.items || []);
    } catch (failure) {
      setError(failure.message || 'Chưa thể tải quy tắc bảo trì. Kiểm tra migration và API rồi thử lại.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { document.title = 'Chu kỳ bảo trì · HomeCare'; loadPage(); }, [loadPage]);
  useEffect(() => {
    if (!supplySearch.trim()) return;
    const timer = setTimeout(() => {
      careService.listSupplyOptions(supplySearch.trim()).then(result => setSupplies(result.items || [])).catch(failure => setError(failure.message || 'Không thể tìm SKU vật tư.'));
    }, 250);
    return () => clearTimeout(timer);
  }, [supplySearch]);

  function updateField(name, value) { setForm(current => ({ ...current, [name]: value })); }

  function startEdit(rule) {
    setEditingId(rule.id);
    setForm({ scope: rule.productId ? 'product' : 'category', categoryId: rule.categoryId || '', productId: rule.productId || '', ruleKey: rule.ruleKey, title: rule.title, instructions: rule.instructions, firstDueDays: String(rule.firstDueDays), intervalDays: String(rule.intervalDays), status: rule.status, supplyVariantIds: rule.supplies.map(item => item.variantId) });
    setNotice('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() { setEditingId(''); setForm(emptyForm()); setNotice(''); }

  async function saveRule(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    const payload = {
      categoryId: form.scope === 'category' ? form.categoryId : null,
      productId: form.scope === 'product' ? form.productId : null,
      ruleKey: form.ruleKey.trim().toLowerCase(), title: form.title.trim(), instructions: form.instructions.trim(),
      firstDueDays: Number(form.firstDueDays), intervalDays: Number(form.intervalDays), status: form.status,
      supplyVariantIds: form.supplyVariantIds,
    };
    try {
      if (editingId) await careService.updateRule(editingId, payload);
      else await careService.createRule(payload);
      await loadPage();
      resetForm();
      setNotice(editingId ? 'Đã cập nhật quy tắc. Lịch đã tạo trước đây được giữ nguyên.' : 'Đã tạo quy tắc cho các đơn hoàn tất trong tương lai.');
    } catch (failure) { setError(failure.message || 'Chưa thể lưu quy tắc.'); }
    finally { setSaving(false); }
  }

  function toggleSupply(variantId) {
    setForm(current => {
      const selected = current.supplyVariantIds.includes(variantId);
      if (!selected && current.supplyVariantIds.length >= 10) return current;
      return { ...current, supplyVariantIds: selected ? current.supplyVariantIds.filter(id => id !== variantId) : [...current.supplyVariantIds, variantId] };
    });
  }

  const selectedSupplies = form.supplyVariantIds.map(id => supplies.find(item => item.variantId === id)).filter(Boolean);

  return <section className="dt-page care-page">
    <PageHead title="Chu kỳ bảo trì" subtitle="Quản lý lịch áp dụng cho thiết bị được tạo khi đơn hàng hoàn tất. Quy tắc mới chỉ ảnh hưởng các đơn hoàn tất sau khi lưu." />
    {notice && <p className="care-notice" role="status">{notice}</p>}
    {error && <div className="care-error" role="alert"><span>{error}</span><button type="button" onClick={loadPage}>Thử lại</button></div>}
    <div className="care-admin-layout">
      <form className="hc-card care-admin-form" onSubmit={saveRule}>
        <h2>{editingId ? 'Chỉnh sửa quy tắc' : 'Thêm quy tắc'}</h2>
        <div className="hc-field"><label htmlFor="care-rule-scope">Phạm vi áp dụng *</label><select id="care-rule-scope" value={form.scope} onChange={event => setForm(current => ({ ...current, scope: event.target.value, categoryId: '', productId: '' }))}><option value="category">Danh mục</option><option value="product">Sản phẩm</option></select></div>
        {form.scope === 'category' ? <div className="hc-field"><label htmlFor="care-rule-category">Danh mục *</label><select id="care-rule-category" value={form.categoryId} onChange={event => updateField('categoryId', event.target.value)} required><option value="">Chọn danh mục</option>{categoryOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          : <div className="hc-field"><label htmlFor="care-rule-product">Sản phẩm *</label><select id="care-rule-product" value={form.productId} onChange={event => updateField('productId', event.target.value)} required><option value="">Chọn sản phẩm</option>{productOptions.map(item => <option key={item.id} value={item.id}>{item.name}{item.categoryName ? ` · ${item.categoryName}` : ''}</option>)}</select></div>}
        <div className="hc-form-grid">
          <div className="hc-field"><label htmlFor="care-rule-key">Mã quy tắc *</label><input id="care-rule-key" value={form.ruleKey} onChange={event => updateField('ruleKey', event.target.value)} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}" maxLength={80} placeholder="filter-cleaning" required /><small>Dùng cùng mã để quy tắc sản phẩm ghi đè quy tắc danh mục.</small></div>
          <div className="hc-field"><label htmlFor="care-rule-title">Tên chu kỳ *</label><input id="care-rule-title" value={form.title} onChange={event => updateField('title', event.target.value)} maxLength={150} required /></div>
        </div>
        <div className="hc-field"><label htmlFor="care-rule-instructions">Hướng dẫn *</label><textarea id="care-rule-instructions" value={form.instructions} onChange={event => updateField('instructions', event.target.value)} maxLength={10000} required /></div>
        <div className="hc-form-grid">
          <div className="hc-field"><label htmlFor="care-rule-first">Lịch đầu tiên sau khi hoàn tất đơn (ngày) *</label><input id="care-rule-first" type="number" min="1" max="3650" value={form.firstDueDays} onChange={event => updateField('firstDueDays', event.target.value)} required /></div>
          <div className="hc-field"><label htmlFor="care-rule-interval">Khoảng cách chu kỳ (ngày) *</label><input id="care-rule-interval" type="number" min="1" max="3650" value={form.intervalDays} onChange={event => updateField('intervalDays', event.target.value)} required /></div>
        </div>
        <div className="hc-field"><label htmlFor="care-rule-status">Trạng thái</label><select id="care-rule-status" value={form.status} onChange={event => updateField('status', event.target.value)}><option value="ACTIVE">Đang áp dụng</option><option value="INACTIVE">Tạm ngưng</option></select></div>
        <div className="hc-field"><label htmlFor="care-supply-search">SKU vật tư gợi ý (tối đa 10)</label><input id="care-supply-search" type="search" value={supplySearch} onChange={event => setSupplySearch(event.target.value)} placeholder="Tìm tên sản phẩm hoặc SKU" /></div>
        <div className="care-supply-picker" aria-label="Chọn SKU vật tư">
          {supplies.length ? supplies.map(item => <label key={item.variantId} className="care-supply-option"><input type="checkbox" checked={form.supplyVariantIds.includes(item.variantId)} onChange={() => toggleSupply(item.variantId)} disabled={!form.supplyVariantIds.includes(item.variantId) && form.supplyVariantIds.length >= 10} /><span><strong>{item.productName} · {item.variantName || item.sku}</strong><small>{item.sku} · {money(item.currentPrice)} · Tồn: {item.stockQuantity}</small></span></label>) : <span className="care-empty-inline">Không có SKU đang bán phù hợp.</span>}
        </div>
        {form.supplyVariantIds.length > 0 && <p className="care-empty-inline">Đã chọn {form.supplyVariantIds.length}/10 SKU{selectedSupplies.length < form.supplyVariantIds.length ? ' · SKU đang không khớp bộ lọc vẫn được giữ khi lưu.' : ''}</p>}
        <div className="care-admin-form__actions"><button type="submit" className="care-button" disabled={saving || loading}><Save size={16} aria-hidden="true" />{saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo quy tắc'}</button>{editingId ? <button type="button" className="care-button care-button--quiet" onClick={resetForm}><X size={16} aria-hidden="true" />Hủy sửa</button> : <button type="button" className="care-button care-button--quiet" onClick={() => { setForm(emptyForm()); setNotice(''); }}><Plus size={16} aria-hidden="true" />Làm trống</button>}</div>
      </form>
      <section className="care-rule-list" aria-label="Danh sách quy tắc bảo trì">
        <div className="care-toolbar"><h2>Quy tắc hiện có</h2><button type="button" className="care-button care-button--quiet" onClick={loadPage} disabled={loading}><RefreshCw size={15} aria-hidden="true" />Làm mới</button></div>
        {loading ? <div className="hc-card care-loading" role="status">Đang tải quy tắc…</div> : rules.length ? rules.map(rule => <article className="care-rule" key={rule.id}>
          <div className="care-rule__head"><div><h3>{rule.title}</h3><p>{rule.productId ? `Sản phẩm: ${rule.productName}` : `Danh mục: ${rule.categoryName}`} · {rule.firstDueDays} ngày đến chu kỳ đầu · mỗi {rule.intervalDays} ngày</p><p>Mã: <strong>{rule.ruleKey}</strong></p></div><span className={`care-rule__status${rule.status === 'ACTIVE' ? '' : ' care-rule__status--inactive'}`}>{rule.status === 'ACTIVE' ? 'Đang áp dụng' : 'Tạm ngưng'}</span></div>
          <p>{rule.instructions}</p>
          <div className="care-rule__supplies">Vật tư: {rule.supplies.length ? rule.supplies.map(item => `${item.productName} (${item.sku}) · tồn ${item.stockQuantity}`).join(' / ') : 'Chưa liên kết SKU.'}</div>
          <button type="button" className="care-button care-button--quiet" onClick={() => startEdit(rule)}><Pencil size={15} aria-hidden="true" />Chỉnh sửa</button>
        </article>) : <div className="hc-card care-empty"><h2>Chưa có quy tắc bảo trì</h2><p>Tạo quy tắc theo danh mục hoặc sản phẩm để áp dụng cho thiết bị được ghi nhận từ các đơn hoàn tất.</p></div>}
      </section>
    </div>
  </section>;
}
