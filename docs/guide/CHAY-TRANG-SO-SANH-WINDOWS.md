# Chạy trang So sánh sau khi pull repo (Windows PowerShell)

Trang `/compare` lấy sản phẩm từ PHP API và MySQL. `git pull` chỉ tải mã nguồn và các file SQL; nó không tải `.env` hoặc dữ liệu trong Docker volume của máy khác. Hướng dẫn này dùng Vite chạy trên Windows, còn API và MySQL chạy bằng Docker Compose.

## 1. Chuẩn bị

- Cài Node.js/npm và Docker Desktop; mở Docker Desktop, đợi Docker Engine chạy.
- Mở PowerShell tại **thư mục gốc repo** (nơi có `docker-compose.yml`). Pull nhánh chứa thay đổi So sánh theo Git workflow của nhóm.
- Tạo cấu hình riêng nếu máy chưa có `.env`:

```powershell
Copy-Item .env.example .env
notepad .env
```

Trong `.env`, giữ `DB_HOST=db`, `DB_NAME=household_ecommerce` và `CLIENT_URL=http://localhost:5173`; tự đặt giá trị riêng cho `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`. Hai file seed dùng `USE household_ecommerce;`, nên nếu đổi `DB_NAME` phải sửa seed tương ứng trước khi nạp. Không đưa `.env` hoặc ảnh lộ mật khẩu lên Git/chat. Với Vite chạy riêng, API mặc định là `http://localhost:8080`; chỉ cần `client/.env.local` chứa `VITE_API_URL` khi muốn dùng địa chỉ API khác.

## 2. Khởi động API và MySQL

Từ thư mục gốc repo:

```powershell
docker compose up -d --build db api
docker compose ps
```

Chờ `db` và `api` hiện `Up`; API dùng cổng `8080`, MySQL dùng `3306`. Lệnh này không khởi động service `client` của Compose vì frontend sẽ chạy Vite trên Windows ở cổng `5173`.

## 3. Chỉ với database **mới, chưa có bảng**: nạp SQL một lần

Kiểm tra trước:

```powershell
'SHOW TABLES;' | docker compose exec -T db sh -c 'mysql -N -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

Nếu kết nối thành công và không hiện tên bảng (ngoài cảnh báo `Using a password on the command line`), chạy **nguyên khối** PowerShell sau. Nó chép từng file `.sql` vào container rồi để MySQL đọc **nội dung file**, giữ nguyên UTF-8. Danh sách và thứ tự theo [hướng dẫn database](../../server/db/README.md).

```powershell
$dbContainer = (docker compose ps -q db).Trim()
if (-not $dbContainer) { throw 'Không tìm thấy container db đang chạy' }

$tables = 'SHOW TABLES;' | docker compose exec -T db sh -c 'mysql -N -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
if ($LASTEXITCODE -ne 0) { throw 'Không kiểm tra được database; chưa nạp SQL' }
if ($tables) { throw 'Database đã có bảng; không nạp lại baseline hoặc seed' }

$sqlFiles = @(
  'database/schema_database.sql'
  'server/db/migrations/008_product_attributes.sql'
  'server/db/migrations/009_product_attribute_values.sql'
  'server/db/migrations/008_order_runtime.sql'
  'server/db/migrations/010_auth_profile.sql'
  'server/db/migrations/011_auth_catalog_completion.sql'
  'server/db/seeds/001_auth_demo_users.sql'
  'server/db/seeds/002_demo_data.sql'
  'server/db/seeds/003_catalog_appliances.sql'
)

foreach ($sqlFile in $sqlFiles) {
  if (-not (Test-Path -LiteralPath $sqlFile -PathType Leaf)) {
    throw "Không tìm thấy file: $sqlFile"
  }

  Write-Host "Đang nạp $sqlFile"
  docker cp $sqlFile "${dbContainer}:/tmp/is207-import.sql"
  if ($LASTEXITCODE -ne 0) { throw "Sao chép lỗi: $sqlFile" }

  docker compose exec -T db sh -c 'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < /tmp/is207-import.sql'
  if ($LASTEXITCODE -ne 0) { throw "Nạp lỗi tại $sqlFile; không chạy lại từ đầu" }
}
```

**Nếu database đã có bảng:** bỏ qua toàn bộ bước import. Không chạy lại baseline, không reset volume. Nếu import dừng giữa chừng, ghi lại tên file lỗi và kiểm tra trạng thái database trước khi chạy phần còn thiếu; chạy lại từ đầu có thể gây trùng bảng/dữ liệu. Bản sửa trang So sánh hiện tại không cần migration mới ngoài các file liệt kê trên.

## 4. Chạy frontend

Mở PowerShell khác tại thư mục gốc repo:

```powershell
cd client
npm.cmd ci
npm.cmd run dev
```

Giữ terminal Vite đang chạy. Dùng `npm.cmd` trên PowerShell nếu `npm.ps1` bị chặn bởi execution policy. Không mở `client/index.html` bằng Live Server: ứng dụng React cần Vite.

## 5. Kiểm tra

1. Mở `http://localhost:8080/api/products?is_active=1`. Phản hồi cần có `"success": true` và mảng `data` có sản phẩm. Nếu không có dữ liệu, kiểm tra seed trước khi thử trang web.
2. Mở `http://localhost:5173/compare`. Chọn hai sản phẩm cùng loại, thử **Thêm sản phẩm** để có ba/bốn cột; sản phẩm khác danh mục hoặc trùng không được chọn.
3. Kiểm tra bảo hành và thông số. Chưa có review thật thì dòng Đánh giá ghi “Chưa có đánh giá”. TCO là ước tính trên giao diện: nhập các giả định trong trang; thiếu khoản nào thì tổng chưa xuất hiện. API TCO chính thức chưa được triển khai.

## Khi vẫn báo lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| “Không thể kết nối máy chủ” | `docker compose ps`; nếu `api`/`db` không `Up`, xem `docker compose logs --tail=80 api db`. Xác nhận API trên cổng `8080`. |
| API trả lỗi database | Xem log API và xác nhận đã nạp baseline/migration trên **đúng** database. Không nạp lại toàn bộ vào database đã có bảng. |
| API thành công nhưng danh sách rỗng | Kiểm tra seed `002_demo_data.sql` và `003_catalog_appliances.sql` đã chạy; xác minh bảng `products` trước khi nạp thêm. |
| Trình duyệt báo CORS/403 | Mở frontend bằng đúng `http://localhost:5173` như `CLIENT_URL`; `127.0.0.1` là origin khác. Nếu đổi `CLIENT_URL`, tạo lại container API. |
| `vite` không được nhận diện | Chạy `npm.cmd ci` trong `client`, rồi `npm.cmd run dev`. |
| Bấm từ trang chi tiết mẫu nhưng sản phẩm không được chọn sẵn | Trang chủ/chi tiết hiện còn dữ liệu mẫu khác ID của catalog API; chọn lại sản phẩm từ danh sách trên `/compare`. Đây là vấn đề tích hợp dữ liệu, khác lỗi kết nối backend. |

Nếu đổi mật khẩu trong `.env` **sau lần khởi tạo volume MySQL đầu tiên**, MySQL không tự đổi mật khẩu tài khoản đã tạo. Cần đổi trong MySQL và `.env` đồng bộ; không xóa volume đang có dữ liệu để xử lý lỗi cấu hình.
