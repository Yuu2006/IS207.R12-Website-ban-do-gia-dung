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
