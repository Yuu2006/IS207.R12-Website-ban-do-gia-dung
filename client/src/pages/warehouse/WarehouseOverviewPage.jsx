import LowStockAlert from '../../components/admin/LowStockAlert.jsx';
import WorkspacePage from '../auth/WorkspacePage.jsx';

// Trang tổng quan ADMIN/WAREHOUSE: lối tắt chức năng kèm cảnh báo sắp hết hàng.
export default function WarehouseOverviewPage() {
  return <><WorkspacePage /><LowStockAlert /></>;
}
