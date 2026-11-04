# Database

Cập nhật 08/10/2026: baseline thực tế là `database/schema_database.sql` ở gốc repo. Các migration 001–007 từng liệt kê trong scaffold **chưa có**, không chạy các tên file giả định. Baseline vẫn chứa bảng phạm vi cũ; không triển khai các module đó và không xóa schema của đồng đội.

## Thứ tự dựng database mới (16/10/2026)

Compose chỉ mount `server/db` và MySQL không tự chạy file trong thư mục con, nên áp thủ công **một lần** trên database mới đã chọn:

1. `database/schema_database.sql` (baseline)
2. `migrations/008_product_attributes.sql`, `009_product_attribute_values.sql` (catalog — Lan Chi)
3. `migrations/008_order_runtime.sql` (đơn hàng — Tấn Vĩ)
4. `migrations/010_auth_profile.sql` (auth/hồ sơ — Tuấn Vũ: unique phone, ngày sinh, khóa đăng nhập tạm), rồi `migrations/011_auth_catalog_completion.sql` (thứ tự danh mục/banner, mô tả thương hiệu, bảng `auth_login_attempts`)
5. `migrations/013_checkout_runtime.sql` (cart version và voucher redemption ledger)
6. `migrations/014_vnpay_runtime.sql` (VNPay expiry and callback fields; apply only when enabling Task 29)
7. `migrations/015_return_refund_reporting.sql` (quy trình duyệt trả hàng, ledger hoàn tiền mô phỏng và audit history; apply only when enabling Task 30)
8. `seeds/001_auth_demo_users.sql`, `seeds/002_demo_data.sql`, `seeds/003_catalog_appliances.sql` (30 sản phẩm mô phỏng: 10 tủ lạnh, 10 máy giặt, 10 máy lạnh; tồn ban đầu ghi qua `inventory_movements`; chạy lại không cộng tồn)

Sau khi nhóm review schema HOME/FIT/TCO/LIFE/CARE, áp **một lần** `migrations/012_decision_tools.sql` lên database đã có các bảng `users`, `categories`, `products`, `product_variants`, `orders`, `order_items`. Migration thêm `room_profiles`, `fit_rules`, `care_rules`, `owned_devices`, `care_tasks`, `decision_events`; không sửa baseline hoặc dữ liệu cũ. Endpoint TCO trong branch `users/le-tan-vi` cần bảng `decision_events`; nếu migration chưa áp, API trả lỗi dịch vụ dữ liệu chưa sẵn sàng. Migration 012 chưa được áp vào DB local/chung. Xem [contract công cụ lựa chọn](../../docs/api/DECISION-TOOLS.md) và [định nghĩa dashboard cần TV2/TV3 duyệt](../../docs/api/DASHBOARD-METRICS.md). MySQL DDL có implicit commit; backup/review trước khi áp, không chạy lại nếu đã tạo bảng.

Ví dụ với Compose: `docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/schema_database.sql`, lặp lại theo thứ tự trên. Hai file đánh số 008 độc lập nhau; migration mới đánh số từ 012.

`seeds/001_auth_demo_users.sql` tạo 4 tài khoản demo (`customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`). Chỉ dùng cho môi trường demo.

## Tạo database HomeCare mới trên Windows

Chỉ thực hiện phần này khi **chưa có database HomeCare**. Đăng nhập MySQL Workbench bằng tài khoản quản trị MySQL của chính bạn; không thay đổi/reset mật khẩu root. Nếu tên bên dưới đã tồn tại, dừng lại kiểm tra, không DROP/TRUNCATE hoặc import lại baseline.

Chạy lần lượt trong SQL tab (thay mật khẩu mẫu trước khi chạy, không đưa mật khẩu thật vào Git/chat):

```sql
CREATE DATABASE homecare_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'homecare_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_YOUR_PRIVATE_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON homecare_local.* TO 'homecare_app'@'localhost';
USE homecare_local;
```

Vẫn dùng tài khoản quản trị để áp schema. Trong Workbench chọn `homecare_local` làm default schema, **File → Open SQL Script**, mở/chạy từng file theo thứ tự:

1. `E:\DoAnWeb\database\schema_database.sql`
2. `E:\DoAnWeb\server\db\migrations\008_product_attributes.sql`
3. `E:\DoAnWeb\server\db\migrations\009_product_attribute_values.sql`
4. `E:\DoAnWeb\server\db\migrations\008_order_runtime.sql`
5. `E:\DoAnWeb\server\db\migrations\010_auth_profile.sql`
6. `E:\DoAnWeb\server\db\migrations\011_auth_catalog_completion.sql`
7. `E:\DoAnWeb\server\db\migrations\013_checkout_runtime.sql`
8. `E:\DoAnWeb\server\db\migrations\014_vnpay_runtime.sql` (review/backup first; required before enabling VNPay)
9. `E:\DoAnWeb\server\db\migrations\015_return_refund_reporting.sql` (review/backup first; required before enabling returns/refund CSV)

Không cần seed để đăng ký tài khoản CUSTOMER thật tại `/register`. Seed là tùy chọn chỉ cho DB phát triển riêng (thứ tự ở đầu tài liệu), không đưa tài khoản/mật khẩu seed lên production. DB mới chưa có đơn sẽ hiển thị empty state, không tự sinh đơn mẫu.

Tạo `E:\DoAnWeb\.env` (hoặc sửa file có sẵn, không ghi đè secret):

```dotenv
APP_ENV=development
CLIENT_URL=http://localhost:5173,http://127.0.0.1:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=homecare_local
DB_USER=homecare_app
DB_PASSWORD=REPLACE_WITH_YOUR_PRIVATE_PASSWORD
ORDER_STORAGE_MODE=mysql
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_RETURN_URL=http://localhost:5173/orders/payment-return
VNPAY_IPN_URL=https://<public-api-host>/payments/vnpay/ipn
```

`DB_HOST=db` chỉ dùng trong Docker, không dùng cho PHP chạy trực tiếp trên Windows. `start-api.ps1` đọc giá trị literal, có thể bao mật khẩu bằng dấu nháy; không thực thi nội dung `.env`, không in mật khẩu. File không hỗ trợ nội suy biến hoặc comment cuối dòng giá trị. Script không chạy migration. Chỉ dùng thông tin Sandbox của VNPay; endpoint IPN phải có thể truy cập công khai qua HTTPS khi thử callback thật. Không đưa TMN code/secret thật vào Git hoặc chat. Sau khi bật VNPay, lên lịch chạy `php server/commands/expire-vnpay-payments.php` mỗi phút để giải phóng tồn/voucher của phiên thanh toán quá 15 phút; lệnh chỉ xử lý DB đã cấu hình.

Chạy API bằng `powershell -NoProfile -File .\scripts\start-api.ps1` từ gốc repo sau khi đặt `PHP_BIN` hoặc có `php` trong PATH. Có thể truyền `-PhpBinary 'C:\...\php.exe'`. CLI cần PHP 8.3 với PDO MySQL; script tự nạp các DLL có sẵn cho PHP portable Windows, không cài extension hoặc thay cấu hình hệ thống. Runtime tải riêng tại `%LOCALAPPDATA%\HomeCareTools\php-8.3.36-1\php.exe` có thể dùng làm `PHP_BIN` trên máy phát triển này; ngoài repo, không cần commit. Khi tải PHP khác, dùng [nguồn chính thức](https://windows.php.net/download/) và kiểm tra SHA-256 của gói trước khi chạy.

Kiểm tra `http://localhost:8080/auth/me`: 200 có `user:null` khi chưa đăng nhập, không phải đăng nhập giả hoặc xác nhận DB sẵn sàng. Sau khi cấu hình DB, đăng ký/đăng nhập rồi mở `/orders`: chỉ thấy đơn của tài khoản đó. Runtime Task 3 hiện cần baseline và migrations `008_order_runtime.sql`, `013_checkout_runtime.sql`, `014_vnpay_runtime.sql`, `015_return_refund_reporting.sql`; migration 015 cũng thêm DTO trả hàng vào chi tiết đơn. VNPay cần đủ biến Sandbox. Checkout COD/VNPay dùng adapter MySQL; API ghi giỏ và UI catalog map SKU thật vẫn cần owner tích hợp. Không chạy migration tự động từ ứng dụng.

## Áp dụng module đơn hàng

1. Team kiểm tra/backup database đích và xác nhận baseline đã được áp dụng. Không import lại baseline vào database đang có bảng/dữ liệu.
2. Review rồi chạy **một lần** `server/db/migrations/008_order_runtime.sql` trên database đã chọn. Migration thêm trường snapshot/version/inventory/audit và bảng idempotency/return request; không sửa baseline. Khi bật quy trình trả hàng, review và chạy tiếp `server/db/migrations/015_return_refund_reporting.sql` sau migrations 013/014. MySQL DDL có implicit commit, không giả định rollback DDL.
3. Đơn cũ mặc định `inventory_state=UNTRACKED`; không tự đặt RESERVED hoặc hoàn kho. Lịch sử cũ thiếu `actor_role` trả 503 ORDER_DATA_INCOMPATIBLE khi lấy detail, không suy diễn role từ tài khoản hiện tại. Cần owner xác minh lịch sử và timezone DATETIME cũ trước khi bật.
4. Sau review auth/schema, đặt `ORDER_STORAGE_MODE=mysql` trên API để bật đọc và xử lý đơn. PDO dùng native prepared statements, UTF-8 và UTC. Health chỉ báo cấu hình, `storageReady=false` không phải probe database/migration.
5. Checkout COD/hủy dùng `MysqlCheckoutDependencies`; migration `013_checkout_runtime.sql` phải được review và chạy một lần trước khi bật. Cart write API/catalog-to-SKU mapping của Tuấn Vũ/Lan Chi vẫn cần được tích hợp. Mua lại thuộc STT 14 và hiện trả 503. Không import adapter trong `server/tests/` vào HTTP.
6. Current order detail DTO, return queue/triage/decision/receipt and revenue CSV require migration `015_return_refund_reporting.sql`; SALES rejects `MINOR`, only `MAJOR`/`CRITICAL` reaches ADMIN, and WAREHOUSE inspection records one full-order simulated refund. No automatic stock restock or bank refund occurs. Apply migration 015 before enabling this version of order runtime.

Compose hiện chỉ mount `server/db` vào thư mục init, không tự import baseline ở `database/` và không tự chạy migration nằm trong thư mục con. Không sửa volume/reset DB để ép chạy init. `ORDER_STORAGE_MODE` đã được truyền cho container API, mặc định disabled.

## Kiểm thử cô lập

Từ gốc repo, cung cấp `PHP_BIN`, `PHP_EXTENSION_DIR` (PHP Windows cần pdo_mysql) và `MYSQLD_BIN`, rồi chạy `node server/tests/run-order-mysql-tests.mjs`. Runner tạo datadir mới ngoài repo, loopback/port ngẫu nhiên khác 3306, database `homecare_order_test_*`; áp baseline + migrations 008/013/014/015 cùng dữ liệu giả rồi dừng đúng instance đó. Không kết nối/reset service MySQL đang có. Sau khi dừng, runner xác minh đường dẫn rồi xóa đúng datadir test mới tạo; không để dump/database test trong repo.

`test_cart_versions` và adapter SQL là fixture kiểm thử, **không phải runtime production**. Runtime dùng `carts.cart_version`, voucher ledger và migrations 013/014; cart write API và catalog-to-SKU UI mapping chưa tích hợp. Phí giao hàng đã được Vĩ duyệt: 0₫ từ 500.000₫, thấp hơn thu 30.000₫. Migrations 013/014/015 chưa được áp vào database local/chung; cần owner review, backup và chạy một lần trên DB dev trước khi bật checkout/VNPay/return workflow. Runner kiểm thử tự áp baseline cùng migrations 008, 013, 014 và 015 vào DB MySQL tạm riêng, không thay đổi database HomeCare của người dùng.
