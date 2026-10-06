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
4. Import schema/seed trong `server/db` nếu cần.

## Auth, hồ sơ và địa chỉ demo (CUS-01..05)

Chạy Vite dev để dùng demo độc lập. CUSTOMER đăng nhập tại `/login` bằng `customer@example.test` hoặc `0901234567`; mã OTP thử nghiệm hiển thị trên trang. Đăng ký tại `/register` chỉ tạo CUSTOMER demo. ADMIN, SALES, WAREHOUSE đăng nhập tại `/internal/login`, chọn nút role để điền tài khoản giả; mật khẩu chung `Demo@1234567890!`.

Sau đăng nhập có shell/menu và route guard theo bốn role, trang `/profile`; CUSTOMER có `/addresses` với thêm/sửa/xóa và địa chỉ mặc định. Hồ sơ/địa chỉ browser demo lưu trong localStorage của trình duyệt, phiên có hạn một giờ trong sessionStorage. Các workspace quản trị/kho và module chưa có nghiệp vụ được ghi rõ là placeholder. Checkout/đơn hàng vẫn là UI mẫu.

`client`: `npm test` kiểm tra mock service; `npm run build` kiểm tra build. Backend: `php server/tests/auth-profile-test.php` kiểm tra guard với principal giả và bất biến hồ sơ/địa chỉ. API mock có thể thử bằng `node --test scripts/auth-profile-api.test.mjs` khi đã chạy PHP và bật `AUTH_DEMO=true` ở môi trường development.

Xem `docs/api/AUTH-PROFILE.md` để nối FE với cookie/CSRF và API mock bằng `VITE_AUTH_DEMO=false`; xem `docs/database/AUTH-PROFILE.md` cho schema mới. Auth thật và PDO persistence chưa triển khai; migration chưa chạy lên database chung.

Kết quả triển khai, kiểm thử và cách chạy lại: [Task 1 — Auth/Profile demo](docs/plan/TASK-1-AUTH-PROFILE.md).
