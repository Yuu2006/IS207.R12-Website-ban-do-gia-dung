# CLAUDE.md — IS207.R12 Website bán đồ gia dụng

Tổng hợp nhanh về yêu cầu, tình trạng và cách tổ chức repo. **Quy tắc chi tiết (bảo mật, bất biến nghiệp vụ, Git, commit) nằm trong [`AGENTS.md`](AGENTS.md)** — đọc file đó trước khi sửa code; file này chỉ tóm tắt và không thay thế nó. Giao tiếp bằng tiếng Việt; tên định danh trong code và commit dùng tiếng Anh.

> Tình trạng bên dưới là snapshot ngày **21/10/2026** (nhánh `develop`, commit `91aabae`). Luôn kiểm tra code thực tế (`git log`, `git status`, file liên quan) trước khi tin vào mục "tình trạng".

## 1. Dự án

Đồ án môn IS207.R12 — website thương mại điện tử đồ gia dụng (tập trung tủ lạnh, máy giặt, máy lạnh).

- Stack: **React 19 + Vite 7 + Tailwind 4** (JS, không TypeScript) · **PHP thuần + PDO** REST API · **MySQL 8.4** · Docker Compose · VNPay Sandbox.
- Đặc tả chuẩn: `Dac_ta_chuc_nang_Website_Thuong_mai_dien_tu_Do_gia_dung_MVP_hoan_chinh(1).docx` (ở gốc repo). Mapping mã yêu cầu → module: `docs/requirements/FUNCTION-MAPPING.md` (còn lỗi thời, xem §4).
- Bốn vai trò cố định: `CUSTOMER`, `ADMIN`, `SALES`, `WAREHOUSE`.

## 2. Yêu cầu / phạm vi MVP

**P0 — luồng mua hàng hoàn chỉnh:** tài khoản/hồ sơ/địa chỉ; danh mục, thương hiệu, sản phẩm, SKU, thông số động; tìm kiếm/lọc, wishlist, đánh giá; giỏ hàng, một voucher/đơn, checkout, COD; đơn hàng, hủy, trả hàng + hoàn tiền mô phỏng; tồn kho cơ bản; quản trị, thông báo trong web, dashboard, CSV, audit log. **VNPay Sandbox cũng thuộc nghiệm thu.**

**P1 — khác biệt:** HOME-01 hồ sơ không gian · FIT-01/ADM-FIT-01 FitCheck Lite (3 mức: Phù hợp / Cần kiểm tra thêm / Không phù hợp, có giải thích) · TCO-01 chi phí sở hữu 1/3/5 năm · LIFE-01/CARE-01/ADM-CARE-01 Thiết bị của tôi + bảo trì · FIT-02 checklist giao lắp · BOT-01..06 chatbot theo quy tắc (không LLM) + so sánh 2–4 sản phẩm · REV-03 đánh giá theo bối cảnh.

**Ngoài MVP (không tự thêm):** sửa chữa, kỹ thuật viên, nhà cung cấp/phiếu nhập, RBAC động, AR/3D, chẩn đoán ảnh, thu cũ đổi mới, OTP SMS, hoàn tiền ngân hàng tự động, LLM/vector DB/Elasticsearch. Code cũ của các module này vẫn còn trong repo (đồng đội viết) — **không xóa**, không phát triển thêm.

**Bất biến cần nhớ** (chi tiết ở AGENTS.md §8): backend tính lại giá/voucher/phí/tồn tại checkout; SKU là đơn vị tồn kho; snapshot tên/giá/địa chỉ vào đơn; tách trạng thái đơn và thanh toán; chống bán vượt tồn bằng transaction + khóa; hủy/hoàn kho chỉ một lần (idempotent); tiền dùng DECIMAL, không float; callback VNPay phải kiểm chữ ký/số tiền và idempotent; điều chỉnh kho luôn có log (trước/sau, người, lý do); không dùng `eval` cho quy tắc FitCheck.

## 3. Cách tổ chức file

```text
.
├── AGENTS.md / CLAUDE.md      # Quy tắc agent / tổng hợp (file này)
├── README.md                  # Giới thiệu, chạy dự án (còn mô tả phạm vi cũ)
├── Dac_ta_...MVP_hoan_chinh(1).docx   # Đặc tả chuẩn
├── docker-compose.yml         # db (MySQL 8.4) :3306, api :8080, client :5173
├── .env.example               # Mẫu biến môi trường (copy thành .env, không commit .env)
├── database/schema_database.sql   # Baseline schema (chứa cả bảng phạm vi cũ)
├── client/                    # React + Vite
├── server/                    # PHP REST API
├── scripts/                   # Test client / script kiểm thử API (.mjs)
├── docs/                      # api/, database/, guide/, plan/, requirements/, review/
├── task/README.md             # Bảng chia task (chỉ là hướng dẫn)
└── outputs/                   # Artifact của agent, chưa track (untracked)
```

### Frontend — `client/src`

| Thư mục | Nội dung hiện có |
| --- | --- |
| `routes/` | `AppRoutes.jsx` (toàn bộ route), `ProtectedRoute.jsx` (guard theo role), `CustomerRoute.jsx` |
| `layouts/` | `AppShell.jsx` — shell sau đăng nhập cho bốn role |
| `pages/public/` | `HomePage`, `ProductListPage`, `ProductDetailPage` |
| `pages/login-form/`, `staff-login/` | Đăng nhập/đăng ký khách (`/login`, `/register`), nhân viên (`/internal/login`), quên mật khẩu |
| `pages/customer/` | `ProfilePage`, `AddressesPage`, `Checkout`, `OrderHistory`, `OrderWorkspace` |
| `pages/admin/` | `CatalogAdminPage` (sản phẩm, SKU, ảnh, thuộc tính, thương hiệu, danh mục, banner) |
| `pages/warehouse/` | `InventoryPage`, `InventoryHistoryPage` |
| `pages/sales/` | `SalesOrders` (route `/sales/orders` dùng `OrderWorkspace`) |
| `pages/auth/WorkspacePage.jsx` | Trang **placeholder** cho các route chưa làm (`/admin/users`, `/vouchers`, `/reports`, `/sales/returns`, `/customer`, `/warehouse`…) |
| `components/` | `Header`, `Footer`, `ProductCard`, `admin/`, `order/`, `common/FormField`; `cart/`, `chatbot/`, `product/` còn rỗng (`.gitkeep`) |
| `context/` | `AuthContext` (phiên chung), `CustomerAuthContext` (adapter), `OrderServiceContext` |
| `services/` | `api-client.js`, `http-client.js` (axios, CSRF), `auth-service`, `user-service`, `catalog-service`, `order-service`, `order-mock-service`, `order-ui-data` |
| `utils/`, `hooks/` | `account-validation`, `customer-session`, `order-state`; `use-order-api` |
| `tests/` (ngoài `src`) | 4 file `node --test` |

Quy ước: component PascalCase, service mới dạng `product-service.js`, 2 spaces; cấu hình API tập trung ở `services/`, không hardcode host.

### Backend — `server/`

Luồng: `index.php` (router + CORS + session + CSRF) → `routes/` → `controllers/` → `services/` → `models/` (PDO) → MySQL. File đặt tên `xxx-controller.php`, `xxx-service.php`… (4 spaces).

- `index.php` điều phối ba nhóm: `/auth/*`, `/users/*` (auth/hồ sơ/địa chỉ) · `/api/*` (catalog, kho, upload) · còn lại → Order API (`utils/order-api.php`, namespace `HomeCare\OrderApi`, có contract/CSRF riêng).
- `middleware/`: `auth-middleware`, `role-middleware`, `validation-middleware` (dùng namespace có ngoặc, chứa cả guard global và phần của Order API).
- `utils/`: `response.php`, `api-response.php`, `order-api.php`, `order-domain.php`.
- `db/migrations/` (008 ×2, 009, 010, 011), `db/seeds/` (001 user demo, 002 demo, 003 30 sản phẩm: 10 tủ lạnh / 10 máy giặt / 10 máy lạnh). Migration mới đánh số từ **012**.
- `tests/`: PHP/MJS cho auth và order (runner MySQL cô lập `run-order-mysql-tests.mjs`).
- `uploads/` (avatars, products, …) bị `.gitignore`, chỉ giữ `.gitkeep`.
- **Cảnh báo:** nhiều file controller/service/model/route chỉ có 2 dòng (scaffold rỗng) — xem §4, đừng coi là đã làm.

### Tài liệu — `docs/`

`api/AUTH-PROFILE.md`, `api/CATALOG-ADMIN-INVENTORY.md`, `api/order-checkout.openapi.json` · `database/AUTH-PROFILE.md` · `plan/TASK-1-AUTH-PROFILE.md`, `plan/TASK-3-ORDER-UI.md` (trạng thái order/checkout chi tiết) · `review/2026-10-16-branch-review.md` (review + việc còn mở) · `guide/GIT-WORKFLOW.md` · `server/db/README.md` (thứ tự dựng DB). Khi đổi API/schema phải cập nhật tài liệu tương ứng.

## 4. Tình trạng hiện tại

### Đã có và chạy thật

| Mảng | Mã | Ghi chú |
| --- | --- | --- |
| Auth / hồ sơ / địa chỉ | CUS-01..05 | Đăng ký/đăng nhập email+mật khẩu, PHP session (cookie HttpOnly `HOMECARE_SESSION`) + CSRF, khóa tạm sau 5 lần sai + giới hạn theo IP, đổi mật khẩu, đổi email có xác minh, avatar, CRUD địa chỉ, route guard 4 role. Quên mật khẩu: mã hiển thị trên trang (chưa có email, tắt khi `APP_ENV=production`). Profile hiện ở chế độ chỉ đọc + nút sửa. |
| Catalog admin | PRD-*, ADM-PRO-03 | Sản phẩm, SKU, giá khuyến mãi, thư viện ảnh, thuộc tính theo danh mục, thương hiệu, danh mục, banner, upload an toàn; soft delete. |
| Kho | WH-03/04 | Nhập/xuất/điều chỉnh qua `inventory_movements` (transaction + `FOR UPDATE`, lưu người/lý do/tồn trước-sau), trang tồn kho + lịch sử cho WAREHOUSE/ADMIN. |
| Storefront (đọc) | một phần CUS-06.. | Trang chủ, danh sách, chi tiết sản phẩm; seed 30 sản phẩm mô phỏng. |
| Order/checkout service | ORD, một phần CHK | State machine, idempotency key, optimistic version, snapshot, return request; test PHP + MySQL cô lập. **Mặc định tắt** (`ORDER_STORAGE_MODE=disabled`); client mặc định dùng **mock** (`VITE_ORDER_API_MODE=mock`). |

### Chưa làm / mới là scaffold

- **Chưa có:** giỏ hàng, voucher, thanh toán (COD hoàn chỉnh + **VNPay**), wishlist, đánh giá, thông báo, báo cáo/dashboard/CSV, audit log (UI + API), người dùng/phân quyền admin, trả hàng/hoàn tiền phía SALES (UI mới là placeholder).
- **Chưa có toàn bộ P1:** HOME, FitCheck, TCO, Thiết bị của tôi/bảo trì, chatbot/so sánh (nhánh `remotes/origin/feature/chatbot-design-contract`, `feature/home-fit-tco-care`, `feature/product-comparison` đã tồn tại trên remote — kiểm tra trước khi làm lại).
- **Adapter checkout production (`CheckoutDependencies`) chưa có** → checkout/hủy/mua lại trả 503 khi bật MySQL; `test_cart_versions` chỉ là fixture test, không phải schema giỏ hàng.
- Phí vận chuyển, thời điểm giữ/trừ tồn production: đang là giả định trong fixture/tài liệu, chờ nhóm chốt.

### Nợ kỹ thuật / việc mở (theo `docs/review/2026-10-16-branch-review.md`)

1. Envelope lỗi chưa thống nhất: order dùng `errors: {code, fields}`, auth dùng `errors: {field: msg}`, catalog chỉ có `message`.
2. SQL còn nằm trong controller catalog/kho (brand, category, banner, inventory…) — lệch phân lớp; chuyển dần khi sửa module.
3. `GET /api/products` công khai còn lộ sản phẩm `is_active=0`; giá ép `(float)` khi tạo SKU; `image_url` upload là đường dẫn tương đối nhưng banner/brand yêu cầu URL tuyệt đối.
4. Còn nhiều file phạm vi cũ (repair, technician, supplier, serial, warranty + schema baseline) — giữ nguyên, không triển khai.
5. `docs/requirements/FUNCTION-MAPPING.md` và `README.md` còn BOT-01..07/module cũ; cập nhật khi chạm tới.
6. Chạy lại test order trên MySQL 8.4 (đã chạy trên 26.7.0 và 8.4.11 tạm); chưa có lint, chưa có test runner ngoài `node --test`.
7. Git: `develop` đã có trên remote (PR #10 đã merge); quy ước PR vào `develop`, `develop` → `main` là bước phát hành của nhóm.

### Nhánh

`main` (ổn định) · `develop` (tích hợp, nhánh hiện tại) · `feature/<module>-<task>`, `fix/<name>`. Nhánh cá nhân còn tồn tại: `home-product/lan-chi`, `users/le-tan-vi`, `feature/auth-*`, `feature/admin-catalog-inventory`, `feature/customer-order-checkout`.

## 5. Lệnh thường dùng

```bash
# Frontend (từ client/)
npm install
npm run dev        # Vite :5173
npm run build
npm test           # node --test (4 file trong client/tests)

# Toàn bộ stack
cp .env.example .env
docker compose up -d --build    # db :3306, api :8080, client :5173

# Backend
php -l <file.php>                          # kiểm cú pháp mỗi file PHP đã sửa
php server/tests/auth-profile-test.php     # cần MySQL có baseline + migration
node scripts/auth-profile-api.test.mjs
node scripts/catalog-inventory-api.test.mjs
node server/tests/run-order-mysql-tests.mjs   # cần PHP_BIN, PHP_EXTENSION_DIR, MYSQLD_BIN; tự dựng MySQL tạm
```

**Dựng DB mới (một lần, có backup):** baseline `database/schema_database.sql` → `008_product_attributes` → `009_product_attribute_values` → `008_order_runtime` → `010_auth_profile` → `011_auth_catalog_completion` → seeds `001`, `002`, `003`. Chi tiết: `server/db/README.md`. Compose **không tự chạy** các file này.

**Tài khoản demo** (chỉ môi trường demo): `customer@`, `admin@`, `sales@`, `warehouse@example.test` — mật khẩu `Demo@1234567890!`.

## 6. Nguyên tắc làm việc nhanh

- Đọc AGENTS.md; tìm helper/code có sẵn trước khi viết mới; làm phần nhỏ nhưng đủ từ UI đến dữ liệu.
- Không đổi stack, không format hàng loạt, không tự DROP/TRUNCATE/reset DB hay volume, không commit `.env`/dump.
- Tiền, tồn kho, quyền, idempotency: ưu tiên test hồi quy. Báo cáo rõ cái gì đã chạy, chưa chạy, bị chặn bởi môi trường; scaffold/mock không tính là hoàn thành.
- Commit tiếng Việt `type(scope): mô tả ngắn`; không push trực tiếp `main`/`develop`, PR vào `develop`.
- Thay đổi API/schema → cập nhật `docs/api/`, `docs/database/` và `server/db/README.md`.
