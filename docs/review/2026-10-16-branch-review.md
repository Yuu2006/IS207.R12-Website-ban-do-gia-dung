# Review và tích hợp nhánh — 16/10/2026

Người review/tích hợp: Tuấn Vũ (TV1). Nhánh nền: `develop` local, tạo từ `origin/main` (`198ce85`) vì remote chưa có `develop`. Chưa push.

## Tình trạng merge các nhánh

| Nhánh | PR | Trạng thái trước 16/10 | Kết quả |
| --- | --- | --- | --- |
| `setup/project-structure`, `feature/database-schema`, `deetung/product-comparision`, `feature/order-management-ui`, `UI/Login-form`, `feature/customer-order-checkout` | #1–#4, #6, #8 | Đã merge vào main | Không cần làm gì |
| `home-product/lan-chi` (`6df1ccf`) | #9 (open) | Chưa merge | Merge `be6ac47` |
| `users/le-tan-vi` (6 commit, `15f04fd`) | Chưa có PR | Chưa merge | Merge `922e957` |
| `feature/auth-profile-demo` (`a8a09d1`, local) | Chưa push | Chưa merge | Merge `59c6c1b` + hoàn thiện task 9 |

Xung đột chính: ba nhánh tự dựng `server/index.php`, cơ chế session và `auth/role-middleware.php` khác nhau; hai cơ chế phiên phía client (`CustomerAuthContext` và `AuthContext`). Cách giải quyết ghi ở từng mục.

Kiểm chứng sau tích hợp (PHP 8.3.35 + MySQL 8.4.11 tạm): `php -l` toàn bộ `server/`; `auth-profile-test.php` 38 pass; `scripts/auth-profile-api.test.mjs` 5/5; `order-api.test.php` 21/21; `order-api-http.test.mjs` 8/8; `run-order-mysql-tests.mjs` 33 + 4 race pass; client `npm test` 48/48, `npm run build` pass. Baseline + 008/009 + 008_order + 010 + seed áp sạch trên DB mới.

---

## PR #9 — `home-product/lan-chi` (Lan Chi): catalog management + upload API

**Điểm tốt**
- Upload kiểm tra MIME thực (`finfo`) + `getimagesize`, giới hạn 5 MB và 6000×6000, whitelist thư mục, tên file ngẫu nhiên — đúng yêu cầu upload an toàn.
- Biến động kho dùng transaction + `SELECT … FOR UPDATE`, chặn xuất vượt tồn, lưu tồn trước/sau, mã tham chiếu unique → 409.
- Xóa sản phẩm là soft delete sản phẩm + SKU trong transaction; `updateProduct` whitelist cột; prepared statement xuyên suốt; CORS theo `CLIENT_URL`.

**Cần sửa** (✅ = đã xử lý khi tích hợp)
1. ✅ *Cao* — Tự làm đăng nhập nhân viên riêng (`$_SESSION['user_id']`, `/auth/staff/*`, `auth-model.php`) trùng phần TV1 và cho cả role `TECHNICIAN` (ngoài MVP). Đã thay bằng phiên chung; `requireAdmin()` giữ nguyên tên nhưng đọc principal chung và ném `ApiException` (index trả JSON 401/403). `auth-model.php` bị gỡ.
2. ✅ *Cao* — Các thao tác ghi dùng cookie nhưng không chống CSRF. Router chung bắt buộc `X-CSRF-Token` cho mọi POST/PUT/DELETE `/api/*` (gồm upload).
3. ✅ *Trung bình* — `docker-compose.yml` đổi cổng API 8080 → 8081 trong khi client/`.env.example` vẫn 8080. Đã trả về 8080.
4. *Trung bình* — WH-03/04: `inventory_movements.performed_by` không được ghi, lý do (`note`) không bắt buộc, chỉ ADMIN điều chỉnh được (WAREHOUSE không), và `GET /api/inventory`, `/api/inventory/movements` công khai cho người chưa đăng nhập. → Sửa trong task 12 (TV1).
5. *Trung bình* — `createProduct` ghi `stock_quantity` ban đầu trực tiếp, không tạo movement → vi phạm "điều chỉnh kho luôn có log". → Task 12: SKU mới bắt đầu 0, nhập kho qua movement.
6. *Trung bình* — `GET /api/products` công khai trả cả sản phẩm `is_active = 0` và nhận `is_active` từ client; CUS-06 yêu cầu storefront chỉ hiện bản ghi đang hoạt động. Đề xuất: mặc định lọc active cho khách, chỉ ADMIN xem tất cả (task 11 của Lan Chi).
7. *Trung bình* — SQL nằm trực tiếp trong controller (inventory, movement, category, brand, banner…), lệch phân lớp AGENTS §5 (controller → service → model). Không refactor trong đợt tích hợp; nên chuyển dần khi sửa từng module.
8. *Thấp* — Giá ép `(float)` khi tạo SKU; nên kiểm tra chuỗi số thập phân và lưu DECIMAL, tránh float cho tiền.
9. *Thấp* — Chưa có API thêm/sửa SKU, giá khuyến mãi, định nghĩa thuộc tính theo danh mục, ảnh sản phẩm (PRD-04/05/06, ADM-PRO-03); banner admin chỉ thấy banner đang hiển thị. → Task 12 bổ sung.
10. *Thấp* — Upload trả `image_url` tương đối (`/uploads/...`) nhưng banner/brand yêu cầu URL http(s) tuyệt đối → client phải ghép `VITE_API_URL`. Nên thống nhất một dạng.
11. *Thấp* — Seed demo dùng danh mục nồi chiên/làm sạch/lọc nước, tiếng Việt không dấu; nghiệm thu cần 10–20 sản phẩm mỗi nhóm tủ lạnh/máy giặt/máy lạnh. Migration số 008 trùng với `008_order_runtime.sql`.

**Kết luận**: Approve có điều kiện — đã merge để tích hợp; mục 4–6, 9 do task 12 xử lý, mục 6–8 nhờ Lan Chi xem trong task 11.

---

## `users/le-tan-vi` (Tấn Vĩ): order/checkout service layer — chưa mở PR

**Điểm tốt**
- Rất chặt: idempotency key, version (optimistic lock), state machine, CSRF/Origin, snapshot, fail-closed 503 khi thiếu adapter, không tin giá frontend.
- Test phong phú: 21 unit PHP, 8 HTTP, 33 MySQL + 4 race hai tiến trình chạy trên MySQL tạm; OpenAPI đầy đủ.

**Cần sửa** (✅ = đã xử lý khi tích hợp)
1. ✅ *Cao* — Chờ contract phiên `$_SESSION['user']/expiresAt` và endpoint `/auth/customer/session|logout` chưa tồn tại; client có phiên khách riêng (`CustomerAuthContext`, `auth-client.js` với OTP preview). Đã nối: `index.php` chuyển principal chung sang đúng contract order API; `CustomerAuthContext` thành adapter trên `AuthProvider`; bỏ `auth-client.js`, `parsePreviewSession` và 3 test OTP/preview liên quan, thêm test adapter.
2. ✅ *Trung bình* — `auth/role/validation-middleware.php` dùng `namespace` không ngoặc nên không thể chứa guard global của module khác. Đã chuyển sang namespace có ngoặc: khối `HomeCare\OrderApi` giữ nguyên nội dung, khối global chứa guard auth/catalog.
3. ✅ *Trung bình* — `api-client.js` đọc CSRF từ cookie `XSRF-TOKEN` nhưng auth chưa cấp. Server nay đặt cookie này (không phải cookie xác thực).
4. *Trung bình* — Envelope lỗi khác hai module còn lại: order dùng `errors: { code, fields }`, auth dùng `errors: { field: message }`, catalog chỉ có `message`. Cần cả nhóm chốt một contract trước khi nối thêm UI.
5. *Trung bình* — Nhánh chưa có PR/review chéo theo cặp TV1↔TV3; lần này merge trực tiếp để tích hợp. Lần sau mở PR vào `develop`.
6. *Thấp* — Code rất đặc (nhiều điều kiện trên một dòng, file > 300 dòng) và OpenAPI ~3.900 dòng — khó giải thích khi bảo vệ đồ án; nên tách hàm/ghi chú ngắn ở chỗ phức tạp.
7. *Thấp* — Hai migration cùng số 008 (với `008_product_attributes.sql`); thứ tự áp dụng đã ghi trong `server/db/README.md`. Migration mới đánh số từ 011.
8. Phụ thuộc mở: adapter `CheckoutDependencies` (giỏ/voucher của Lan Chi, kho, địa chỉ của TV1). API địa chỉ MySQL đã sẵn (`GET /users/me/addresses`, ID chuỗi số) để Vĩ viết phần `lockForCreate` địa chỉ.

**Kết luận**: Approve — đã merge, toàn bộ test của Vĩ pass sau tích hợp.

---

## `feature/auth-profile-demo` (Tuấn Vũ) — tự review

1. ✅ *Cao* — Auth chỉ là mock (localStorage/phiên PHP), đăng nhập khách bằng OTP trái đặc tả CUS-01/02 (email + mật khẩu; OTP ngoài MVP). Đã thay bằng auth MySQL thật (task 9).
2. ✅ *Cao* — `migrations/001_auth_profile.sql` tạo lại `users/addresses`, không chạy được sau baseline. Thay bằng `010_auth_profile.sql` (ALTER).
3. ✅ *Trung bình* — Rate limit chỉ theo phiên. Thêm khóa theo tài khoản 15 phút sau 5 lần sai; giới hạn theo phiên giữ lại kèm ghi chú.
4. Còn lại: chưa có giới hạn theo IP, đổi email đăng nhập, ảnh đại diện; mã khôi phục hiển thị trên trang (mô phỏng CUS-03, chặn ở production).

## Việc cần nhóm quyết định

- Tạo `develop` trên remote và mở PR `develop` → `main`, hay giữ quy ước PR thẳng vào `main` như #1–#9? (AGENTS/GIT-WORKFLOW ghi `develop`.)
- Chốt một envelope lỗi chung (mục Vĩ-4).
- Đóng PR #9 sau khi `develop` được đẩy lên (PR #9 trỏ vào `main`).
