import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import ProductAdmin from '../../../components/admin/ProductAdmin.jsx';
import ProductCard from '../../../components/ProductCard.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Toast } from '../../../components/ui/Toast.jsx';
import { useAdminProducts } from '../../../hooks/use-admin-products.js';
import { setProductActive } from '../../../services/product-service.js';
import AddProductDialog from './AddProductDialog.jsx';
import css from './ProductsTab.module.css';

// Phân trang phía giao diện: GET /api/products (quản trị) trả toàn bộ danh sách, chưa có page/page_size.
// Chọn phân trang thay vì "Tải thêm" vì số trang nằm trên URL, tải lại vẫn đúng trang. shortcut: đổi sang phân trang server khi catalog quá vài trăm sản phẩm.
const PAGE_SIZE = 12;
const statusOptions = [{ value: '', label: 'Tất cả trạng thái' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Ngừng hoạt động' }];
const statusToApi = { active: '1', inactive: '0' };

// Tab Sản phẩm: tìm kiếm + lọc lưu trên URL (?q=&category=&brand=&status=&page=), lưới ProductCard admin, thêm/sửa/ẩn-hiện.
export default function ProductsTab({ categoryOptions, brandOptions, adding }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const brand = params.get('brand') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const { items, error, loading, reload } = useAdminProducts({ keyword: q.trim(), category_id: category, brand_id: brand, is_active: statusToApi[status] ?? '' });

  const setFilter = patch => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries({ page: '', ...patch })) value ? next.set(key, value) : next.delete(key);
    return next;
  }, { replace: true });

  // Debounce 300ms cho ô tìm kiếm trước khi ghi lên URL.
  useEffect(() => {
    if (search === q) return undefined;
    const timer = setTimeout(() => setFilter({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSearch(q); }, [q]); // Xóa bộ lọc hoặc quay lại trang trước cũng cập nhật ô tìm kiếm.
  useEffect(() => { if (adding) setAddOpen(true); }, [adding]); // nút "Thêm sản phẩm" ở tiêu đề trang
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => { if (error) setToast({ tone: 'danger', title: 'Không tải được danh sách', message: `${error} Kiểm tra kết nối rồi bấm Thử lại.` }); }, [error]);

  const hasFilter = Boolean(q || category || brand || status);
  const pages = Math.max(1, Math.ceil((items?.length ?? 0) / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = (items ?? []).slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  async function toggle(item) {
    if (busyId) return;
    const next = Number(item.is_active) !== 1;
    setBusyId(item.id);
    try {
      await setProductActive(item, next);
      setToast({ tone: 'success', title: next ? 'Đã hiện sản phẩm. Khách có thể xem trên cửa hàng.' : 'Đã ẩn sản phẩm. Khách không còn thấy trên cửa hàng.' });
      reload();
    } catch (err) { setToast({ tone: 'danger', title: 'Không đổi được trạng thái', message: `${err.message} Thử lại sau ít phút.` }); }
    finally { setBusyId(null); }
  }

  function afterCreate() {
    setAddOpen(false); reload();
    setToast({ tone: 'success', title: 'Đã thêm sản phẩm. Bạn có thể xem trong danh sách.' });
  }
  function afterPartial(err) {
    setAddOpen(false); reload();
    setToast({ tone: 'warning', title: 'Sản phẩm đã tạo nhưng chưa đủ dữ liệu', message: `Bước ${err.partial.step} bị lỗi: ${err.message} Mở Sửa sản phẩm để bổ sung.` });
  }

  return <section className={css.tab} aria-label="Sản phẩm">
    <div className={css.toolbar} role="search">
      <Input className={css.search} icon="search" type="search" aria-label="Tìm sản phẩm" placeholder="Tìm theo tên hoặc mã sản phẩm" value={search} onChange={event => setSearch(event.target.value)} />
      <Button className={css.filterToggle} variant="outline" icon="filter" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(open => !open)}>Bộ lọc</Button>
      <div id="catalog-filters" className={`${css.filters}${filtersOpen ? ` ${css.open}` : ''}`}>
        <Select aria-label="Danh mục" value={category} options={[{ value: '', label: 'Tất cả danh mục' }, ...categoryOptions.map(([value, label]) => ({ value, label }))]} onChange={event => setFilter({ category: event.target.value })} />
        <Select aria-label="Thương hiệu" value={brand} options={[{ value: '', label: 'Tất cả thương hiệu' }, ...brandOptions.map(([value, label]) => ({ value, label }))]} onChange={event => setFilter({ brand: event.target.value })} />
        <Select aria-label="Trạng thái hoạt động" value={status} options={statusOptions} onChange={event => setFilter({ status: event.target.value })} />
        {hasFilter && <Button variant="ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Xóa bộ lọc</Button>}
      </div>
    </div>

    {loading && <ul className={css.grid} aria-busy="true" aria-label="Đang tải sản phẩm">{Array.from({ length: 8 }, (_, index) => <li key={index} className={css.skeleton} />)}</ul>}
    {error && <div className={css.state} role="alert"><Icon name="alert-circle" size={28} /><p>Không tải được danh sách sản phẩm.</p><Button variant="outline" onClick={reload}>Thử lại</Button></div>}
    {items?.length === 0 && <div className={css.state}><Icon name="package" size={28} /><p>{hasFilter ? 'Không có sản phẩm phù hợp với bộ lọc.' : 'Chưa có sản phẩm nào.'}</p>{hasFilter ? <Button variant="outline" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Xóa bộ lọc</Button> : <Button icon="plus" onClick={() => setAddOpen(true)}>Thêm sản phẩm</Button>}</div>}
    {items?.length > 0 && <>
      <ul className={css.grid}>{visible.map(item => <li key={item.id}><ProductCard mode="admin" product={item} busy={busyId === item.id} onEdit={() => setEditTarget({ ...item })} onToggleActive={toggle} /></li>)}</ul>
      <nav className={css.pager} aria-label="Phân trang sản phẩm">
        <span>{items.length} sản phẩm · Trang {current}/{pages}</span>
        <div><Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setFilter({ page: String(current - 1) })}>Trang trước</Button><Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setFilter({ page: String(current + 1) })}>Trang sau</Button></div>
      </nav>
    </>}

    {addOpen && <AddProductDialog categoryOptions={categoryOptions} brandOptions={brandOptions} onClose={() => setAddOpen(false)} onCreated={afterCreate} onPartial={afterPartial} />}
    {/* Sửa sản phẩm dùng lại hộp thoại quản lý sẵn có (SKU, ảnh, thông số); danh sách của nó bị tắt vì lưới ở trên thay thế. */}
    <ProductAdmin listless editTarget={editTarget} onChanged={reload} categoryOptions={categoryOptions} brandOptions={brandOptions} adding={0} />
    {/* Portal ra body: vùng tab có animation/transform làm position: fixed tính theo vùng đó chứ không theo cửa sổ. */}
    {toast && createPortal(<div className={css.toastHost}><Toast {...toast} onClose={() => setToast(null)} /></div>, document.body)}
  </section>;
}
