# Database

Cập nhật 08/10/2026: baseline thực tế là `database/schema_database.sql` ở gốc repo. Các migration 001–007 từng liệt kê trong scaffold **chưa có**, không chạy các tên file giả định. Baseline vẫn chứa bảng phạm vi cũ; không triển khai các module đó và không xóa schema của đồng đội.

## Áp dụng module đơn hàng

1. Team kiểm tra/backup database đích và xác nhận baseline đã được áp dụng. Không import lại baseline vào database đang có bảng/dữ liệu.
2. Review rồi chạy **một lần** `server/db/migrations/008_order_runtime.sql` trên database đã chọn. Migration chỉ thêm trường snapshot/version/inventory/audit và bảng idempotency/return request; không sửa baseline. MySQL DDL có implicit commit, không giả định rollback DDL.
3. Đơn cũ mặc định `inventory_state=UNTRACKED`; không tự đặt RESERVED hoặc hoàn kho. Lịch sử cũ thiếu `actor_role` trả 503 ORDER_DATA_INCOMPATIBLE khi lấy detail, không suy diễn role từ tài khoản hiện tại. Cần owner xác minh lịch sử và timezone DATETIME cũ trước khi bật.
4. Sau review auth/schema, đặt `ORDER_STORAGE_MODE=mysql` trên API để bật đọc và xử lý đơn. PDO dùng native prepared statements, UTF-8 và UTC. Health chỉ báo cấu hình, `storageReady=false` không phải probe database/migration.
5. Checkout/hủy/mua lại cần adapter `CheckoutDependencies` được Tuấn Vũ/Lan Chi review. Chưa có adapter production thì trả 503, không import adapter trong `server/tests/` vào HTTP.

Compose hiện chỉ mount `server/db` vào thư mục init, không tự import baseline ở `database/` và không tự chạy migration nằm trong thư mục con. Không sửa volume/reset DB để ép chạy init. `ORDER_STORAGE_MODE` đã được truyền cho container API, mặc định disabled.

## Kiểm thử cô lập

Từ gốc repo, cung cấp `PHP_BIN`, `PHP_EXTENSION_DIR` (PHP Windows cần pdo_mysql) và `MYSQLD_BIN`, rồi chạy `node server/tests/run-order-mysql-tests.mjs`. Runner tạo datadir mới ngoài repo, loopback/port ngẫu nhiên khác 3306, database `homecare_order_test_*`; áp baseline + 008, dùng dữ liệu giả rồi dừng đúng instance đó. Không kết nối/reset service MySQL đang có. Sau khi dừng, runner xác minh đường dẫn rồi xóa đúng datadir test mới tạo; không để dump/database test trong repo.

`test_cart_versions` và adapter SQL là fixture kiểm thử, **không phải schema/API giỏ hàng production**. Voucher production, giá khuyến mãi theo thời gian và mua lại thật chưa tích hợp. Phí 0/30.000₫ theo ngưỡng 500.000₫ trong fixture chỉ là chính sách test, chờ team duyệt phí thật. Đã chạy trên MySQL 26.7.0; Compose dùng MySQL 8.4 nên cần chạy lại suite trên 8.4 trước nghiệm thu môi trường đó.
