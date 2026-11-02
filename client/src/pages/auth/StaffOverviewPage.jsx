import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LowStockAlert from '../../components/admin/LowStockAlert.jsx';
import { roleLabels, useAuth } from '../../context/auth-context.js';

// [đường dẫn, nhãn, nút chính, chưa triển khai]; chỉ liên kết tới route đã có.
const stock = ['Kho', [['/warehouse/inventory?form=stock-in', 'Nhập kho', true], ['/warehouse/inventory?form=stock-out', 'Xuất kho'], ['/warehouse/inventory?form=stock-adjust', 'Kiểm kê tồn kho'], ['/warehouse/inventory', 'Tồn kho'], ['/warehouse/history', 'Nhật ký kho']]];
const groups = {
  ADMIN: [['Sản phẩm', [['/admin/products', 'Catalog sản phẩm', true]]], stock, ['Người dùng', [['/admin/users', 'Quản lý người dùng', false, true]]], ['Voucher', [['/admin/vouchers', 'Quản lý voucher', false, true]]], ['Báo cáo', [['/admin/reports', 'Dashboard và báo cáo', false, true]]]],
  WAREHOUSE: [stock],
  SALES: [['Đơn hàng', [['/sales/orders', 'Xử lý đơn hàng', true], ['/sales/returns', 'Trả hàng / hoàn tiền', false, true]]]],
};

// Tổng quan ADMIN/WAREHOUSE/SALES: nhóm chức năng theo vai trò; ADMIN và WAREHOUSE thấy thêm cảnh báo tồn kho.
export default function StaffOverviewPage() {
  const { user } = useAuth();
  useEffect(() => { document.title = 'Tổng quan · HomeCare'; }, []);
  return <section><div className="hc-page-heading"><span className="hc-eyebrow">{roleLabels[user.role]}</span><h1>Chào {user.fullName}</h1><p>Chọn nhóm chức năng cần làm việc hôm nay.</p></div>
    {user.role !== 'SALES' && <LowStockAlert />}
    <div className="hc-grps">{groups[user.role].map(([title, links]) => <section className="hc-grp" key={title}><h2>{title}</h2><div className="hc-grp-row">{links.map(([to, label, primary, soon]) => <Link key={to} to={to} className={`hc-button${primary ? '' : ' hc-button--outline'}`}>{label}{soon && <span className="hc-soon">Chưa triển khai</span>}</Link>)}</div></section>)}</div>
  </section>;
}
