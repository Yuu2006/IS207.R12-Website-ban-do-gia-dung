# Database

Đặt các file SQL theo thứ tự:
- `migrations/001_users_roles.sql`
- `migrations/002_catalog.sql`
- `migrations/003_cart_order_payment.sql`
- `migrations/004_inventory_supplier.sql`
- `migrations/005_warranty_repair.sql`
- `migrations/006_reviews_notifications.sql`
- `migrations/007_reports_audit.sql`
- `seeds/001_roles.sql`
- `seeds/002_demo_data.sql`

Các transaction quan trọng: tạo đơn + order_items, xác nhận thanh toán, trừ/hoàn kho, nhập kho, linh kiện sửa chữa.
