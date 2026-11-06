# Database — cài đặt, điền `.env` và kết nối

Hướng dẫn dựng MySQL cho dự án từ đầu. Chi tiết từng migration/seed nằm ở [`server/db/README.md`](../server/db/README.md); file này là đường đi ngắn nhất để có một database chạy được.

- Công cụ: **MySQL 8.4** (qua Docker Compose), tên database mặc định `household_ecommerce`.
- `database/schema_database.sql` là **baseline** — chỉ import một lần vào database trống, không sửa file này.

## 1. Chuẩn bị

Cần: Docker Desktop (đang chạy), Node.js 22 (để sinh ảnh seed), Git Bash hoặc PowerShell.

## 2. Điền file `.env`

Ở thư mục gốc repo:

```bash
cp .env.example .env
```

(PowerShell: `Copy-Item .env.example .env`.) **Không commit `.env`** (đã nằm trong `.gitignore`). Docker Compose đọc file này để tạo database và truyền biến cho API.

| Biến | Điền gì | Ghi chú |
| --- | --- | --- |
| `DB_HOST` | `db` | Tên service trong Compose. Nếu chạy API **ngoài** Docker, đổi thành `127.0.0.1` |
| `DB_PORT` | `3306` | Cổng bên trong container. Máy bạn cũng map ra `3306` (xem mục 6 nếu bị trùng) |
| `DB_NAME` | `household_ecommerce` | Các file seed có `USE household_ecommerce;` — đổi tên thì phải sửa theo |
| `DB_USER` | `app_user` | Compose tạo user này và cấp toàn quyền trên `DB_NAME` |
| `DB_PASSWORD` | đặt mật khẩu của bạn | Đừng giữ `change_me` khi đưa lên máy chủ |
| `DB_ROOT_PASSWORD` | đặt mật khẩu root riêng | Chỉ dùng để quản trị, khác `DB_PASSWORD` |
| `JWT_SECRET` | chuỗi ngẫu nhiên dài | Tạo nhanh: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_ENV` | `development` | `production` tắt mã khôi phục mật khẩu hiển thị trên trang |
| `APP_URL`, `CLIENT_URL` | `http://localhost:8080`, `http://localhost:5173` | `CLIENT_URL` dùng cho CORS, nhiều origin cách nhau bằng dấu phẩy |
| `VITE_API_URL` | `http://localhost:8080` | Địa chỉ API mà trình duyệt gọi |
| `VITE_ORDER_API_MODE` | `mock` | Giữ `mock` cho tới khi adapter checkout production hoàn tất |
| `ORDER_STORAGE_MODE` | `disabled` | Chỉ đổi sang `mysql` sau khi áp migration `008_order_runtime` và được nhóm review |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | lấy từ tài khoản VNPay Sandbox | Để trống nếu chưa test thanh toán; **không** chép khóa thật vào file commit |
| `VNPAY_RETURN_URL` | `http://localhost:5173/payment/result` | |
| `MAIL_*` | để trống | Chưa có luồng gửi email |

> Mật khẩu trong `.env` chỉ có hiệu lực **lần đầu** MySQL tạo volume. Đổi `DB_PASSWORD`/`DB_ROOT_PASSWORD` sau đó sẽ không đổi mật khẩu trong database đã tồn tại (xem mục 7).

## 3. Khởi động MySQL

```bash
docker compose up -d db
```

Chờ vài giây rồi kiểm tra:

```bash
docker compose exec db sh -c 'mysqladmin -uroot -p"$MYSQL_ROOT_PASSWORD" ping'
```

Kết quả `mysqld is alive` là sẵn sàng. Compose **không tự chạy** baseline, migration hay seed — làm ở mục 4.

## 4. Nạp schema, migration và dữ liệu

Chạy **đúng thứ tự**, mỗi file một lần trên database mới. Migration có `ALTER`/`CREATE TABLE` nên chạy lại lần hai sẽ báo lỗi `Duplicate column` / `already exists` (seed thì chạy lại được).

| # | File | Nội dung |
| --- | --- | --- |
| 1 | `database/schema_database.sql` | Baseline |
| 2 | `server/db/migrations/008_product_attributes.sql` | Thuộc tính sản phẩm |
| 3 | `server/db/migrations/009_product_attribute_values.sql` | Giá trị thuộc tính |
| 4 | `server/db/migrations/008_order_runtime.sql` | Đơn hàng |
| 5 | `server/db/migrations/010_auth_profile.sql` | Auth/hồ sơ |
| 6 | `server/db/migrations/011_auth_catalog_completion.sql` | Thứ tự danh mục/banner, login attempts |
| 7 | `server/db/migrations/012_decision_tools.sql` | Phòng, FitCheck, Care (cần cho seed 010) |
| 8 | `server/db/seeds/001_auth_demo_users.sql` | 4 tài khoản demo |
| 9 | `server/db/seeds/003`…`010` | Catalog, đơn hàng, voucher… (bỏ qua `002`, dữ liệu cũ lệch phạm vi) |

Git Bash (từ gốc repo):

```bash
for f in database/schema_database.sql \
  server/db/migrations/008_product_attributes.sql server/db/migrations/009_product_attribute_values.sql \
  server/db/migrations/008_order_runtime.sql server/db/migrations/010_auth_profile.sql \
  server/db/migrations/011_auth_catalog_completion.sql server/db/migrations/012_decision_tools.sql \
  server/db/seeds/001_auth_demo_users.sql server/db/seeds/003_catalog_appliances.sql \
  server/db/seeds/004_catalog_real_brands.sql server/db/seeds/005_catalog_media.sql \
  server/db/seeds/006_customers_addresses.sql server/db/seeds/007_vouchers.sql \
  server/db/seeds/008_orders_payments.sql server/db/seeds/009_reviews_audit.sql \
  server/db/seeds/010_decision_tools.sql; do
  echo "== $f"
  docker compose exec -T db sh -c 'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < "$f" || break
done
```

PowerShell (không dùng được toán tử `<`, truyền qua pipe):

```powershell
$files = @(
  'database/schema_database.sql',
  'server/db/migrations/008_product_attributes.sql', 'server/db/migrations/009_product_attribute_values.sql',
  'server/db/migrations/008_order_runtime.sql', 'server/db/migrations/010_auth_profile.sql',
  'server/db/migrations/011_auth_catalog_completion.sql', 'server/db/migrations/012_decision_tools.sql',
  'server/db/seeds/001_auth_demo_users.sql', 'server/db/seeds/003_catalog_appliances.sql',
  'server/db/seeds/004_catalog_real_brands.sql', 'server/db/seeds/005_catalog_media.sql',
  'server/db/seeds/006_customers_addresses.sql', 'server/db/seeds/007_vouchers.sql',
  'server/db/seeds/008_orders_payments.sql', 'server/db/seeds/009_reviews_audit.sql',
  'server/db/seeds/010_decision_tools.sql')
foreach ($f in $files) {
  Write-Host "== $f"
  Get-Content $f -Raw -Encoding utf8 | docker compose exec -T db sh -c 'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
  if ($LASTEXITCODE -ne 0) { break }
}
```

Dừng ngay khi một file lỗi; sửa nguyên nhân rồi nạp tiếp **từ file lỗi** (đừng chạy lại các migration đã xong).

### Ảnh sản phẩm

Seed `005` trỏ tới ảnh PNG trong `server/uploads/` (thư mục này bị `.gitignore`). Sinh ảnh một lần trên mỗi máy:

```bash
node scripts/generate-seed-data.mjs
```

Script cũng ghi lại `004`–`009` giống hệt bản đã commit (kết quả cố định). Nếu bạn sửa `scripts/seed-data/dataset.mjs` thì nạp lại các seed đó.

### Kiểm tra nhanh

```bash
docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) AS products FROM products; SELECT COUNT(*) AS orders FROM orders;"'
```

Sau khi nạp đủ phải có 60 sản phẩm và 48 đơn.

## 5. Chạy toàn bộ ứng dụng

```bash
docker compose up -d --build
```

- Web: http://localhost:5173
- API: http://localhost:8080
- Tài khoản demo (mật khẩu `Demo@1234567890!`): `customer@example.test`, `admin@example.test`, `sales@example.test`, `warehouse@example.test`. Chỉ dùng cho môi trường demo.

## 6. Kết nối bằng công cụ khác (DBeaver, MySQL Workbench, CLI)

| Tham số | Giá trị |
| --- | --- |
| Host | `127.0.0.1` (từ máy bạn) — chỉ trong Docker mới dùng `db` |
| Port | `3306` |
| Database | giá trị `DB_NAME` |
| User / Password | `DB_USER` / `DB_PASSWORD` (hoặc `root` / `DB_ROOT_PASSWORD`) |
| Charset | `utf8mb4` |

Từ dòng lệnh: `docker compose exec db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'`.

Nếu máy đã có MySQL khác chiếm cổng 3306, đổi dòng `"3306:3306"` của service `db` trong `docker-compose.yml` thành ví dụ `"3307:3306"` rồi kết nối bằng cổng `3307` (trong container API vẫn dùng `3306`).

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| `Access denied for user 'app_user'` | Mật khẩu trong `.env` khác mật khẩu lúc volume được tạo. Đặt lại `.env` cho khớp bản cũ, hoặc nhờ người phụ trách DB đổi mật khẩu bằng tài khoản root. **Không xóa volume khi chưa backup.** |
| `Unknown database 'household_ecommerce'` | `DB_NAME` trong `.env` khác tên bạn nạp; hoặc service `db` chưa khởi động xong. |
| `Duplicate column name` / `Table ... already exists` | Migration đã chạy rồi. Bỏ qua file đó, tiếp tục các file sau. |
| `Unknown column 'sort_order'`, `'from_status'`… khi nạp seed | Thiếu migration `011` / `008_order_runtime`. Kiểm tra thứ tự ở mục 4. |
| `Table 'fit_rules' doesn't exist` ở seed `010` | Chưa áp `012_decision_tools.sql`. |
| Tiếng Việt bị lỗi dấu | Thiếu `--default-character-set=utf8mb4` khi nạp; PowerShell cần `-Encoding utf8` như trên. |
| API báo `SQLSTATE[HY000] [2002]` | Sai `DB_HOST`: trong Docker phải là `db`; chạy API ngoài Docker phải là `127.0.0.1`. |
| Trang không hiện ảnh sản phẩm | Chưa chạy `node scripts/generate-seed-data.mjs` (mục 4). |

## 8. Làm lại từ đầu (chỉ khi chắc chắn)

Xóa dữ liệu là thao tác không hoàn tác và dự án cấm tự reset DB/volume. Chỉ làm trên máy cá nhân khi đã backup (`docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql`) và đã báo nhóm; sau đó thực hiện lại từ mục 3.
