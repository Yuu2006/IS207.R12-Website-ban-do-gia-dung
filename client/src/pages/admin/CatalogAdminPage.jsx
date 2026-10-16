import { useEffect, useState } from 'react';
import ProductAdmin from '../../components/admin/ProductAdmin.jsx';
import SimpleCrud from '../../components/admin/SimpleCrud.jsx';
import { banners, brands, categories } from '../../services/catalog-service.js';

const active = item => Number(item.is_active) ? 'Đang dùng' : 'Tạm ẩn';
const nullable = value => value === '' ? null : value;
// datetime-local 'YYYY-MM-DDTHH:MM' → 'YYYY-MM-DD HH:MM:SS' theo validation banner của PHP.
const toSql = value => value ? `${value.replace('T', ' ')}:00`.slice(0, 19) : null;
const sortField = { name: 'sort_order', label: 'Thứ tự hiển thị (nhỏ đứng trước)', type: 'number', inputMode: 'numeric' };
const sortValue = value => Number(value) || 0;
const tabs = [['products', 'Sản phẩm & SKU'], ['categories', 'Danh mục'], ['brands', 'Thương hiệu'], ['banners', 'Banner']];

// Task 12 (PRD-01..06, ADM-PRO-02/03): quản trị catalog bằng API thật, chỉ ADMIN (route guard + PHP).
export default function CatalogAdminPage() {
  const [tab, setTab] = useState('products');
  const [options, setOptions] = useState({ categories: [], rootCategories: [], brands: [] });
  const [version, setVersion] = useState(0);

  useEffect(() => { document.title = 'Quản trị catalog · HomeCare'; }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([categories.list(), brands.list()]).then(([categoryRows, brandRows]) => {
      if (alive) setOptions({ categories: categoryRows.map(row => [String(row.id), row.name]), rootCategories: categoryRows.filter(row => row.parent_id === null).map(row => [String(row.id), row.name]), brands: brandRows.map(row => [String(row.id), row.name]) });
    }).catch(() => {}); // Lỗi hiển thị trong từng tab khi tải danh sách.
    return () => { alive = false; };
  }, [version]);

  function select(next) { setTab(next); setVersion(current => current + 1); }

  return <section><div className="hc-page-heading"><span className="hc-eyebrow">Quản trị viên</span><h1>Catalog sản phẩm</h1><p>Danh mục, thương hiệu, sản phẩm, SKU, giá khuyến mãi, thông số, ảnh và banner. Ngừng dùng là xóa mềm, không mất lịch sử đơn.</p></div>
    <div className="hc-tabs" role="tablist" aria-label="Nhóm dữ liệu catalog">{tabs.map(([key, label]) => <button key={key} id={`tab-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} className={tab === key ? 'is-active' : ''} onClick={() => select(key)}>{label}</button>)}</div>
    <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === 'products' && <ProductAdmin categoryOptions={options.categories} brandOptions={options.brands} />}
      {tab === 'categories' && <SimpleCrud title="Danh mục" service={categories} empty="Chưa có danh mục."
        fields={[{ name: 'name', label: 'Tên danh mục', required: true, maxLength: 150 }, { name: 'slug', label: 'Slug (vd: tu-lanh)', required: true, maxLength: 180 }, { name: 'parent_id', label: 'Danh mục cha (chỉ chọn danh mục gốc — tối đa 2 cấp)', type: 'select', options: options.rootCategories, placeholder: 'Không có' }, sortField, { name: 'is_active', label: 'Đang dùng', type: 'checkbox' }]}
        columns={[['name', 'Tên'], ['slug', 'Slug'], ['parent_id', 'Danh mục cha', item => options.categories.find(([id]) => id === String(item.parent_id))?.[1] || '—'], ['sort_order', 'Thứ tự'], ['is_active', 'Trạng thái', active]]}
        toPayload={values => ({ ...values, parent_id: nullable(values.parent_id), sort_order: sortValue(values.sort_order), is_active: values.is_active ? 1 : 0 })} />}
      {tab === 'brands' && <SimpleCrud title="Thương hiệu" service={brands} empty="Chưa có thương hiệu."
        fields={[{ name: 'name', label: 'Tên thương hiệu', required: true, maxLength: 150 }, { name: 'logo_url', label: 'Logo', type: 'image', uploadType: 'brands' }, { name: 'description', label: 'Mô tả', type: 'textarea', maxLength: 1000 }, { name: 'is_active', label: 'Đang dùng', type: 'checkbox' }]}
        columns={[['name', 'Tên'], ['logo_url', 'Logo', item => item.logo_url ? <img className="hc-thumb" src={item.logo_url} alt="" /> : '—'], ['description', 'Mô tả', item => item.description || '—'], ['is_active', 'Trạng thái', active]]}
        toPayload={values => ({ ...values, is_active: values.is_active ? 1 : 0 })} />}
      {tab === 'banners' && <SimpleCrud title="Banner" service={banners} empty="Chưa có banner."
        fields={[{ name: 'title', label: 'Tiêu đề', required: true, maxLength: 150 }, { name: 'image_url', label: 'Ảnh banner', type: 'image', uploadType: 'banners', required: true }, { name: 'target_url', label: 'Liên kết đích (https://…)', type: 'url', maxLength: 500 }, { name: 'starts_at', label: 'Hiển thị từ', type: 'datetime-local' }, { name: 'ends_at', label: 'Hiển thị đến', type: 'datetime-local' }, sortField, { name: 'is_active', label: 'Đang dùng', type: 'checkbox' }]}
        columns={[['title', 'Tiêu đề'], ['image_url', 'Ảnh', item => <img className="hc-thumb" src={item.image_url} alt="" />], ['starts_at', 'Thời gian', item => `${item.starts_at?.slice(0, 16) || '…'} → ${item.ends_at?.slice(0, 16) || '…'}`], ['sort_order', 'Thứ tự'], ['is_active', 'Trạng thái', active]]}
        toPayload={values => ({ ...values, target_url: values.target_url || '', starts_at: toSql(values.starts_at), ends_at: toSql(values.ends_at), sort_order: sortValue(values.sort_order), is_active: values.is_active ? 1 : 0 })} />}
    </div>
  </section>;
}
