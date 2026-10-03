# Đăng nhập nhân viên

Trang riêng tại `/internal/login`, tách khỏi đăng nhập khách hàng ở `/` và `/login`. Không có chức năng tự đăng ký tài khoản nội bộ.

## Luồng giao diện

Đăng nhập bằng tên đăng nhập hoặc email và mật khẩu. Quên mật khẩu gồm: nhập email/số điện thoại → xác nhận OTP 6 chữ số → nhập và xác nhận mật khẩu mới → quay về đăng nhập. Mật khẩu mới tối thiểu 15 ký tự vì luồng đăng nhập nhân viên hiện chưa có MFA.

Ở chế độ phát triển, bước khôi phục có mã thử nghiệm hiển thị rõ trên trang; mã hết hạn sau 5 phút, tối đa 5 lần nhập sai và không thể dùng lại. Mật khẩu thật **không đổi** trong chế độ này. Đặt `VITE_AUTH_DEMO=false` trong `client/.env.local` để kiểm tra API thật. Đăng nhập nhân viên không có chế độ cho qua giả.

## API cần triển khai

Các request dùng `VITE_API_URL` (mặc định `http://localhost:8080`) và cookie phiên:

- `POST /auth/staff/login`: `{ "identifier": "...", "password": "..." }` → `{ "success": true, "sessionEstablished": true, "role": "..." }` sau khi tạo phiên đăng nhập.
- `POST /auth/staff/password-reset/request`: `{ "contact": "..." }` → `{ "challengeId": "...", "retryAfterSeconds": 30 }` sau khi yêu cầu gửi OTP.
- `POST /auth/staff/password-reset/verify`: `{ "challengeId": "...", "code": "123456" }` → `{ "resetToken": "..." }` có hạn dùng ngắn và chỉ được phép đặt lại mật khẩu.
- `POST /auth/staff/password-reset/confirm`: `{ "resetToken": "...", "newPassword": "..." }` → `{ "success": true, "passwordChanged": true }` sau khi lưu mật khẩu mới.

Máy chủ phải kiểm tra tài khoản nội bộ và quyền trên từng API, giới hạn tần suất gửi và xác nhận OTP, dùng mã một lần, lưu mật khẩu bằng thuật toán băm phù hợp và không tiết lộ liên hệ nào đang có tài khoản. Sau khi đặt lại mật khẩu, người dùng cần đăng nhập lại.
