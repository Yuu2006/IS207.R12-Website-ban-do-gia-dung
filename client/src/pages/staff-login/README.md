# Đăng nhập nhân viên và quên mật khẩu (CUS-02, CUS-03)

Trang `/internal/login` cho ADMIN, SALES, WAREHOUSE; không tự đăng ký tài khoản nội bộ. Cùng component được dùng tại `/forgot-password` với `audience="customer"` (chỉ có luồng khôi phục).

`StaffLogin.jsx` → `services/auth-service.js` → PHP (MySQL):

- `POST /auth/staff/login` `{ identifier, password }` → phiên. Tài khoản CUSTOMER đăng nhập ở cổng này nhận cùng lỗi 401 như sai mật khẩu.
- Quên mật khẩu: `POST /auth/password-reset/request` `{ contact }` → `{ challengeId, previewCode, retryAfterSeconds }`; `.../verify` `{ challengeId, code }` → `{ resetToken }`; `.../confirm` `{ resetToken, newPassword }` → `{ passwordChanged: true }`. Mã 6 số, hạn 5 phút, tối đa 5 lần nhập, cooldown 30 giây, gắn với phiên trình duyệt đang thao tác.
- Mã chỉ là mô phỏng CUS-03: hiển thị trên trang vì chưa có email, endpoint trả 503 khi `APP_ENV=production`. Đặt lại thành công làm mọi phiên cũ của tài khoản hết hiệu lực.

Vite dev hiện nút điền `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!` (seed demo). Nút chỉ điền form; mật khẩu sai vẫn bị từ chối.
