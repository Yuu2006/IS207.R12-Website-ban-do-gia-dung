# Frontend module map

## Customer
Home, Catalog, ProductDetail, Wishlist, Cart, Checkout, OrderHistory, OrderDetail, WarrantyLookup, RepairRequest, RepairTracking, Notifications, Profile.

Đã có CUS-01..05 chạy API thật: shell bốn role, `/login`, `/register`, `/forgot-password`, `/internal/login`, `/profile`, `/addresses`; một phiên dùng chung (`context/AuthContext.jsx`). Auth qua `services/auth-service.js`, hồ sơ/địa chỉ qua `services/user-service.js`, validation form ở `utils/account-validation.js`. Route theo role nằm trong `routes/AppRoutes.jsx`, guard trong `routes/ProtectedRoute.jsx`. Chi tiết contract/mức hoàn thành: `docs/api/AUTH-PROFILE.md`.

## Admin
Dashboard, Products, Categories, Brands, Variants, Attributes, Promotions, Users/RBAC, Reviews, Reports, RepairManagement, Warranty, AuditLogs.

## Sales
Orders, OrderDetail, Cancellation, ReturnRefund.

## Warehouse
Inventory, StockAlerts, GoodsReceipts, StockOut, StockReturn, StockHistory, Suppliers.

## Technician
Workboard, Appointment, RepairDetail, Diagnosis, SpareParts, RepairCompletion.
