# Task 1 — Auth, app shell, hồ sơ và địa chỉ demo

Ngày bàn giao: 06/10/2026. Branch: `feature/auth-profile-demo`, tạo từ `main` vì checkout hiện tại chưa có `develop`. Phạm vi CUS-01..05 ở mức mock/contract, không đánh dấu auth production hoặc toàn bộ MVP hoàn thành.

## Đối chiếu và kết quả triển khai

| Hạng mục | Trước thay đổi | Sau thay đổi |
| --- | --- | --- |
| Đăng nhập/đăng ký CUSTOMER | Form OTP độc lập, chưa có principal/shell | Tạo phiên demo, đăng ký chỉ CUSTOMER, hết hạn và đăng xuất |
| Đăng nhập nội bộ | Form có sẵn, API chưa triển khai | Demo ADMIN/SALES/WAREHOUSE, kiểm tra mật khẩu và điều hướng đúng role |
| Shell/menu/routes | Header và giao diện đơn hàng riêng | Shell chung, menu bốn role, guard, placeholder ghi rõ, giữ trang public và UI đơn hàng |
| Hồ sơ | Chưa có trang/service hoàn chỉnh | GET/PATCH self-profile, form tên/email/phone, validation và liên hệ trùng |
| Địa chỉ | Chưa có CRUD | Thêm/sửa/xóa mềm, đúng chủ sở hữu, đúng một mặc định nếu còn địa chỉ |
| BE auth/profile | File scaffold | Native PHP session mock, response helper, controller/service/model, role guard và validation |
| Contract/schema | Chưa chốt module | `docs/api/AUTH-PROFILE.md`, `docs/database/AUTH-PROFILE.md`, migration DB mới |

## Source và luồng chính

- `client/src/App.jsx` lắp router/provider; `context/auth-context.js` giữ context ổn định, `context/AuthContext.jsx` quản lý vòng đời phiên. Tách context khỏi component tránh mất context khi Vite Fast Refresh cập nhật service.
- `routes/AppRoutes.jsx` → `ProtectedRoute.jsx` → `layouts/AppShell.jsx`: route theo role, giữ đường dẫn cần quay lại sau đăng nhập. `pages/auth/WorkspacePage.jsx` dựng tổng quan và placeholder.
- `pages/login-form/LoginForm.jsx`, `pages/staff-login/StaffLogin.jsx` → `services/auth-service.js`: đăng nhập/đăng ký, cập nhật context, chuyển workspace.
- `pages/customer/ProfilePage.jsx`, `AddressesPage.jsx` → `services/user-service.js`: loading/error/retry, required fields, lưu và thông báo kết quả, chặn gửi lặp. Form địa chỉ nhận focus khi mở trên mobile.
- `services/demo-service.js`: localStorage hồ sơ/địa chỉ, sessionStorage phiên/OTP, mỗi thao tác lọc chủ sở hữu. `http-client.js`: API URL, cookie, CSRF, envelope/lỗi tập trung; không tự chuyển sang mock khi API lỗi.
- `server/index.php` → `routes/` → `controllers/` → `AuthService`/`UserService` → `UserModel`: repository mock riêng trong phiên PHP. Middleware kiểm tra principal, bốn role, whitelist request và validation.

Ví dụ request/response, ma trận quyền, mã lỗi và tài khoản demo nằm trong tài liệu API. Quy tắc mặc định: địa chỉ đầu tiên mặc định; chọn mới bỏ cờ cũ; xóa mặc định chọn địa chỉ hoạt động đầu tiên còn lại; xóa cuối cùng trả danh sách rỗng. ID của người khác trả 404.

## Kiểm chứng đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend `npm test`, Node test runner | 7/7 nhóm pass, không skip |
| `npm run build`, Vite 7.3.6 | Pass, 1.946 modules, không lỗi build |
| Cú pháp 13 file PHP thay đổi/thêm | `php -l` pass bằng PHP 8.3.35 portable |
| `php server/tests/auth-profile-test.php` | 62 kiểm tra pass: principal giả ma trận 4×4, thiếu/hết hạn/vô hiệu/sai role, OTP, mật khẩu, hồ sơ và địa chỉ |
| HTTP `scripts/auth-profile-api.test.mjs` | 4/4 nhóm pass, không skip: cookie/session rotation, CSRF/CORS, JSON/method/status, bốn role, ownership, default address, khóa mock khi không bật |
| Browser demo + FE nối PHP API mock | Đăng nhập bốn role; đăng ký CUSTOMER; wrong password/role; profile/address CRUD; reload giữ dữ liệu đúng chế độ |
| Desktop 1280×900 và mobile 390×844 | Đã xem trực tiếp; form/menu hoạt động, header mobile có nhãn tài khoản, document không tràn ngang (375 ≤ 390), focus vào form địa chỉ |
| API mất kết nối rồi phục hồi | Lưu hồ sơ báo lỗi, giữ input, không báo thành công giả; lưu lại thành công sau phục hồi |
| Fast Refresh sau tách context | Cập nhật service/provider không còn lỗi mất context ở tab tải mới; console lỗi rỗng |
| `git diff --check` | Pass |

Kịch bản UI đã thao tác: bỏ trống tên/tỉnh/đường bị chặn; cập nhật hồ sơ đồng bộ tên header; thêm hai địa chỉ, sửa, chuyển mặc định, xóa mặc định và chọn thay thế; CUSTOMER vào ADMIN bị chặn; ADMIN vào địa chỉ CUSTOMER bị chặn; WAREHOUSE vào trang kho; SALES vào UI xử lý đơn; đăng xuất chặn route cần phiên; khách vừa đăng ký không thấy địa chỉ của khách trước.

## Chạy lại

Frontend từ `client/`: `npm test`, `npm run build`, `npm run dev`. Dùng demo độc lập mặc định ở Vite dev. Build/preview cần `VITE_AUTH_DEMO=true` nếu muốn browser demo.

PHP cần runtime khả dụng. Từ repository root, chạy API mock trong một terminal PowerShell:

```powershell
$env:AUTH_DEMO = 'true'
$env:APP_ENV = 'development'
$env:CLIENT_URL = 'http://localhost:5173,http://127.0.0.1:5173'
php -S 127.0.0.1:8080 -t server server/index.php
```

Trong terminal khác chạy `php server/tests/auth-profile-test.php` và `node --test scripts/auth-profile-api.test.mjs`. `API_TEST_URL` đổi URL API (mặc định `http://127.0.0.1:8080`). Kiểm tra khóa mock cần thêm một PHP server với `AUTH_DEMO=false` ở port khác và đặt `API_DISABLED_URL` trước chạy test; nếu không có biến này, nhóm thứ tư được skip.

FE nối API: đặt `VITE_AUTH_DEMO=false`, `VITE_API_URL=http://127.0.0.1:8080` trước khởi động Vite; CLIENT_URL phải chứa origin frontend. Test UI đã chạy cả browser demo và API mock tại hai port Vite 5173/5174.

## Giới hạn và phần tiếp theo

- Dữ liệu vẫn là mock: browser theo localStorage/tab; API theo cookie PHP, không đồng bộ dữ liệu giữa các phiên/trình duyệt. SMS/email chưa gửi thật; password reset cũ chỉ mô phỏng UI, API reset chưa có.
- MySQL/Docker chưa khả dụng tại môi trường kiểm tra; migration SQL **chưa chạy/chưa kiểm thử trên MySQL**. Migration chỉ dùng DB mới, không import cùng baseline cũ. Không sửa/xóa dữ liệu DB chung.
- Backend persistence cần nối PDO, seed demo và migration ALTER tương thích DB nhóm đang dùng. Auth thật cần provider OTP, xác minh khi đổi liên hệ, rate limit IP/account dùng chung. API mock bị chặn nếu không opt-in hoặc ở production.
- Workspace ADMIN/WAREHOUSE và phần chưa có nghiệp vụ vẫn placeholder; đơn hàng/checkout hiện giữ mock UI, chưa tích hợp hồ sơ/địa chỉ vào checkout API.
- Repository chưa cấu hình lint/Husky; không báo lint pass hoặc bổ sung dependency cho milestone này. Không thay đổi `outputs/` có sẵn.
