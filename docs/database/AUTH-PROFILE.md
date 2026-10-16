# Schema auth/profile/address — CUS-01..05

Cập nhật 16/10/2026: dùng bảng `users`, `addresses` của baseline `database/schema_database.sql`, bổ sung bằng `server/db/migrations/010_auth_profile.sql` (thay migration 001 mock cũ, vốn tạo lại bảng và không tương thích baseline). Seed: `server/db/seeds/001_auth_demo_users.sql`.

| Bảng | Dùng trong auth | Migration 010 thêm |
| --- | --- | --- |
| users | full_name, email (NOT NULL UNIQUE, lưu chữ thường), phone, password_hash (NOT NULL — mọi tài khoản có mật khẩu), role, status, is_deleted | `birth_date DATE NULL`, `failed_login_count`, `locked_until` (UTC), `UNIQUE (phone)` |
| addresses | recipient_name, phone, address_line, province, district, ward, is_default, is_deleted | index `(user_id, is_deleted)` |

- Role lưu VARCHAR như baseline; backend chỉ chấp nhận CUSTOMER/ADMIN/SALES/WAREHOUSE (allowlist trong `role-middleware.php`). Không thêm CHECK để không làm hỏng dữ liệu cũ có role phạm vi cũ.
- Một địa chỉ mặc định/người dùng do service bảo đảm: transaction khóa dòng user (`FOR UPDATE`), bỏ cờ cũ rồi ghi mới. Xóa địa chỉ là xóa mềm; đơn hàng giữ snapshot địa chỉ.
- Phiên dùng PHP native session, không có bảng sessions. Đổi mật khẩu làm phiên cũ hết hiệu lực nhờ dấu hash mật khẩu lưu trong principal.
- `UNIQUE (phone)` cho phép nhiều NULL; model ghi chuỗi rỗng thành NULL. Nếu DB đang dùng có số trùng, migration báo lỗi — xử lý trùng trước, không tự xóa dữ liệu.

ERD: `users (1) → addresses (n)`, FK không xóa dây chuyền. Thứ tự áp dụng xem `server/db/README.md`.
