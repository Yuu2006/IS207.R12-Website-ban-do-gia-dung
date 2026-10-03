# Đăng nhập khách hàng bằng OTP

Trang nhận **email hoặc số điện thoại** ở bước đăng nhập. Đăng ký yêu cầu **họ và tên** cùng một trong hai cách liên hệ. Cả hai luồng đều xác nhận bằng mã OTP 6 chữ số; không dùng mật khẩu hoặc khôi phục mật khẩu.

## Chế độ phát triển

Khi chạy Vite ở chế độ phát triển, giao diện dùng mã thử nghiệm tạo trong trình duyệt và hiển thị rõ rằng SMS/email chưa được gửi. Mã có hiệu lực 5 phút, tối đa 5 lần nhập sai, bị hủy sau khi dùng hoặc khi gửi lại. Đặt `VITE_AUTH_DEMO=false` trong `client/.env.local` để thử kết nối API thật ngay khi phát triển.

## API cần triển khai để gửi thật

`VITE_API_URL` mặc định là `http://localhost:8080`. Bản build gọi:

- `POST /auth/customer/otp/request` với `{ "flow": "login" | "register", "contact": "...", "fullName": "..." }`. `fullName` chỉ có ở đăng ký. Trả về `{ "challengeId": "...", "retryAfterSeconds": 30, "expiresInSeconds": 300 }` sau khi dịch vụ gửi đã nhận mã.
- `POST /auth/customer/otp/verify` với `{ "challengeId": "...", "code": "123456" }`. Sau khi xác nhận thành công, tạo phiên đăng nhập bằng cookie `HttpOnly`, `Secure`, `SameSite` phù hợp và trả về `{ "success": true, "sessionEstablished": true }`.

Máy chủ phải kiểm tra tài khoản đã tồn tại khi đăng nhập, tránh đăng ký trùng, giới hạn tần suất gửi và số lần xác nhận, lưu mã an toàn, đặt hạn dùng ngắn và vô hiệu hóa mã sau khi xác nhận. Giao diện không được dùng làm nơi xác thực OTP thật.
