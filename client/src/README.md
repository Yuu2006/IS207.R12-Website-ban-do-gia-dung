# Frontend module map

## Customer
Home, Catalog, ProductDetail, Wishlist, Cart, Checkout, OrderHistory, OrderDetail, WarrantyLookup, RepairRequest, RepairTracking, Notifications, Profile.

Đã có CUS-01..05 ở mức demo: shell bốn role, `/login`, `/register`, `/internal/login`, `/profile`, `/addresses`; demo accounts và session dùng chung. Profile/Address CRUD qua `services/user-service.js`; chọn mock/API qua `VITE_AUTH_DEMO`. Route theo role nằm trong `routes/AppRoutes.jsx`, guard trong `routes/ProtectedRoute.jsx`. Chi tiết contract/mức hoàn thành: `docs/api/AUTH-PROFILE.md`.

## Admin
Dashboard, Products, Categories, Brands, Variants, Attributes, Promotions, Users/RBAC, Reviews, Reports, RepairManagement, Warranty, AuditLogs.

## Sales
Orders, OrderDetail, Cancellation, ReturnRefund.

## Warehouse
Inventory, StockAlerts, GoodsReceipts, StockOut, StockReturn, StockHistory, Suppliers.

## Technician
Workboard, Appointment, RepairDetail, Diagnosis, SpareParts, RepairCompletion.
