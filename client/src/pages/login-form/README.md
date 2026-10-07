# Đăng nhập khách hàng bằng OTP

Trang nhận **email hoặc số điện thoại** ở bước đăng nhập. Đăng ký yêu cầu **họ và tên** cùng một trong hai cách liên hệ. Cả hai luồng đều xác nhận bằng mã OTP 6 chữ số; không dùng mật khẩu hoặc khôi phục mật khẩu.

## Chế độ phát triển

Khi chạy Vite ở chế độ phát triển, giao diện dùng mã thử nghiệm tạo trong trình duyệt và hiển thị rõ rằng SMS/email chưa được gửi. Mã có hiệu lực 5 phút, tối đa 5 lần nhập sai, bị hủy sau khi dùng hoặc khi gửi lại. Đặt `VITE_AUTH_DEMO=false` trong `client/.env.local` để thử kết nối API thật ngay khi phát triển.

Sau OTP đúng, phiên kiểm tra UI có định danh `preview:<contact>` và role `CUSTOMER`, lưu trong `sessionStorage` của tab trong một giờ. `nguyen.minh@example.com` sở hữu 4 fixture đơn hàng; contact khác không được xem các fixture này. Phiên preview không tạo tài khoản/backend session, không lưu token hoặc mật khẩu và không được dùng khi build production.

`LoginForm.jsx` gọi `CustomerAuthContext.refreshSession()` trước khi cho tiếp tục; `customerReturnPath()` chỉ nhận `/orders`, chi tiết đơn và `/checkout`. Nút hoàn tất quay lại đường dẫn đã yêu cầu. `/orders` được bảo vệ bằng `CustomerRoute.jsx`; Header dùng cùng context để hiển thị tài khoản và đăng xuất.

## API cần triển khai để gửi thật

`VITE_API_URL` mặc định là `http://localhost:8080`. Bản build gọi:

- `POST /auth/customer/otp/request` với `{ "flow": "login" | "register", "contact": "...", "fullName": "..." }`. `fullName` chỉ có ở đăng ký. Trả về `{ "challengeId": "...", "retryAfterSeconds": 30, "expiresInSeconds": 300 }` sau khi dịch vụ gửi đã nhận mã.
- `POST /auth/customer/otp/verify` với `{ "challengeId": "...", "code": "123456" }`. Sau khi xác nhận thành công, tạo phiên đăng nhập bằng cookie `HttpOnly`, `Secure`, `SameSite` phù hợp và trả về `{ "success": true, "sessionEstablished": true }`.
- `GET /auth/customer/session`: xác nhận cookie; trả `{ "success": true, "sessionEstablished": true, "user": { "id": 1, "role": "CUSTOMER", "fullName": "..." } }`, hoặc HTTP 401 nếu chưa đăng nhập/hết phiên. Không lấy ID/role từ client làm căn cứ xác thực. Frontend không chấp nhận response scaffold chỉ có `success: true`.
- `POST /auth/customer/logout`: vô hiệu hóa cookie/session phía server và trả `{ "success": true }`. Backend phải bảo vệ request ghi dùng cookie khỏi CSRF; không coi xóa state phía UI là đã vô hiệu hóa session thật.

Hai endpoint session/logout là contract frontend đề xuất cho luồng đơn hàng, **chưa được triển khai ở PHP**. Không cho qua bằng localStorage/sessionStorage ở production khi API lỗi. API đơn hàng cũng phải kiểm tra quyền sở hữu trên server; route guard chỉ hỗ trợ UX. Test hồi quy: `npm run test:orders` từ `client/`.

Máy chủ phải kiểm tra tài khoản đã tồn tại khi đăng nhập, tránh đăng ký trùng, giới hạn tần suất gửi và số lần xác nhận, lưu mã an toàn, đặt hạn dùng ngắn và vô hiệu hóa mã sau khi xác nhận. Giao diện không được dùng làm nơi xác thực OTP thật.
