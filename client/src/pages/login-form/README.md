# Đăng nhập / đăng ký khách hàng (CUS-01, CUS-02)

`LoginForm.jsx` → `services/auth-service.js` → PHP `/auth/login`, `/auth/register` (MySQL). Không còn OTP: đặc tả MVP dùng email + mật khẩu, OTP SMS nằm ngoài MVP.

- Đăng nhập: email hoặc số điện thoại + mật khẩu. Sai 5 lần liên tiếp khóa đăng nhập tài khoản 15 phút (429).
- Đăng ký: họ tên, email, số điện thoại tùy chọn, mật khẩu 8–200 ký tự có chữ và số. Chỉ tạo CUSTOMER; trùng email/điện thoại trả 409.
- Quên mật khẩu: `/forgot-password` dùng lại luồng khôi phục của `StaffLogin` (`audience="customer"`). Mã dùng một lần hiển thị trên trang vì chưa có dịch vụ email; bị chặn khi `APP_ENV=production`.
- Thành công gọi `refreshSession()` của `AuthProvider`, rồi quay lại `state.returnTo` (CustomerRoute) hoặc `state.from` (ProtectedRoute) nếu là đường dẫn nội bộ, ngược lại về workspace theo role.

Vite dev hiển thị nút điền tài khoản demo `customer@example.test` / `Demo@1234567890!` (từ `server/db/seeds/001_auth_demo_users.sql`). Contract chi tiết: `docs/api/AUTH-PROFILE.md`.
