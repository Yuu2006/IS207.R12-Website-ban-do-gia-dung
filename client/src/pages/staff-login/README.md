# Đăng nhập nhân viên

Trang riêng tại `/internal/login`, tách khỏi đăng nhập khách hàng ở `/` và `/login`. Không có chức năng tự đăng ký tài khoản nội bộ.

## Luồng giao diện

Đăng nhập bằng tên đăng nhập hoặc email và mật khẩu. Quên mật khẩu gồm: nhập email/số điện thoại → xác nhận OTP 6 chữ số → nhập và xác nhận mật khẩu mới → quay về đăng nhập. Mật khẩu mới tối thiểu 15 ký tự vì luồng đăng nhập nhân viên hiện chưa có MFA.

Đăng nhập demo dùng `admin@example.test`, `sales@example.test`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`. Nút chọn tài khoản chỉ điền form; mật khẩu sai vẫn bị từ chối. Sau khi service tạo phiên, `refreshSession()` cập nhật shell và chuyển đến workspace đúng role. Không có quyền ADMIN ngầm định cho route của SALES/WAREHOUSE.

## Source và contract đăng nhập

`StaffLogin.jsx` → `staff-auth-client.js` → `services/auth-service.js`. Browser mock dùng sessionStorage; khi `VITE_AUTH_DEMO=false`, API dùng `VITE_API_URL` (mặc định `http://localhost:8080`), cookie HttpOnly và CSRF. PHP mock cần bật `AUTH_DEMO=true`; xem `docs/api/AUTH-PROFILE.md`.

- `POST /auth/staff/login`: `{ identifier, password }` → `{ success, message, data: { user, expiresAt, csrfToken, demo } }`. Sai tài khoản/mật khẩu: 401; dữ liệu sai: 422; giới hạn: 429. Không trim mật khẩu.

## Giới hạn khôi phục mật khẩu

Luồng khôi phục sẵn có chỉ mô phỏng trong browser demo, không đổi mật khẩu đăng nhập. Các endpoint sau **chưa được PHP triển khai**, trả 404 khi thử API mode:
- `POST /auth/staff/password-reset/request`: `{ "contact": "..." }` → `{ "challengeId": "...", "retryAfterSeconds": 30 }` sau khi yêu cầu gửi OTP.
- `POST /auth/staff/password-reset/verify`: `{ "challengeId": "...", "code": "123456" }` → `{ "resetToken": "..." }` có hạn dùng ngắn và chỉ được phép đặt lại mật khẩu.
- `POST /auth/staff/password-reset/confirm`: `{ "resetToken": "...", "newPassword": "..." }` → `{ "success": true, "passwordChanged": true }` sau khi lưu mật khẩu mới.

Không tính khôi phục mật khẩu thật vào kết quả hoàn thành của milestone auth/profile demo. Backend đã kiểm tra role, dùng `password_hash`/`password_verify`, hết hạn phiên và vô hiệu hóa khi đăng xuất; dữ liệu hiện vẫn là mock riêng trong phiên PHP.
