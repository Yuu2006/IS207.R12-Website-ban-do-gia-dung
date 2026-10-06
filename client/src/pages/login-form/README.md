# Đăng nhập khách hàng bằng OTP

Trang nhận **email hoặc số điện thoại** ở bước đăng nhập. Đăng ký yêu cầu **họ và tên** cùng một trong hai cách liên hệ. Cả hai luồng đều xác nhận bằng mã OTP 6 chữ số; không dùng mật khẩu hoặc khôi phục mật khẩu.

## Chế độ phát triển

Mặc định khi chạy Vite dev, `services/demo-service.js` tạo mã trong trình duyệt, không gửi SMS/email. Dùng `customer@example.test` hoặc `0901234567`, nhập mã hiển thị trên trang. Đăng ký tạo CUSTOMER mới. Mã có hiệu lực 5 phút, tối đa 5 lần thử; phiên demo có hạn một giờ trong tab, hồ sơ/địa chỉ lưu bằng localStorage.

## Luồng và contract

`LoginForm.jsx` → `auth-client.js` → `services/auth-service.js` → browser mock hoặc PHP API. Xác nhận thành công gọi `refreshSession()` của AuthProvider rồi chuyển tới workspace/route yêu cầu trước đăng nhập.

- `POST /auth/customer/otp/request`: `{ flow, contact, fullName? }` → envelope `{ success, message, data: { challengeId, retryAfterSeconds, expiresInSeconds, previewCode, demo } }`.
- `POST /auth/customer/otp/verify`: `{ challengeId, code }` → envelope `data: { user, expiresAt, csrfToken, demo }`.
- `GET /auth/me` và `POST /auth/logout` dùng contract phiên chung.

Đặt `VITE_AUTH_DEMO=false`, cấu hình `VITE_API_URL`, bật `AUTH_DEMO=true` trên PHP để thử API mock với cookie HttpOnly và CSRF. Bản production mặc định gọi API; PHP demo bị chặn trong production. Contract/lỗi/quyền được ghi tại `docs/api/AUTH-PROFILE.md`. Email/SMS và lưu MySQL chưa triển khai. Các lỗi 404 tài khoản chưa có, 409 liên hệ trùng, 422 dữ liệu/mã sai, 429 giới hạn được hiển thị trên form; không báo đăng nhập thành công khi request lỗi.
