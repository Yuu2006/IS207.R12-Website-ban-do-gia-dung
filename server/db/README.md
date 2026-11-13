# Database

Baseline là `database/schema_database.sql` ở gốc repo; các thay đổi sau đó nằm trong `server/db/migrations/`, dữ liệu phát triển trong `server/db/seeds/`. Baseline còn chứa bảng phạm vi cũ (sửa chữa, kỹ thuật viên, nhà cung cấp…): giữ nguyên, không triển khai, không xóa. Sơ đồ quan hệ: [docs/database/ERD.md](../../docs/database/ERD.md). Catalog và kho: [docs/database/CATALOG-INVENTORY.md](../../docs/database/CATALOG-INVENTORY.md).

## Dựng hoặc nâng cấp database bằng script (khuyến nghị)

`server/db/setup.php` áp baseline, migration và seed theo đúng thứ tự, ghi từng file đã áp vào bảng `schema_migrations` (tên, checksum, thời điểm). Chạy lại không làm gì thêm. Với database cũ chưa có bảng này, script nhận ra phần đã áp qua dấu hiệu bảng/cột/index và chỉ **ghi sổ** (ADOPTED), không chạy lại.

| Lệnh | Tác dụng |
| --- | --- |
| `status` | Liệt kê từng migration/seed: đã áp, đã có trên DB nhưng chưa ghi sổ, CHƯA ÁP. Thoát mã 2 nếu còn migration chưa áp. |
| `migrate` | Ghi sổ phần đã có, áp phần còn thiếu theo thứ tự. |
| `seed` | Nạp seed phát triển (cần migrate xong trước). Seed 011 chỉ nạp nếu file có trên máy. |

An toàn:
- `--database=TEN` bắt buộc và phải trùng `DB_NAME`, tránh chạy nhầm database.
- Database đã có dữ liệu (tài khoản/sản phẩm/đơn) thì script từ chối áp cho đến khi bạn sao lưu và thêm `--backup-confirmed`.
- Script từ chối mọi câu `DROP DATABASE/TABLE`, `TRUNCATE`; không tự chạy khi app khởi động.
- MySQL DDL tự commit: nếu một file lỗi giữa chừng, script dừng và không ghi sổ file đó. Khôi phục từ bản sao lưu rồi chạy lại.

### Với Docker Compose

```bash
docker compose up -d
docker compose exec api sh -c 'php db/setup.php status --database="$DB_NAME"'
docker compose exec db sh -c 'mysqldump --no-tablespaces --single-transaction -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > backup-$(date +%Y%m%d).sql
docker compose exec api sh -c 'php db/setup.php migrate --database="$DB_NAME" --backup-confirmed'
docker compose exec api sh -c 'php db/setup.php seed --database="$DB_NAME"'
```

Container `api` mount `./database` (chỉ đọc) để đọc baseline. Không đưa file backup vào Git. Sau khi migrate, đặt `ORDER_STORAGE_MODE=mysql` trong `.env` rồi `docker compose up -d api` để bật giỏ hàng, đơn, wishlist, trả hàng.

### PHP chạy trực tiếp (Windows/macOS/Linux)

Đặt `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (tài khoản có quyền CREATE/ALTER/INDEX), rồi từ gốc repo:

```bash
php server/db/setup.php status --database=homecare_local
php server/db/setup.php migrate --database=homecare_local
php server/db/setup.php seed --database=homecare_local
```

PHP cần extension `pdo_mysql`. Sao lưu bằng `mysqldump` hoặc MySQL Workbench (Server → Data Export) trước khi `migrate` trên database đã có dữ liệu.

## Thứ tự áp dụng

Script dùng đúng thứ tự này; khi áp thủ công (Workbench, `mysql < file`) cũng giữ nguyên thứ tự và **mỗi file chỉ một lần**.

| # | File | Nội dung |
| --- | --- | --- |
| 1 | `database/schema_database.sql` | Baseline |
| 2 | `migrations/008_product_attributes.sql` | Thuộc tính động theo danh mục |
| 3 | `migrations/009_product_attribute_values.sql` | Giá trị thuộc tính của sản phẩm |
| 4 | `migrations/008_order_runtime.sql` | Snapshot/version/kho của đơn, idempotency, yêu cầu trả hàng (hai file 008 độc lập nhau) |
| 5 | `migrations/010_auth_profile.sql` | Unique phone, ngày sinh, khóa đăng nhập tạm |
| 6 | `migrations/011_auth_catalog_completion.sql` | Thứ tự danh mục/banner, mô tả thương hiệu, `auth_login_attempts` |
| 7 | `migrations/017_admin_user_management.sql` | ADMIN khóa/mở tài khoản (cần 011) |
| 8 | `migrations/012_decision_tools.sql` | Hồ sơ phòng, FitCheck, TCO, thiết bị và bảo trì, `decision_events` |
| 9 | `migrations/013_fit_rule_versions.sql` | Version/audit quy tắc FitCheck (cần 012) |
| 10 | `migrations/014_payment_ledger.sql` | Version giỏ, lượt voucher, giới hạn voucher theo khách, sổ cái và chứng từ thanh toán |
| 11 | `migrations/015_return_refund_reporting.sql` | Duyệt trả hàng, hoàn tiền mô phỏng, CSV doanh thu |
| 12 | `migrations/016_care_rule_supplies.sql` | SKU vật tư cho quy tắc bảo trì (cần 012) |
| 13 | `migrations/018_chatbot_faqs.sql` | FAQ chatbot do ADMIN duyệt |
| 14 | `migrations/019_wishlists.sql` | Danh sách yêu thích |
| 15 | `migrations/020_query_indexes.sql` | Index cho dashboard/CSV (đã kiểm bằng EXPLAIN) |

Seed (chỉ database phát triển): `001_auth_demo_users`, rồi `003` → `010`, và `011_catalog_real_images` nếu có. Bỏ qua `002_demo_data.sql` (dữ liệu cũ, không còn dùng). Seed 011 thay ảnh placeholder bằng URL ảnh model thật gần nhất (Điện Máy Xanh, chỉ cho demo); chạy sau 005 và không ghi đè ảnh admin đã tải lên.

`seeds/001_auth_demo_users.sql` tạo 4 tài khoản phát triển (`customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`). Không dùng trên production. Không cần seed để đăng ký tài khoản khách thật tại `/register`; DB chưa có đơn sẽ hiển thị trạng thái trống.

Migration mới đánh số từ **021** và phải được thêm vào `setupMigrations()` trong `setup.php` kèm dấu hiệu nhận biết (`probe`); `server/tests/db-setup.test.php` báo lỗi nếu có file migration chưa được liệt kê.

## Tạo database HomeCare mới trên Windows (không dùng Docker)

Chỉ làm khi **chưa có database HomeCare**. Đăng nhập MySQL Workbench bằng tài khoản quản trị MySQL của chính bạn; không reset mật khẩu root. Nếu tên dưới đây đã tồn tại, dừng lại kiểm tra, không DROP/TRUNCATE hoặc import lại baseline.

```sql
CREATE DATABASE homecare_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'homecare_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_YOUR_PRIVATE_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON homecare_local.* TO 'homecare_app'@'localhost';
```

Tài khoản `homecare_app` chỉ có quyền đọc/ghi dữ liệu; chạy `setup.php` (hoặc mở từng file theo bảng thứ tự trong Workbench) bằng tài khoản quản trị. Sau đó tạo `.env` ở gốc repo (không ghi đè secret có sẵn):

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

`DB_HOST=db` chỉ dùng trong Docker. Chạy API bằng `powershell -NoProfile -File .\scripts\start-api.ps1` từ gốc repo sau khi đặt `PHP_BIN` hoặc có `php` trong PATH (PHP 8.3 + PDO MySQL); script đọc giá trị `.env` dạng literal, không thực thi nội dung, không in mật khẩu và không chạy migration. Khi tải PHP, dùng [nguồn chính thức](https://windows.php.net/download/) và kiểm tra SHA-256.

Kiểm tra `http://localhost:8080/auth/me`: trả 200 với `user:null` khi chưa đăng nhập. Đăng nhập rồi mở `/orders`: chỉ thấy đơn của tài khoản đó.

## Ghi chú module đơn hàng và thanh toán

- `ORDER_STORAGE_MODE` mặc định `disabled`: giỏ hàng, đơn, wishlist, trả hàng trả 503 cho đến khi đặt `mysql`. Chỉ bật sau khi `setup.php status` báo schema đầy đủ.
- Đơn cũ mặc định `inventory_state=UNTRACKED`; hệ thống không tự đặt RESERVED hoặc hoàn kho. Lịch sử cũ thiếu `actor_role` trả 503 `ORDER_DATA_INCOMPATIBLE` khi xem chi tiết, không suy diễn role.
- Database từng áp `013_checkout_runtime`/`014_vnpay_runtime` của nhánh `users/le-tan-vi` (đã bỏ khi tích hợp) sẽ lỗi trùng cột khi áp 014 hiện tại: sao lưu rồi dựng lại database phát triển đó.
- Trả hàng: SALES từ chối mức `MINOR`, chỉ `MAJOR`/`CRITICAL` chuyển ADMIN duyệt; WAREHOUSE kiểm hàng xong ghi một khoản hoàn tiền mô phỏng cho cả đơn. Không tự nhập lại kho, không gọi ngân hàng.
- VNPay: chỉ dùng thông tin Sandbox; IPN `https://<public-api-host>/payments/vnpay/ipn` đăng ký trong cổng merchant, không đặt trong `.env`. Khi bật VNPay, chạy `php server/commands/expire-vnpay-payments.php` mỗi phút để giải phóng tồn/voucher của phiên thanh toán quá 15 phút. Xem [hướng dẫn thanh toán](../../docs/api/PAYMENT-LEDGER.md).
- Compose mount `server/db` vào `/docker-entrypoint-initdb.d`, nhưng MySQL chỉ chạy file `.sql` ở cấp trên cùng khi volume còn trống, nên migration/seed trong thư mục con **không** tự chạy. Dùng `setup.php`; không xóa volume để ép chạy init.

## Kiểm thử cô lập

- `php server/tests/db-setup.test.php`: kiểm bộ tách câu SQL và việc mọi file migration đều có trong `setup.php`. Không cần DB.
- `node server/tests/run-order-mysql-tests.mjs` (cần `PHP_BIN`, `PHP_EXTENSION_DIR` với pdo_mysql/mbstring, `MYSQLD_BIN`): tạo datadir MySQL mới ngoài repo trên cổng ngẫu nhiên khác 3306, áp baseline và migration cần cho từng bộ test (đơn, thanh toán, TCO, bảo trì, chatbot, dashboard, wishlist), rồi dừng và xóa đúng datadir đó. Không kết nối hay reset MySQL đang chạy.
- `test_cart_versions` và adapter SQL trong `server/tests/` chỉ là fixture kiểm thử, không dùng ở runtime.
