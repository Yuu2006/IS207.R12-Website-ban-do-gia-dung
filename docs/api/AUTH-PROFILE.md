# Auth, hồ sơ và địa chỉ — CUS-01..05

Phiên bản contract: 1, ngày 06/10/2026. Phạm vi triển khai hiện tại là **mock/demo**, chưa có xác thực hay lưu trữ MySQL thật. Đăng ký chỉ tạo CUSTOMER; không tự đăng ký role nội bộ.

## Response và session

Thành công: `{ "success": true, "message": "Thành công.", "data": ... }`.
Lỗi: `{ "success": false, "message": "...", "errors": { "fullName": "..." } }` với HTTP status tương ứng. Lỗi hệ thống không lộ SQL, exception hoặc stack trace.

User công khai: `{ "id": "demo-customer", "fullName": "Nguyễn Minh", "email": "customer@example.test", "phone": "0901234567", "role": "CUSTOMER" }`. ID là chuỗi trong JSON. Không trả password/hash/session ID.

Response session: `{ "user": User | null, "expiresAt": 1791300000000 | null, "demo": true, "csrfToken": "..." }`. `expiresAt` là epoch milliseconds. API mock dùng cookie `HOMECARE_DEMO`, HttpOnly, SameSite=Lax, Secure khi HTTPS; principal lưu trên máy chủ gồm `id`, `role`, `status=ACTIVE`, `expiresAt` epoch seconds. Phiên có hạn một giờ, đổi session ID khi đăng nhập/đăng xuất. Logout vô hiệu principal và OTP cũ, đổi CSRF token.

GET `/auth/me` lấy CSRF token trước thao tác ghi. Mọi POST/PATCH/DELETE gửi `X-CSRF-Token`; Origin phải thuộc `CLIENT_URL` (có thể là danh sách phân cách bằng dấu phẩy). FE giữ CSRF token trong bộ nhớ, gửi cookie bằng `credentials: include`. Không gửi user ID/role làm căn cứ phân quyền.

## Ma trận role

| Phạm vi | CUSTOMER | ADMIN | SALES | WAREHOUSE |
| --- | --- | --- | --- | --- |
| Trang công khai và auth | Có | Có | Có | Có |
| Hồ sơ của chính mình `/profile`, `/users/me` | Có | Có | Có | Có |
| Địa chỉ của chính mình `/addresses`, `/users/me/addresses` | Có | Không | Không | Không |
| Workspace CUSTOMER, checkout, đơn khách hàng | Có | Không | Không | Không |
| Workspace ADMIN | Không | Có | Không | Không |
| Workspace SALES, UI xử lý đơn | Không | Không | Có | Không |
| Workspace WAREHOUSE | Không | Không | Không | Có |

ADMIN không tự vượt quyền workspace khác. Menu/route guard FE hỗ trợ UX; role guard PHP kiểm tra độc lập. Principal thiếu, hết hạn hoặc bị vô hiệu trả 401; sai role/role lạ trả 403. Các workspace quản trị/kho/trả hàng là placeholder ghi rõ chưa có nghiệp vụ.

## Auth endpoints

| Method/path | Quyền | Request | `data` thành công |
| --- | --- | --- | --- |
| GET `/auth/me` | Công khai | Không | Session, gồm user=null nếu chưa đăng nhập |
| POST `/auth/staff/login` | Công khai + CSRF | `{ "identifier": "sales@example.test", "password": "Demo@1234567890!" }` | Session |
| POST `/auth/customer/otp/request` | Công khai + CSRF | `{ "flow": "login" hoặc "register", "contact": "email hoặc số điện thoại", "fullName": "..." }`; fullName bắt buộc khi đăng ký | `{ "challengeId": "...", "retryAfterSeconds": 30, "expiresInSeconds": 300, "previewCode": "123456", "demo": true }` |
| POST `/auth/customer/otp/verify` | Công khai + CSRF | `{ "challengeId": "...", "code": "123456" }` | Session CUSTOMER |
| POST `/auth/logout` | Phiên hiện tại + CSRF | Không | Session với user=null |

OTP mock hết hạn sau 5 phút, tối đa 5 lần xác nhận, mã cũ bị vô hiệu sau dùng/gửi lại. Cooldown 30 giây. PHP còn giới hạn 10 yêu cầu đăng nhập/yêu cầu OTP mỗi phút **theo phiên demo**; auth thật cần bộ đếm IP/account dùng chung. Preview code chỉ dành cho mock, không gửi SMS/email. Login contact không có: 404; đăng ký trùng: 409; mật khẩu sai: 401; OTP sai/hết hạn: 422; vượt giới hạn: 429.

Khôi phục mật khẩu nội bộ có sẵn chỉ là thử nghiệm giao diện trong browser demo; ba endpoint password-reset chưa được triển khai trên API PHP và trả 404. Không tính là auth thật hoàn chỉnh.

## Hồ sơ

GET `/users/me` → `data: User`; PATCH `/users/me` → `data: User`. Tất cả role được quản lý chính mình.

PATCH cho phép `fullName`, `email`, `phone`; tối thiểu một trường hoặc object rỗng (không đổi). Tên không rỗng, tối đa 150 ký tự. Email tối đa 255 ký tự, đúng định dạng; điện thoại chuẩn hóa +84 thành 0, 10 chữ số. Cần ít nhất email/điện thoại. Liên hệ trùng user khác trả 409. ID/role/userId/status hoặc trường lạ trả 422 ở API.

Mock cho chỉnh liên hệ để thử form. Khi nối auth thật, việc đổi thông tin dùng để đăng nhập phải có luồng xác minh liên hệ; không dùng mock này để bảo vệ tài khoản thật.

## Địa chỉ

| Method/path | Request | Kết quả |
| --- | --- | --- |
| GET `/users/me/addresses` | Không | Mảng địa chỉ đang hoạt động của principal |
| POST `/users/me/addresses` | AddressInput | HTTP 201, danh sách địa chỉ sau tạo |
| PATCH `/users/me/addresses/{id}` | Một hoặc nhiều trường AddressInput | HTTP 200, danh sách sau sửa |
| DELETE `/users/me/addresses/{id}` | Không | HTTP 200, danh sách sau xóa mềm |

AddressInput: `{ "recipientName": "Khách demo", "phone": "0901234567", "addressLine": "12 Đường thử nghiệm", "province": "TP. Hồ Chí Minh", "district": "", "ward": "", "isDefault": false }`.

Tên người nhận bắt buộc, tối đa 150; phone bắt buộc và hợp lệ; addressLine bắt buộc, tối đa 255; province bắt buộc, tối đa 100. district/ward tùy chọn, tối đa 100. isDefault là boolean (POST không gửi thì mặc định false). Địa chỉ trả về có thêm `id`, không lộ `userId`/`isDeleted`.

Địa chỉ đầu tiên luôn mặc định. Đặt mặc định mới bỏ cờ cũ. Không bỏ cờ mặc định hiện tại bằng PATCH false; chọn địa chỉ khác làm mặc định trước. Xóa mặc định chọn địa chỉ hoạt động được tạo sớm nhất còn lại; xóa cuối cùng trả mảng rỗng. Truy cập ID không tồn tại/của người khác đều 404. CUSTOMER chỉ quản lý địa chỉ chính mình.

## Lỗi chung

400 JSON lỗi; 401 chưa đăng nhập/hết hạn; 403 sai role/CSRF/Origin; 404 endpoint hoặc đối tượng không có; 405 method sai; 409 liên hệ trùng; 413 body quá 64 KiB; 422 validation; 429 giới hạn; 503 auth mock chưa bật hoặc môi trường production. API không chuyển sang mock tự động khi request lỗi.

## Chế độ chạy và source

- Browser demo: mặc định khi Vite dev; `VITE_AUTH_DEMO=true` bật rõ cả build/preview. `client/src/services/demo-service.js` giữ hồ sơ/địa chỉ trong localStorage, phiên trong sessionStorage của tab. Đây là dữ liệu giả có thể bị sửa từ trình duyệt, không phải xác thực/bảo vệ dữ liệu thật.
- API mock: FE `VITE_AUTH_DEMO=false`, `VITE_API_URL=http://localhost:8080`; PHP `AUTH_DEMO=true`, `APP_ENV=development`, `CLIENT_URL=http://localhost:5173`. API bị khóa nếu AUTH_DEMO khác true hoặc APP_ENV=production. Compose đọc các biến từ `.env`.
- PHP không tự đọc `.env` khi chạy CLI. PowerShell: `$env:AUTH_DEMO='true'; $env:APP_ENV='development'; $env:CLIENT_URL='http://localhost:5173'; php -S localhost:8080 -t server server/index.php`.
- API mock giữ repository trong phiên PHP để thử request/response; mỗi cookie có dữ liệu riêng, không đồng bộ nhiều trình duyệt, không lưu bền vào MySQL. Logout giữ repository demo trong phiên nhưng hủy principal.
- `services/auth-service.js`, `user-service.js` chọn một chế độ; `http-client.js` xử lý cookie/CSRF/response. `AuthContext.jsx` cùng `ProtectedRoute.jsx` dùng phiên cho shell.
- Route → controller → `AuthService`/`UserService` → `UserModel` mock. `role-middleware.php` dùng principal máy chủ; `validation-middleware.php` dùng whitelist và validation. PDO thật sẽ được nối tại model trong nhiệm vụ backend persistence.

Tài khoản: CUSTOMER `customer@example.test` hoặc `0901234567` bằng OTP demo; ADMIN/SALES/WAREHOUSE lần lượt `admin@example.test`, `sales@example.test`, `warehouse@example.test`, mật khẩu chung `Demo@1234567890!`. Toàn bộ thông tin chỉ để demo.
