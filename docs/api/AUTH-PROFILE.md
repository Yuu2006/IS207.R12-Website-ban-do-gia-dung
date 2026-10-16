# Auth, hồ sơ và địa chỉ — CUS-01..05

Phiên bản contract: 2, ngày 16/10/2026 (thay bản mock 06/10). Lưu trữ MySQL qua PDO, phiên PHP phía máy chủ. Đăng ký chỉ tạo CUSTOMER; không tự đăng ký role nội bộ. OTP SMS không thuộc MVP.

Source: `server/index.php` → `routes/{auth,user}-routes.php` → `controllers/{auth,user}-controller.php` → `services/{auth,user}-service.php` → `models/user-model.php`. Guard: `middleware/role-middleware.php` (`requireRole`, `requireSessionRole`, `requireAdmin`), validation: `middleware/validation-middleware.php` (khối global).

## Response, session, CSRF

Thành công: `{ "success": true, "message": "Thành công.", "data": ... }`. Lỗi: `{ "success": false, "message": "...", "errors": { "field": "..." } }` với HTTP status đúng. Không trả SQL, exception, password hoặc hash.

User công khai: `{ "id": "12", "fullName": "Nguyễn Minh", "email": "customer@example.test", "phone": "0901234567", "birthDate": "2000-02-29", "role": "CUSTOMER" }`. ID là chuỗi; `phone`/`birthDate` rỗng là `""`.

Session response: `{ "user": User | null, "expiresAt": 1791300000000 | null, "csrfToken": "..." }` (`expiresAt` epoch ms).

- Cookie `HOMECARE_SESSION`: HttpOnly, SameSite=Lax, Secure khi HTTPS, `use_strict_mode`. Principal trên server gồm `id`, `role`, `status`, `expiresAt` (1 giờ) và dấu hash mật khẩu.
- Mỗi request có principal được đối chiếu lại với MySQL: tài khoản bị khóa (`status` khác ACTIVE), xóa mềm, đổi role hoặc đổi mật khẩu → phiên bị hủy (401).
- Đăng nhập/đăng ký/đổi mật khẩu/đặt lại/đăng xuất đều đổi session ID; đăng xuất đổi CSRF token.
- CSRF: GET `/auth/me` trả `csrfToken`; server cũng đặt cookie đọc được `XSRF-TOKEN` cùng giá trị (để `services/api-client.js` của module đơn hàng đọc). Mọi POST/PATCH/PUT/DELETE tới `/auth/*`, `/users/*`, `/api/*` phải gửi header `X-CSRF-Token`; sai → 403. Order API tự kiểm tra CSRF sau xác thực.
- CORS: chỉ Origin trong `CLIENT_URL` (danh sách phân cách dấu phẩy), `credentials: include`. Không gửi user ID/role làm căn cứ phân quyền.

## Ma trận role

| Phạm vi | CUSTOMER | ADMIN | SALES | WAREHOUSE |
| --- | --- | --- | --- | --- |
| `/auth/*` công khai, `/auth/me` | Có | Có | Có | Có |
| Hồ sơ của chính mình `/users/me`, đổi mật khẩu | Có | Có | Có | Có |
| Địa chỉ của chính mình `/users/me/addresses` | Có | Không | Không | Không |
| Đăng nhập tại `/auth/login` | Có | Không | Không | Không |
| Đăng nhập tại `/auth/staff/login` | Không | Có | Có | Có |
| Catalog ghi `/api/*` (PRD) | Không | Có | Không | Không |

Không có principal/hết hạn: 401; sai role hoặc role lạ: 403. ADMIN không tự vượt quyền workspace khác. Route guard React chỉ hỗ trợ UX.

## Auth endpoints

| Method/path | Request | `data` thành công |
| --- | --- | --- |
| GET `/auth/me` | — | Session (user=null nếu chưa đăng nhập) |
| POST `/auth/register` | `{ fullName, email, phone?, password }` | HTTP 201, Session CUSTOMER |
| POST `/auth/login` | `{ identifier, password }` (email hoặc số điện thoại) | Session CUSTOMER |
| POST `/auth/staff/login` | `{ identifier, password }` | Session ADMIN/SALES/WAREHOUSE |
| POST `/auth/password/change` | `{ currentPassword, newPassword }` | Session mới; phiên khác bị hủy |
| POST `/auth/password-reset/request` | `{ contact }` | `{ challengeId, previewCode, retryAfterSeconds: 30, expiresInSeconds: 300, demo: true }` |
| POST `/auth/password-reset/verify` | `{ challengeId, code }` | `{ resetToken }` |
| POST `/auth/password-reset/confirm` | `{ resetToken, newPassword }` | `{ passwordChanged: true }`; không tự đăng nhập |
| POST `/auth/logout` | — | Session với user=null, csrfToken mới |

Quy tắc:

- Mật khẩu 8–200 ký tự, có chữ và số; băm `password_hash(PASSWORD_DEFAULT)`, kiểm tra `password_verify`, tự rehash khi thuật toán mặc định đổi. Không trim mật khẩu.
- Email bắt buộc, lưu chữ thường, unique; điện thoại tùy chọn, chuẩn hóa `+84` → `0`, 10 chữ số, unique. Trùng: 409.
- Sai mật khẩu 5 lần liên tiếp khóa đăng nhập tài khoản 15 phút (429); đăng nhập đúng hoặc đặt lại mật khẩu xóa bộ đếm. Thêm giới hạn 10 lần/phút/phiên cho login/register/đổi mật khẩu/khôi phục.
- Sai cổng (CUSTOMER ở cổng nhân viên hoặc ngược lại), tài khoản không ACTIVE: cùng lỗi 401 như sai mật khẩu.
- Khôi phục mật khẩu là **mô phỏng CUS-03**: mã 6 số trả trong `previewCode` vì chưa có email; hạn 5 phút, 5 lần nhập, cooldown 30 giây, gắn với phiên đang thao tác, dùng một lần. `APP_ENV=production` → 503. Contact không tồn tại → 404 (chấp nhận lộ tồn tại tài khoản trong demo; khi có email phải đổi thành phản hồi chung).

## Hồ sơ

GET `/users/me` → User. PATCH `/users/me` nhận `fullName`, `phone`, `birthDate` (`YYYY-MM-DD`, không ở tương lai, từ 1900) → User. Email đăng nhập **không** đổi qua PATCH (CUS-04 yêu cầu xác minh riêng) — gửi `email` trả 422. Trường lạ (`id`, `role`, `userId`, `status`…) → 422. Ảnh đại diện chưa làm.

## Địa chỉ

| Method/path | Request | Kết quả |
| --- | --- | --- |
| GET `/users/me/addresses` | — | Mảng địa chỉ đang hoạt động, theo thứ tự tạo |
| POST `/users/me/addresses` | AddressInput | HTTP 201, danh sách sau tạo |
| PATCH `/users/me/addresses/{id}` | Một phần AddressInput | Danh sách sau sửa |
| DELETE `/users/me/addresses/{id}` | — | Danh sách sau xóa mềm |

AddressInput: `{ "recipientName": "Khách demo", "phone": "0901234567", "addressLine": "12 Đường thử nghiệm", "province": "TP. Hồ Chí Minh", "district": "", "ward": "", "isDefault": false }`. Address trả về thêm `id` (chuỗi), không lộ `userId`/`isDeleted`.

Địa chỉ đầu tiên luôn mặc định; đặt mặc định mới bỏ cờ cũ; không bỏ cờ mặc định hiện tại bằng PATCH false (422). Xóa mặc định → địa chỉ tạo sớm nhất còn lại thành mặc định. Mọi thay đổi chạy trong transaction có `SELECT … FOR UPDATE` trên dòng user nên request đồng thời không tạo hai mặc định. ID không tồn tại hoặc của người khác: 404. Checkout chép địa chỉ vào đơn (snapshot) nên sửa/xóa sau không đổi đơn cũ.

## Lỗi chung

400 JSON lỗi; 401 chưa đăng nhập/hết hạn/sai thông tin; 403 sai role/CSRF/Origin; 404 endpoint hoặc đối tượng; 405 method sai (kèm `Allow`); 409 trùng email/điện thoại; 413 body quá 64 KiB; 422 validation; 429 giới hạn hoặc tài khoản tạm khóa; 503 khôi phục mật khẩu trong production.

## Chạy và kiểm thử

- Dựng DB theo `server/db/README.md` (baseline → 008/009 → 010 → seed). Tài khoản demo: `customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`.
- PHP không tự đọc `.env` khi chạy CLI. PowerShell: `$env:CLIENT_URL='http://localhost:5173'; $env:DB_HOST='127.0.0.1'; php -S localhost:8080 -t server server/index.php`.
- `php server/tests/auth-profile-test.php`: guard 4 role + validation (không cần DB).
- `node --test scripts/auth-profile-api.test.mjs` (đặt `API_TEST_URL` nếu khác `http://127.0.0.1:8080`): HTTP + MySQL thật — cookie/CSRF/CORS, 3 role nội bộ, đăng ký, hồ sơ, CRUD địa chỉ và quyền sở hữu, race địa chỉ mặc định, khóa sau 5 lần sai, đổi mật khẩu hủy phiên khác, khôi phục một lần. Test tạo tài khoản mới mỗi lần chạy: **chỉ chạy trên database thử nghiệm**.
