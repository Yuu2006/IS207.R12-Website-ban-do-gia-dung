# Database

Migration đã có: `migrations/001_auth_profile.sql` cho schema CUS-01..05 trên database mới. Chưa chạy lên DB chung; API auth/profile hiện dùng mock. Xem `docs/database/AUTH-PROFILE.md` trước khi áp dụng, không import cùng baseline `database/schema_database.sql`.

Các migration/seed tiếp theo là kế hoạch, chưa phải file đã triển khai:
- `migrations/002_catalog.sql`
- `migrations/003_cart_order_payment.sql`
- `migrations/004_inventory_supplier.sql`
- `migrations/005_warranty_repair.sql`
- `migrations/006_reviews_notifications.sql`
- `migrations/007_reports_audit.sql`
- `seeds/001_roles.sql`
- `seeds/002_demo_data.sql`

Các transaction quan trọng: tạo đơn + order_items, xác nhận thanh toán, trừ/hoàn kho, nhập kho, linh kiện sửa chữa.
