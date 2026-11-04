# Database

Cập nhật 08/10/2026: baseline thực tế là `database/schema_database.sql` ở gốc repo. Các migration 001–007 từng liệt kê trong scaffold **chưa có**, không chạy các tên file giả định. Baseline vẫn chứa bảng phạm vi cũ; không triển khai các module đó và không xóa schema của đồng đội.

## Thứ tự dựng database mới (16/10/2026)

Compose chỉ mount `server/db` và MySQL không tự chạy file trong thư mục con, nên áp thủ công **một lần** trên database mới đã chọn:

1. `database/schema_database.sql` (baseline)
2. `migrations/008_product_attributes.sql`, `009_product_attribute_values.sql` (catalog — Lan Chi)
3. `migrations/008_order_runtime.sql` (đơn hàng — Tấn Vĩ)
4. `migrations/010_auth_profile.sql` (auth/hồ sơ — Tuấn Vũ: unique phone, ngày sinh, khóa đăng nhập tạm), rồi `migrations/011_auth_catalog_completion.sql` (thứ tự danh mục/banner, mô tả thương hiệu, bảng `auth_login_attempts`)
5. `seeds/001_auth_demo_users.sql`, `seeds/002_demo_data.sql`, `seeds/003_catalog_appliances.sql` (30 sản phẩm mô phỏng: 10 tủ lạnh, 10 máy giặt, 10 máy lạnh; tồn ban đầu ghi qua `inventory_movements`; chạy lại không cộng tồn)

Sau khi nhóm review schema HOME/FIT/TCO/LIFE/CARE, áp **một lần** `migrations/012_decision_tools.sql` lên database đã có các bảng `users`, `categories`, `products`, `product_variants`, `orders`, `order_items`. Migration thêm `room_profiles`, `fit_rules`, `care_rules`, `owned_devices`, `care_tasks`, `decision_events`; không sửa baseline hoặc dữ liệu cũ. Đây là schema đề xuất, chưa có API production và chưa được áp vào database chung. Xem [contract công cụ lựa chọn](../../docs/api/DECISION-TOOLS.md) và [định nghĩa dashboard cần TV2/TV3 duyệt](../../docs/api/DASHBOARD-METRICS.md). MySQL DDL có implicit commit; backup/review trước khi áp, không chạy lại nếu đã tạo bảng.

Ví dụ với Compose: `docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/schema_database.sql`, lặp lại theo thứ tự trên. Hai file đánh số 008 độc lập nhau; migration mới đánh số từ 012.

`seeds/001_auth_demo_users.sql` tạo 4 tài khoản demo (`customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`). Chỉ dùng cho môi trường demo.

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
