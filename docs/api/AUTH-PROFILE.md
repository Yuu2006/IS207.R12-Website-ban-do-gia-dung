# Auth, hồ sơ và địa chỉ — CUS-01..05

Phiên bản contract: 3, ngày 16/10/2026 (thay bản mock 06/10; v3 thêm đổi email, ảnh đại diện, giới hạn theo IP). Lưu trữ MySQL qua PDO, phiên PHP phía máy chủ. Đăng ký chỉ tạo CUSTOMER; không tự đăng ký role nội bộ. OTP SMS không thuộc MVP.

Source: `server/index.php` → `routes/{auth,user}-routes.php` → `controllers/{auth,user}-controller.php` → `services/{auth,user}-service.php` → `models/user-model.php`. Guard: `middleware/role-middleware.php` (`requireRole`, `requireSessionRole`, `requireAdmin`), validation: `middleware/validation-middleware.php` (khối global).

Cập nhật 26/10/2026: GET `/auth/me` khi phiên máy chủ không có principal trả 200 `{success:true,message,data:{user:null,expiresAt:null,csrfToken}}` và cookie CSRF mà không cần mở PDO. Đây chỉ là xác nhận chưa đăng nhập, không phải health check DB hoặc tạo tài khoản giả. Phiên có principal vẫn phải được đối chiếu DB như trước; không chuyển thành phiên anonymous giả khi DB lỗi. Lỗi kết nối/thiếu schema trả 503 với thông báo chung, không lộ SQL hoặc credential. Client refresh có loading/chống gửi lặp, lỗi mạng không được coi là đăng nhập thành công.

## Response, session, CSRF

Thành công: `{ "success": true, "message": "Thành công.", "data": ... }`. Lỗi: `{ "success": false, "message": "...", "errors": { "field": "..." } }` với HTTP status đúng. Không trả SQL, exception, password hoặc hash.

User công khai: `{ "id": "12", "fullName": "Nguyễn Minh", "email": "customer@example.test", "phone": "0901234567", "birthDate": "2000-02-29", "avatarUrl": "http://localhost:8080/uploads/avatars/<32 hex>.png", "role": "CUSTOMER" }`. ID là chuỗi; `phone`/`birthDate`/`avatarUrl` rỗng là `""`.

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
| Quản trị tài khoản `/admin/users` | Không | Có | Không | Không |
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
| POST `/auth/email-change/request` | `{ newEmail, currentPassword }` (đã đăng nhập) | `{ challengeId, email, previewCode, expiresInSeconds: 300, demo: true }` |
| POST `/auth/email-change/confirm` | `{ challengeId, code }` | Session với email mới |
| POST `/auth/logout` | — | Session với user=null, csrfToken mới |

Quy tắc:

- Mật khẩu 8–200 ký tự, có chữ và số; băm `password_hash(PASSWORD_DEFAULT)`, kiểm tra `password_verify`, tự rehash khi thuật toán mặc định đổi. Không trim mật khẩu.
- Email bắt buộc, lưu chữ thường, unique; điện thoại tùy chọn, chuẩn hóa `+84` → `0`, 10 chữ số, unique. Trùng: 409.
- Sai mật khẩu 5 lần liên tiếp khóa đăng nhập tài khoản 15 phút (429); đăng nhập đúng hoặc đặt lại mật khẩu xóa bộ đếm.
- Mỗi lần đăng nhập được ghi vào `auth_login_attempts` (IP từ `REMOTE_ADDR`, user, thành công/thất bại). Một IP sai từ 30 lần trong 15 phút bị chặn 429 trước khi tra tài khoản (chống dò nhiều tài khoản). Máy test có thể nâng ngưỡng bằng biến `AUTH_IP_MAX_FAILURES`. Thêm giới hạn 10 lần/phút/phiên cho login/register/đổi mật khẩu/khôi phục/đổi email.
- Sai cổng (CUSTOMER ở cổng nhân viên hoặc ngược lại), tài khoản không ACTIVE: cùng lỗi 401 như sai mật khẩu.
- Khôi phục mật khẩu là **mô phỏng CUS-03**: mã 6 số trả trong `previewCode` vì chưa có email; hạn 5 phút, 5 lần nhập, cooldown 30 giây, gắn với phiên đang thao tác, dùng một lần. `APP_ENV=production` → 503. Contact không tồn tại → 404 (chấp nhận lộ tồn tại tài khoản trong demo; khi có email phải đổi thành phản hồi chung).

## Hồ sơ

GET `/users/me` → User. PATCH `/users/me` nhận `fullName`, `phone`, `birthDate` (`YYYY-MM-DD`, không ở tương lai, từ 1900), `avatarUrl` → User. Trường lạ (`id`, `role`, `userId`, `status`, `email`…) → 422.

- **Ảnh đại diện**: tải lên bằng `POST /api/uploads/images` với `type=avatars` (mọi tài khoản đăng nhập được dùng loại này; các loại khác chỉ ADMIN), rồi PATCH `avatarUrl`. Chỉ nhận URL http(s) có đường dẫn `/uploads/avatars/<32 hex>.(jpg|png|webp)`; `""` để xóa ảnh.
- **Đổi email đăng nhập** (CUS-04): không qua PATCH. Gửi email mới + mật khẩu hiện tại tới `/auth/email-change/request` → mã 6 số (bản demo trả `previewCode` vì chưa có email; 503 khi `APP_ENV=production`) → `/auth/email-change/confirm`. Mã hạn 5 phút, tối đa 5 lần nhập, gắn với phiên và tài khoản đang đăng nhập, dùng một lần. Email trùng → 409.

## Địa chỉ

| Method/path | Request | Kết quả |
| --- | --- | --- |
| GET `/users/me/addresses` | — | Mảng địa chỉ đang hoạt động, theo thứ tự tạo |
| POST `/users/me/addresses` | AddressInput | HTTP 201, danh sách sau tạo |
| PATCH `/users/me/addresses/{id}` | Một phần AddressInput | Danh sách sau sửa |
| DELETE `/users/me/addresses/{id}` | — | Danh sách sau xóa mềm |

AddressInput: `{ "recipientName": "Khách demo", "phone": "0901234567", "addressLine": "12 Đường thử nghiệm", "province": "TP. Hồ Chí Minh", "district": "", "ward": "", "isDefault": false }`. Address trả về thêm `id` (chuỗi), không lộ `userId`/`isDeleted`.

Địa chỉ đầu tiên luôn mặc định; đặt mặc định mới bỏ cờ cũ; không bỏ cờ mặc định hiện tại bằng PATCH false (422). Xóa mặc định → địa chỉ tạo sớm nhất còn lại thành mặc định. Mọi thay đổi chạy trong transaction có `SELECT … FOR UPDATE` trên dòng user nên request đồng thời không tạo hai mặc định. ID không tồn tại hoặc của người khác: 404. Checkout chép địa chỉ vào đơn (snapshot) nên sửa/xóa sau không đổi đơn cũ.

## Quản trị tài khoản nội bộ — USR-01

Chỉ `ADMIN` được gọi. Bốn role cố định là `CUSTOMER`, `ADMIN`, `SALES`, `WAREHOUSE`; không có role tự định nghĩa. Route React chỉ phục vụ UX, API luôn kiểm tra principal và role ở server. Cần áp migration `017_admin_user_management.sql` sau migration 011 để lưu metadata khóa quản trị và index truy vấn; migration này không phụ thuộc các module 012–016.

| Method/path | Quyền | Request | Kết quả |
| --- | --- | --- | --- |
| GET `/admin/users?q=&role=&status=&page=1&perPage=10` | ADMIN | `q` tên/email/điện thoại (≤100); role/status tùy chọn; page ≥1; perPage 1–50 | `{ items: UserAdmin[], pagination: { page, perPage, total, totalPages } }` |
| POST `/admin/users` | ADMIN | `{ fullName, email, phone?, role, password }` | HTTP 201, UserAdmin |
| PATCH `/admin/users/{id}` | ADMIN | Một hoặc nhiều trường `{ fullName?, email?, phone?, role? }` | UserAdmin sau cập nhật |
| PATCH `/admin/users/{id}/status` | ADMIN | `{ status: "ACTIVE" | "DISABLED", reason }` (lý do 3–255 ký tự) | UserAdmin sau thay đổi |

UserAdmin không chứa mật khẩu/hash. Ví dụ POST: `{ "fullName": "Nhân viên mới", "email": "staff@example.test", "phone": "0901234567", "role": "SALES", "password": "TempPass123" }`. Ví dụ danh sách trả một user với `id` dạng chuỗi, `fullName`, `email`, `phone`, `role`, `status`, `createdAt`, `lastLoginAt`, `lockedUntil`, `adminLockedAt`, `lockReason`.

- Email chuẩn hóa chữ thường, số điện thoại chuẩn hóa theo quy tắc CUS-01; email/điện thoại trùng → 409. Mật khẩu giữ nguyên whitespace và theo quy tắc 8–200 ký tự có chữ và số; server chỉ lưu `password_hash`.
- `status=DISABLED` là khóa do quản trị viên; khác với `locked_until` (khóa tạm do đăng nhập sai). Khóa/mở khóa đều cần lý do, đổi status và ghi audit trong cùng transaction. Đăng xuất có hiệu lực ở request kế tiếp vì session kiểm tra lại role/status.
- Không thể tự khóa/hạ role tài khoản ADMIN đang dùng; không thể loại bỏ ADMIN hoạt động cuối cùng. Các thay đổi role, thông tin và trạng thái đều được ghi `audit_logs`; thao tác lặp cùng status trả 409.
- Không có xóa cứng tài khoản trong endpoint này. Dữ liệu giao dịch được giữ nguyên. Email/role/status không nhận từ trường thừa; chỉ allowlist role cố định.
- Lỗi: 401 chưa đăng nhập/phiên admin không còn hiệu lực; 403 sai role hoặc CSRF; 404 ID không tồn tại; 409 trùng thông tin, tự khóa/hạ quyền hoặc trạng thái đã đặt; 422 validation/query sai; 500/503 lỗi hệ thống hoặc schema/migration chưa sẵn sàng.

## Lỗi chung

400 JSON lỗi; 401 chưa đăng nhập/hết hạn/sai thông tin; 403 sai role/CSRF/Origin; 404 endpoint hoặc đối tượng; 405 method sai (kèm `Allow`); 409 trùng email/điện thoại; 413 body quá 64 KiB; 422 validation; 429 giới hạn hoặc tài khoản tạm khóa; 503 khôi phục mật khẩu trong production.

## Chạy và kiểm thử

- Dựng DB theo `server/db/README.md` (baseline → 008/009 → 010 → seed). Tài khoản demo: `customer@`, `admin@`, `sales@`, `warehouse@example.test`, mật khẩu `Demo@1234567890!`.
- PHP không tự đọc `.env` khi chạy CLI. PowerShell: `$env:CLIENT_URL='http://localhost:5173'; $env:DB_HOST='127.0.0.1'; php -S localhost:8080 -t server server/index.php`.
- `php server/tests/auth-profile-test.php`: guard 4 role + validation (không cần DB).
- `php server/tests/admin-user-management-test.php`: phân quyền ADMIN, filter/pagination validation, chuẩn hóa, băm mật khẩu, trùng thông tin, chặn tự khóa/hạ quyền ADMIN cuối, audit/status (không cần DB).
- `node --test scripts/auth-profile-api.test.mjs` (đặt `API_TEST_URL` nếu khác `http://127.0.0.1:8080`): HTTP + MySQL thật — cookie/CSRF/CORS, 3 role nội bộ, đăng ký, hồ sơ, CRUD địa chỉ và quyền sở hữu, race địa chỉ mặc định, khóa sau 5 lần sai, đổi mật khẩu hủy phiên khác, khôi phục một lần, đổi email bằng mã, ảnh đại diện. Test tạo tài khoản mới mỗi lần chạy: **chỉ chạy trên database thử nghiệm**, chạy API với `AUTH_IP_MAX_FAILURES=1000` để các lần chạy liên tiếp không tự chặn IP 127.0.0.1.
