import LowStockAlert from '../../components/admin/LowStockAlert.jsx';
import WorkspacePage from '../auth/WorkspacePage.jsx';

// Trang tổng quan ADMIN/WAREHOUSE: cảnh báo sắp hết hàng nổi bật phía trên, lối tắt chức năng bên dưới.
export default function WarehouseOverviewPage() {
  return <WorkspacePage><LowStockAlert /></WorkspacePage>;
}
