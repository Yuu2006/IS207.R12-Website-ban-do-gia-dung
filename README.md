# IS207.R12 - Website bán đồ gia dụng

Đồ án môn **Phát triển ứng dụng Web - IS207.R12**: website thương mại điện tử bán đồ gia dụng. Repository được tổ chức theo tinh thần repo mẫu `versenilvis/IS207-UIT`, điều chỉnh cho stack **ReactJS + PHP + MySQL** và các module nghiệp vụ trong đặc tả của nhóm.

## Công nghệ
- Frontend: ReactJS (Vite)
- Backend: PHP REST API
- Database: MySQL
- Payment: VNPay
- Deployment/dev: Docker Compose

## Cấu trúc chính

```text
.
├── client/                # React frontend
├── server/                # PHP REST API
├── docs/                  # Tài liệu, ERD, Use Case, API, kế hoạch
├── scripts/               # Script setup/import/export
├── task/                  # Chia task thành viên
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

### Frontend (`client/src`)
- `pages/customer`: trang chủ, sản phẩm, giỏ hàng, checkout, đơn hàng, bảo hành, sửa chữa...
- `pages/admin`: dashboard, sản phẩm, voucher, user/RBAC, review, báo cáo, audit log...
- `pages/sales`: xử lý đơn, hủy đơn, trả hàng/hoàn tiền.
- `pages/warehouse`: tồn kho, phiếu nhập, xuất/hoàn kho, nhà cung cấp.
- `pages/technician`: bảng công việc, lịch hẹn, tiến trình sửa chữa, linh kiện/chi phí.
- `components/chatbot`: UI chatbot và thẻ gợi ý/so sánh sản phẩm.
- `services`: lớp gọi API theo domain.

### Backend (`server`)
- `controllers`: nhận request/response, không chứa business logic dài.
- `services`: xử lý nghiệp vụ, transaction, điều phối nhiều model.
- `models`: truy vấn DB theo domain.
- `routes`: khai báo endpoint.
- `middleware`: auth, RBAC, validation, upload, rate limit.
- `config`: DB, CORS, app config, VNPay, email.
- `db`: migration, seed và schema.
- `utils`: response helper, validator, logger, pagination...

## Quy ước branch
- `main`: bản ổn định
- `develop`: tích hợp chung
- `feature/<module>-<name>`: phát triển chức năng
- `fix/<name>`: sửa lỗi

Ví dụ: `feature/product-filter`, `feature/vnpay-payment`, `feature/repair-tracking`.

## Module nghiệp vụ chính
1. Authentication & Profile
2. Product / Category / Brand / Variant / Dynamic Attributes
3. Search / Filter / Wishlist / Review
4. Cart / Voucher / Checkout / VNPay
5. Order / Return / Refund / Notification
6. Inventory / Supplier / Stock Transaction
7. Serial / Warranty
8. Repair / Technician / Spare Parts
9. Chatbot recommendation & comparison
10. User / Role / Permission
11. Dashboard / Reports / Audit Log

## Khởi chạy dự án
1. Copy `.env.example` thành `.env`.
2. Chạy `docker compose up -d --build`.
3. Frontend: `cd client && npm install && npm run dev`.
4. Database mới: áp baseline `database/schema_database.sql`, rồi migration/seed theo thứ tự trong [hướng dẫn database](server/db/README.md), một lần và có review/backup. Không import lại baseline hoặc reset volume trên database dùng chung.

Hiện trạng đơn hàng và checkout ngày 08/10/2026, kết quả test và mapping còn chờ: [review Task 3](docs/plan/TASK-3-ORDER-UI.md#review-ngày-08102026--tuần-2-task-13-và-14). `ORDER_STORAGE_MODE` mặc định disabled; bật MySQL không đồng nghĩa giỏ/voucher/kho production đã tích hợp.

## Auth, hồ sơ và địa chỉ (CUS-01..05)

Auth chạy thật trên MySQL qua PHP session (cookie HttpOnly `HOMECARE_SESSION` + CSRF). CUSTOMER đăng ký/đăng nhập tại `/login`, `/register` bằng email + mật khẩu; quên mật khẩu tại `/forgot-password` (mã dùng một lần hiển thị trên trang vì chưa có email). ADMIN, SALES, WAREHOUSE đăng nhập tại `/internal/login`. Tài khoản demo từ `server/db/seeds/001_auth_demo_users.sql`: `customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu chung `Demo@1234567890!`.

Sau đăng nhập có shell/menu và route guard theo bốn role, trang `/profile` (sửa tên/điện thoại/ngày sinh, đổi mật khẩu); CUSTOMER có `/addresses` với thêm/sửa/xóa và địa chỉ mặc định. Trang đơn hàng mặc định gọi API thật. Fixture chỉ bật khi cấu hình rõ `VITE_ORDER_API_MODE=mock` trong Vite dev; production không dùng fixture.

Kiểm thử: `cd client && npm test && npm run build`. Backend auth trên MySQL thật: xem [Task 1/9 — Auth/Profile](docs/plan/TASK-1-AUTH-PROFILE.md). Contract: `docs/api/AUTH-PROFILE.md`.

## Chạy local Windows — frontend và API là hai tiến trình

`npm run dev` chỉ chạy React, không khởi động PHP/MySQL. Nếu trang đơn hàng báo không kết nối được máy chủ, kiểm tra API ở `http://localhost:8080/auth/me` trước.

1. Nếu chưa có database HomeCare, làm theo [hướng dẫn tạo database mới](server/db/README.md#tạo-database-homecare-mới-trên-windows). Không import schema vào database đang có dữ liệu.
2. Tạo `.env` ở gốc repo với thông tin DB local. Script API đọc file này; Vite chỉ đọc cấu hình frontend trong `client/.env.local`. Không commit hai file.
3. Terminal PowerShell ở gốc repo: `$env:PHP_BIN = 'đường dẫn đầy đủ tới php.exe'`, rồi `powershell -NoProfile -File .\scripts\start-api.ps1`. Script hỗ trợ PHP portable Windows, không tự tạo/reset DB hoặc seed tài khoản.
4. Terminal khác: `cd client`, `npm run dev`, mở đúng URL Vite thông báo. Dùng `http://localhost:5173` nhất quán để cookie phiên và CSRF cùng hostname.

Script mặc định cho phép origin localhost/127.0.0.1:5173 nếu chưa có `CLIENT_URL`; đặt `CLIENT_URL` rõ trong `.env` nếu dùng cổng khác. PHP built-in server chỉ để phát triển, không dùng triển khai production.

`/warranty` là trang hướng dẫn bảo hành với header/footer và link đơn hàng yêu cầu đăng nhập; không có đăng ký bảo hành giả hoặc module sửa chữa/kỹ thuật viên. Khi API không kết nối được, trang đơn hàng giữ trạng thái lỗi xác thực, không lộ đơn và không thay bằng fixture. Nút Thử lại có loading, chống gửi lặp và cập nhật thông báo khi kết nối vẫn lỗi.
