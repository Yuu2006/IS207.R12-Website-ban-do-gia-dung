# Task 1, 2, 9 — Auth/RBAC, hồ sơ và địa chỉ (Tuấn Vũ)

Cập nhật 16/10/2026 trên nhánh tích hợp `develop` (local, tạo từ `origin/main` vì remote chưa có `develop`). Thay bản mock 06/10 bằng auth MySQL thật.

| Task (task.xlsx) | Trạng thái | Ghi chú |
| --- | --- | --- |
| 1 — [Tuần 1] App shell, đăng nhập/đăng ký, menu và route guard 4 role | Hoàn thành | Shell + menu + `ProtectedRoute`; guard React chỉ hỗ trợ UX, API kiểm tra role độc lập |
| 2 — [Tuần 1] Hồ sơ và địa chỉ bản mẫu, contract | Hoàn thành | Contract địa chỉ (`docs/api/AUTH-PROFILE.md`) dùng cho checkout của Tấn Vĩ (`addressId` chuỗi số) |
| 9 — [Tuần 2] Kết nối tài khoản, hồ sơ, địa chỉ thật | Hoàn thành | MySQL/PDO, `password_hash`, PHP session + CSRF, khóa tạm sau 5 lần sai, đổi/quên mật khẩu (mã demo), kiểm tra chủ sở hữu |

## Thay đổi chính

- **Một router, một phiên** (`server/index.php`): auth/users → catalog `/api/*` (Lan Chi) → order API (Tấn Vĩ). Phiên `HOMECARE_SESSION` do auth cấp; catalog đọc qua `requireAdmin()/requireSessionRole()`, order API nhận bản sao phiên theo contract `user/expiresAt/csrfToken` của nó. Không module nào còn tự đăng nhập riêng.
- **Auth theo đặc tả CUS-01..03**: email + mật khẩu (OTP ngoài MVP). Đăng ký chỉ tạo CUSTOMER; cổng `/auth/login` (khách) và `/auth/staff/login` (nhân viên) tách nhau. Đổi mật khẩu/đặt lại mật khẩu làm phiên cũ hết hiệu lực (dấu hash trong principal).
- **DB**: dùng bảng baseline, thêm `migrations/010_auth_profile.sql` (unique phone, ngày sinh, khóa tạm) và `seeds/001_auth_demo_users.sql`. Bỏ migration 001 mock không tương thích baseline.
- **Client**: bỏ mock trình duyệt (`demo-service.js`) và OTP; `services/auth-service.js`, `user-service.js` gọi API thật. `CustomerAuthContext` thành adapter trên `AuthProvider` để trang đơn hàng của Tấn Vĩ dùng chung phiên. Hồ sơ có ngày sinh, email chỉ đọc, form đổi mật khẩu; `/forgot-password` cho khách.

## Kiểm chứng đã chạy (16/10/2026)

Môi trường: PHP 8.3.35 NTS portable + MySQL 8.4.11 ZIP, datadir tạm ngoài repo, cổng 33071 (Docker Desktop trên máy lỗi khởi động).

| Kiểm tra | Kết quả |
| --- | --- |
| `php -l` mọi file trong `server/` | Pass |
| Áp baseline → 008/009 → 008_order → 010 → seed 001/002 lên DB mới | Pass, không lỗi |
| `php server/tests/auth-profile-test.php` | 38 kiểm tra pass (ma trận 4×4 role, 401/403, `requireAdmin`, validation đăng ký/hồ sơ/địa chỉ) |
| `node --test scripts/auth-profile-api.test.mjs` (PHP + MySQL thật) | 5/5 nhóm pass: cookie HttpOnly/SameSite, CSRF/CORS/JSON/413/405; 3 role nội bộ + sai cổng; đăng ký 201/409; hồ sơ (email bị chặn, phone trùng 409, ngày sinh); CRUD địa chỉ + chủ sở hữu 404; race 2 phiên đặt mặc định → đúng 1 mặc định; khóa sau 5 lần sai (429); đổi mật khẩu hủy phiên khác; khôi phục mật khẩu dùng một lần |
| Order API của Tấn Vĩ sau gộp: `order-api.test.php`, `order-api-http.test.mjs`, `run-order-mysql-tests.mjs` | 21/21, 8/8, 33/33 + 4 race pass |
| Client `npm test` / `npm run build` | 48/48 pass / build pass |

## Chạy lại

```powershell
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='3306'; $env:CLIENT_URL='http://localhost:5173'
php -S 127.0.0.1:8080 -t server server/index.php
```

Terminal khác: `php server/tests/auth-profile-test.php`, `node --test scripts/auth-profile-api.test.mjs` (chỉ trên DB thử nghiệm — test tạo tài khoản mới).

## Giới hạn còn lại

- Mã khôi phục mật khẩu hiển thị trên trang (chưa có email); bị chặn ở production. Đổi email đăng nhập và ảnh đại diện chưa làm.
- Giới hạn tần suất theo phiên có thể bị bỏ qua khi xóa cookie; khóa theo tài khoản là lớp chặn chính. Chưa có giới hạn theo IP.
- Checkout thật vẫn chờ adapter `CheckoutDependencies` (giỏ/voucher/kho); trong Vite dev trang đơn dùng order mock của Tấn Vĩ với user thật.
- Chưa kiểm tra trực quan trên trình duyệt sau khi đổi sang API thật (xem báo cáo bàn giao).
