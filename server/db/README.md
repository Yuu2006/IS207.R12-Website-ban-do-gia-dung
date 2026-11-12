# Database

Cập nhật 08/10/2026: baseline thực tế là `database/schema_database.sql` ở gốc repo. Các migration 001–007 từng liệt kê trong scaffold **chưa có**, không chạy các tên file giả định. Baseline vẫn chứa bảng phạm vi cũ; không triển khai các module đó và không xóa schema của đồng đội.

## Thứ tự dựng database mới (16/10/2026)

Compose chỉ mount `server/db` và MySQL không tự chạy file trong thư mục con, nên áp thủ công **một lần** trên database mới đã chọn:

1. `database/schema_database.sql` (baseline)
2. `migrations/008_product_attributes.sql`, `009_product_attribute_values.sql` (catalog — Lan Chi)
3. `migrations/008_order_runtime.sql` (đơn hàng — Tấn Vĩ)
4. `migrations/010_auth_profile.sql` (auth/hồ sơ — Tuấn Vũ: unique phone, ngày sinh, khóa đăng nhập tạm), rồi `migrations/011_auth_catalog_completion.sql` (thứ tự danh mục/banner, mô tả thương hiệu, bảng `auth_login_attempts`)
5. `migrations/017_admin_user_management.sql` (sau migration 011; thêm metadata khóa tài khoản quản trị và index cho danh sách)
6. `migrations/012_decision_tools.sql` (sau review; HOME/FIT/TCO/LIFE/CARE, cần cho seed 010)
7. `migrations/013_fit_rule_versions.sql` (sau 012; version/audit quy tắc FitCheck)
8. `migrations/014_payment_ledger.sql` (version giỏ, voucher usage, expiry/metadata thanh toán, sổ cái và chứng từ; cần cho seed đơn/thanh toán)
9. `migrations/015_return_refund_reporting.sql` (quy trình duyệt trả hàng, ledger hoàn tiền mô phỏng và audit history; cần cho seed đầy đủ)
10. `migrations/016_care_rule_supplies.sql` (sau 012; liên kết quy tắc bảo trì với SKU vật tư)
11. `seeds/001_auth_demo_users.sql`, rồi `seeds/003_catalog_appliances.sql` đến `seeds/010_decision_tools.sql` (dữ liệu phát triển; bỏ qua `002_demo_data.sql` trừ khi cần dữ liệu cũ)

Sau khi nhóm review schema HOME/FIT/TCO/LIFE/CARE, áp **một lần** `migrations/012_decision_tools.sql` lên database đã có các bảng `users`, `categories`, `products`, `product_variants`, `orders`, `order_items`. Migration thêm `room_profiles`, `fit_rules`, `care_rules`, `owned_devices`, `care_tasks`, `decision_events`; không sửa baseline hoặc dữ liệu cũ. Sau 012, áp **một lần** `migrations/013_fit_rule_versions.sql` để bật CRUD rule quản trị và snapshot/audit theo version. Không áp 013 trước 012. Không migration nào trong hai file được tự chạy trên database chung; backup/review trước khi áp. Xem [contract công cụ lựa chọn](../../docs/api/DECISION-TOOLS.md) và [định nghĩa dashboard cần TV2/TV3 duyệt](../../docs/api/DASHBOARD-METRICS.md). MySQL DDL có implicit commit; không chạy lại nếu đã tạo bảng.

Sau khi review và áp 012, STT 24 cần áp tiếp `migrations/016_care_rule_supplies.sql` một lần để liên kết quy tắc bảo trì với SKU vật tư. Migration 016 không tạo lại hay thay đổi các bảng 012; chỉ thêm bảng nối `care_rule_supplies`. Chưa xác nhận 012/016 trên database local trong lần kiểm tra 06/11/2026; trạng thái database dùng chung chưa được kiểm tra. Không bật luồng hoàn tất đơn tạo thiết bị/lịch hoặc cấu hình SKU vật tư trước khi schema đã sẵn sàng.

STT 15 (chatbot): áp **một lần** `migrations/018_chatbot_faqs.sql` sau 011 để bật FAQ chatbot do ADMIN duyệt (`/admin/chatbot-faqs`). Migration chỉ tạo bảng `chatbot_faqs`, không seed nội dung chính sách; khi chưa áp, gợi ý sản phẩm vẫn chạy nhưng tin nhắn chatbot và trang FAQ trả lỗi 503/500. Dashboard `/admin/reports` (STT 16) không cần migration mới, chỉ cần 008/014/015 (và 012 cho số liệu FitCheck/TCO).

Ví dụ với Compose: `docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/schema_database.sql`, lặp lại theo thứ tự trên. Hai file đánh số 008 độc lập nhau; migration mới đánh số từ 012.

`seeds/001_auth_demo_users.sql` tạo 4 tài khoản phát triển (`customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`). Chỉ dùng cho database phát triển.

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
7. `E:\DoAnWeb\server\db\migrations\012_decision_tools.sql` (only after review/backup; creates HOME/FIT/TCO/LIFE/CARE tables)
8. `E:\DoAnWeb\server\db\migrations\013_fit_rule_versions.sql` (only after 012)
9. `E:\DoAnWeb\server\db\migrations\014_payment_ledger.sql` (review/backup first; required before enabling checkout and payments)
10. `E:\DoAnWeb\server\db\migrations\015_return_refund_reporting.sql` (review/backup first; required before enabling returns/refund CSV)
11. `E:\DoAnWeb\server\db\migrations\016_care_rule_supplies.sql` (only after 012; enables SKU links for maintenance rules)
12. `E:\DoAnWeb\server\db\seeds\001_auth_demo_users.sql` (optional accounts for development)
13. `E:\DoAnWeb\server\db\seeds\003_catalog_appliances.sql` through `010_decision_tools.sql` (development dataset; skip `002_demo_data.sql` unless legacy data is specifically needed)

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
CHECKOUT_SHIPPING_VND=30000
CHECKOUT_FREE_SHIPPING_MIN_VND=500000
```

`DB_HOST=db` chỉ dùng trong Docker, không dùng cho PHP chạy trực tiếp trên Windows. `start-api.ps1` đọc giá trị literal, có thể bao mật khẩu bằng dấu nháy; không thực thi nội dung `.env`, không in mật khẩu. File không hỗ trợ nội suy biến hoặc comment cuối dòng giá trị. Script không chạy migration. Chỉ dùng thông tin Sandbox của VNPay; endpoint IPN phải có thể truy cập công khai qua HTTPS khi thử callback thật. Không đưa TMN code/secret thật vào Git hoặc chat. Sau khi bật VNPay, lên lịch chạy `php server/commands/expire-vnpay-payments.php` mỗi phút để giải phóng tồn/voucher của phiên thanh toán quá 15 phút; lệnh chỉ xử lý DB đã cấu hình.

Chạy API bằng `powershell -NoProfile -File .\scripts\start-api.ps1` từ gốc repo sau khi đặt `PHP_BIN` hoặc có `php` trong PATH. Có thể truyền `-PhpBinary 'C:\...\php.exe'`. CLI cần PHP 8.3 với PDO MySQL; script tự nạp các DLL có sẵn cho PHP portable Windows, không cài extension hoặc thay cấu hình hệ thống. Runtime tải riêng tại `%LOCALAPPDATA%\HomeCareTools\php-8.3.36-1\php.exe` có thể dùng làm `PHP_BIN` trên máy phát triển này; ngoài repo, không cần commit. Khi tải PHP khác, dùng [nguồn chính thức](https://windows.php.net/download/) và kiểm tra SHA-256 của gói trước khi chạy.

Kiểm tra `http://localhost:8080/auth/me`: 200 có `user:null` khi chưa đăng nhập, không phải đăng nhập giả hoặc xác nhận DB sẵn sàng. Sau khi cấu hình DB, đăng ký/đăng nhập rồi mở `/orders`: chỉ thấy đơn của tài khoản đó. Runtime Task 3 hiện cần baseline và migrations `008_order_runtime.sql`, `013_checkout_runtime.sql`, `014_vnpay_runtime.sql`, `015_return_refund_reporting.sql`; migration 015 cũng thêm DTO trả hàng vào chi tiết đơn. VNPay cần đủ biến Sandbox. Cart write API và UI catalog-to-SKU đã được nối vào service/runtime; kiểm tra E2E vẫn đang làm vì test tích hợp cart hiện có lỗi. Không chạy migration tự động từ ứng dụng.

## Áp dụng module đơn hàng

Thanh toán/chứng từ mới: sau baseline và `008_order_runtime.sql`, áp một lần `014_payment_ledger.sql` trên DB đã review/backup. Migration thêm version giỏ, giới hạn voucher theo khách, snapshot cửa hàng, metadata/expiry payment, audit payment, chứng từ bất biến và lượt voucher; độc lập với 012/013. Không tự bật `ORDER_STORAGE_MODE=mysql` hoặc tự đặt phí/tài khoản ngân hàng. Xem [hướng dẫn thanh toán](../../docs/api/PAYMENT-LEDGER.md).

1. Team kiểm tra/backup database đích và xác nhận baseline đã được áp dụng. Không import lại baseline vào database đang có bảng/dữ liệu.
2. Review rồi chạy **một lần** `server/db/migrations/008_order_runtime.sql` trên database đã chọn. Migration thêm trường snapshot/version/inventory/audit và bảng idempotency/return request; không sửa baseline. Khi bật quy trình trả hàng, review và chạy tiếp `server/db/migrations/015_return_refund_reporting.sql` sau migrations 013/014. MySQL DDL có implicit commit, không giả định rollback DDL.
3. Đơn cũ mặc định `inventory_state=UNTRACKED`; không tự đặt RESERVED hoặc hoàn kho. Lịch sử cũ thiếu `actor_role` trả 503 ORDER_DATA_INCOMPATIBLE khi lấy detail, không suy diễn role từ tài khoản hiện tại. Cần owner xác minh lịch sử và timezone DATETIME cũ trước khi bật.
4. Sau review auth/schema, đặt `ORDER_STORAGE_MODE=mysql` trên API để bật đọc và xử lý đơn. PDO dùng native prepared statements, UTF-8 và UTC. Health chỉ báo cấu hình, `storageReady=false` không phải probe database/migration.
5. Checkout COD/hủy dùng `MysqlCheckoutDependencies`; migration `014_payment_ledger.sql` phải được review và chạy một lần trước khi bật. URL IPN `https://<public-api-host>/payments/vnpay/ipn` đăng ký trong cổng merchant VNPay, không cấu hình trong `.env`. Database từng áp `013_checkout_runtime`/`014_vnpay_runtime` của nhánh `users/le-tan-vi` (hai file đã bỏ khi tích hợp) sẽ lỗi trùng cột khi áp 014 mới: backup rồi dựng lại database phát triển đó. Cart write API và catalog-to-SKU mapping đã có trong runtime; kiểm tra cart integration hiện thất bại ở suite cô lập nên chưa nghiệm thu E2E. Mua lại thuộc STT 14; cần kiểm tra trạng thái endpoint thực tế trước khi ghi nhận hoàn tất. Không import adapter trong `server/tests/` vào HTTP.
6. Current order detail DTO, return queue/triage/decision/receipt and revenue CSV require migration `015_return_refund_reporting.sql`; SALES rejects `MINOR`, only `MAJOR`/`CRITICAL` reaches ADMIN, and WAREHOUSE inspection records one full-order simulated refund. No automatic stock restock or bank refund occurs. Apply migration 015 before enabling this version of order runtime.

Compose hiện chỉ mount `server/db` vào thư mục init, không tự import baseline ở `database/` và không tự chạy migration nằm trong thư mục con. Không sửa volume/reset DB để ép chạy init. `ORDER_STORAGE_MODE` đã được truyền cho container API, mặc định disabled.

## Kiểm thử cô lập

Từ gốc repo, cung cấp `PHP_BIN`, `PHP_EXTENSION_DIR` (PHP Windows cần pdo_mysql) và `MYSQLD_BIN`, rồi chạy `node server/tests/run-order-mysql-tests.mjs`. Runner tạo datadir mới ngoài repo, loopback/port ngẫu nhiên khác 3306, database `homecare_order_test_*`; áp baseline + migrations 008/013/014/015 cùng dữ liệu giả rồi dừng đúng instance đó. Không kết nối/reset service MySQL đang có. Sau khi dừng, runner xác minh đường dẫn rồi xóa đúng datadir test mới tạo; không để dump/database test trong repo.

`test_cart_versions` và adapter SQL là fixture kiểm thử, **không phải runtime production**. Runtime dùng `carts.version`, `voucher_usages` và migration 014; cart write API và catalog-to-SKU UI mapping đã được triển khai, nhưng test tích hợp cart đang lỗi. Phí giao hàng đã được Vĩ duyệt: 0₫ từ 500.000₫, thấp hơn thu 30.000₫. Kiểm tra chỉ đọc ngày 06/11/2026 thấy dấu hiệu schema của 008 và 013 trên database local; cần xác nhận đầy đủ trước khi dùng. Chưa xác nhận 014/015 trên local và chưa kiểm tra database dùng chung; review, backup và áp dụng migration còn thiếu trước khi bật VNPay/return workflow. Runner kiểm thử tự áp baseline cùng migrations 008, 013, 014 và 015 vào DB MySQL tạm riêng, không thay đổi database HomeCare của người dùng.
