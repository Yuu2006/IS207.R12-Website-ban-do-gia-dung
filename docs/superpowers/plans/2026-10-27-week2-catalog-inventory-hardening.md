# Quản trị catalog và kho cơ bản (Tuần 2) — Plan hoàn thiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng các khoảng trống còn lại của "Quản trị catalog và kho cơ bản" (CRUD category/brand/product/SKU/spec/banner/giá giảm; điều chỉnh kho có actor/reason/before-after; chặn tồn âm; cảnh báo sắp hết) trên nền code đã có.

**Architecture:** Giữ nguyên luồng `routes → controllers → services → models` và các màn hình hiện có. Backend chỉ bổ sung/sửa ở catalog công khai, xóa mềm SKU, chặn tiền dạng float, siết kho; frontend thêm xóa SKU, lọc trạng thái và khối cảnh báo sắp hết ở trang tổng quan. Không đổi schema (không migration mới).

**Tech Stack:** PHP thuần + PDO, MySQL 8.4, React 19 + Vite, `node --test`.

**Spec:** `Dac_ta_chuc_nang_Website_Thuong_mai_dien_tu_Do_gia_dung_MVP_hoan_chinh(1).docx` (PRD-01..06, ADM-PRO-02/03, WH-01..04); hiện trạng đã làm: `docs/api/CATALOG-ADMIN-INVENTORY.md`. Hai mô tả task trong yêu cầu giống hệt nhau → gộp thành **một plan**.

## Hiện trạng (đã có, KHÔNG làm lại)

- CRUD category/brand/banner (có `sort_order`, upload ảnh an toàn), product, SKU (tạo/sửa, giá khuyến mãi có khung giờ), thông số động, thư viện ảnh: `server/controllers/*`, `catalog-admin-*`, `client/src/pages/admin/CatalogAdminPage.jsx`, `components/admin/*`.
- Kho: `POST /api/inventory/movements` (transaction + `FOR UPDATE`, actor từ session, lý do bắt buộc, before/after, `reference_code` UNIQUE), `GET` có phân trang, `GET /api/inventory?low_stock=1`; `InventoryPage`, `InventoryHistoryPage`.
- Test: `scripts/catalog-inventory-api.test.mjs` (3 test).

## Khoảng trống tìm thấy (phạm vi plan này)

1. `GET /api/products` và `GET /api/products/{id}` công khai vẫn trả sản phẩm `is_active=0` (nợ kỹ thuật #3).
2. SKU chưa có thao tác xóa mềm (chỉ tắt `is_active`); `POST /api/products` kiểm giá bằng `(float)` (vi phạm "tiền không float").
3. Kho: chưa có test đồng thời cho "không tồn âm"; cảnh báo `low_stock` đang tính cả SKU ngừng bán.
4. FE: không xóa được SKU, danh sách sản phẩm admin không lọc theo trạng thái.
5. FE: cảnh báo sắp hết chỉ nằm sâu trong trang Tồn kho; trang tổng quan `/warehouse`, `/admin` là placeholder.

## Global Constraints

- Tiền: chuỗi/số nguyên khớp `^\d{1,12}(\.\d{1,2})?$`, lưu DECIMAL, không `float`.
- Mọi thao tác ghi: session `HOMECARE_SESSION` + header `X-CSRF-Token`; catalog ghi chỉ ADMIN, kho chỉ ADMIN/WAREHOUSE.
- Tồn chỉ đổi qua `inventory_movements`; `quantity_after >= 0`; mỗi điều chỉnh lưu người, lý do, tồn trước/sau.
- Xóa là xóa mềm (`is_deleted`), không `DROP/TRUNCATE`, không xóa code phạm vi cũ.
- PHP 4 spaces, JS 2 spaces; kiểm `php -l` cho mọi file PHP sửa; commit tiếng Việt `type(scope): mô tả`, nhánh `feature/admin-catalog-inventory-week2` từ `develop`, PR vào `develop`.
- Đổi API → cập nhật `docs/api/CATALOG-ADMIN-INVENTORY.md`.

## Review Focus

- Hai yêu cầu xuất kho đồng thời toàn bộ tồn: đúng một cái thành công, tồn cuối = 0, không âm (Task 3).
- Khách/anonymous gọi trực tiếp `/api/products/{id}` của sản phẩm ngừng bán: 404 như không tồn tại (Task 1).
- Xóa SKU còn tồn > 0 hoặc đã xóa rồi: từ chối rõ ràng, không mất lịch sử kho (Task 2).
- `price` dạng `1500.5` (số thực JSON), `"12345678901234"` (13+ chữ số), `"-1"` ở `POST /api/products` (Task 2).
- SKU ngừng bán/đã xóa không được tính vào cảnh báo sắp hết; ngưỡng 0 với tồn 0 vẫn là "hết hàng" (Task 3, 5).

## File Structure

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `server/models/product-model.php` | Lọc `is_active` theo vai trò | 1 |
| `server/controllers/product-controller.php` | Truyền vai trò; kiểm giá bằng regex | 1, 2 |
| `server/routes/catalog-admin-routes.php`, `controllers/catalog-admin-controller.php`, `services/catalog-admin-service.php`, `models/catalog-admin-model.php` | `DELETE /api/variants/{id}` | 2 |
| `server/controllers/inventory-controller.php` | `low_stock` bỏ SKU không bán | 3 |
| `scripts/catalog-inventory-api.test.mjs` | Test hồi quy backend cho Task 1–3 | 1–3 |
| `client/src/services/catalog-service.js`, `components/admin/ProductAdmin.jsx` | Xóa SKU, lọc trạng thái | 4 |
| `client/src/utils/inventory-alert.js` (mới), `client/tests/inventory-alert.test.js` (mới) | Tóm tắt cảnh báo sắp hết | 5 |
| `client/src/components/admin/LowStockAlert.jsx` (mới), `pages/warehouse/WarehouseOverviewPage.jsx` (mới), `routes/AppRoutes.jsx` | Khối cảnh báo + trang tổng quan kho/admin | 5 |

---

### Task 0: Chuẩn bị môi trường

- [ ] **Step 1:** `git checkout develop && git pull --ff-only origin develop && git checkout -b feature/admin-catalog-inventory-week2` (đã xác nhận `main` = `develop` = `91aabae`, không có gì cần merge).
- [ ] **Step 2:** Dựng DB theo `server/db/README.md` (baseline → 008 → 009 → 008_order_runtime → 010 → 011 → seeds 001, 002, 003) và chạy `docker compose up -d --build`. Chạy `node --test scripts/catalog-inventory-api.test.mjs`; Expected: 3 test PASS (đường cơ sở trước khi sửa). Nếu môi trường không dựng được, ghi rõ trong báo cáo cuối thay vì coi test là đã chạy.

### Task 1: Ẩn sản phẩm ngừng bán khỏi catalog công khai

**Files:**
- Modify: `server/models/product-model.php` (`getProducts`, `getProductById`), `server/controllers/product-controller.php` (`listProducts`, `showProduct`)
- Test: `scripts/catalog-inventory-api.test.mjs`

**Interfaces:**
- Consumes: `currentPrincipal(): ?array` (`server/middleware/auth-middleware.php`, có khóa `role`).
- Produces: `getProducts(array $filters, bool $includeInactive = false): array`, `getProductById(int $id, bool $includeInactive = false): ?array`. Người gọi chỉ truyền `true` khi principal có role `ADMIN`.

- [ ] **Step 1: Viết test lỗi** `test('Catalog công khai ẩn sản phẩm ngừng bán; ADMIN vẫn thấy và lọc được')`: ADMIN tạo sản phẩm (`POST /api/products`, SKU/mã duy nhất theo `unique`), `DELETE /api/products/{id}` (hoặc `PUT … is_active: 0`), rồi assert: anonymous `GET /api/products?keyword=<mã>` → `data` rỗng; anonymous `GET /api/products/{id}` → 404; customer cùng kết quả; ADMIN `GET /api/products?keyword=<mã>&is_active=0` → có sản phẩm; ADMIN `GET /api/products/{id}` → 200. Với sản phẩm đang bán: anonymous vẫn thấy.
- [ ] **Step 2:** Chạy `node --test scripts/catalog-inventory-api.test.mjs --test-name-pattern="ngừng bán"`. Expected: FAIL (anonymous vẫn thấy sản phẩm ẩn).
- [ ] **Step 3: Implement** thêm tham số `$includeInactive` ở hai hàm model: khi `false` thêm `AND p.is_active = 1` (và bỏ qua bộ lọc `is_active` từ query). Controller tính `$includeInactive = (currentPrincipal()['role'] ?? null) === 'ADMIN'`; `showProduct` trả 404 hiện có khi model trả `null`.
- [ ] **Step 4:** Chạy lại toàn bộ file test. Expected: PASS. `php -l` hai file PHP đã sửa.
- [ ] **Step 5:** Cập nhật mục "Quyền" trong `docs/api/CATALOG-ADMIN-INVENTORY.md` (GET products công khai chỉ trả sản phẩm đang bán). Commit: `fix(catalog): ẩn sản phẩm ngừng bán khỏi API công khai`.

### Task 2: Xóa mềm SKU và siết kiểm tra giá khi tạo sản phẩm

**Files:**
- Modify: `server/routes/catalog-admin-routes.php`, `server/controllers/catalog-admin-controller.php`, `server/services/catalog-admin-service.php`, `server/models/catalog-admin-model.php`, `server/controllers/product-controller.php` (`createProduct`, khoảng dòng 96)
- Test: `scripts/catalog-inventory-api.test.mjs`

**Interfaces:**
- Produces: `DELETE /api/variants/{id}` (ADMIN) → 200 `{ success: true, data: { id } }`; 404 nếu không có/đã xóa; 409 nếu `stock_quantity > 0` với message yêu cầu điều chỉnh tồn về 0 trước. Service: `CatalogAdminService::deleteVariant(int $id): array`; model: `CatalogAdminModel::softDeleteVariant(int $id): void`.

- [ ] **Step 1: Viết test lỗi** `test('Xóa mềm SKU chỉ khi tồn bằng 0; giá tạo sản phẩm không qua float')`: (a) tạo SKU mới (tồn 0) → `DELETE /api/variants/{id}` = 200, `GET /api/products/{pid}/variants` không còn SKU đó, xóa lần hai = 404, tạo lại cùng `sku` = 409; (b) nhập kho 2 cho SKU khác bằng WAREHOUSE rồi `DELETE` = 409 và SKU vẫn còn; sau khi xuất 2 thì xóa = 200 và `GET /api/inventory/movements?sku=…` vẫn trả lịch sử; (c) WAREHOUSE `DELETE` = 403, thiếu CSRF = 403; (d) `POST /api/products` với `price` là `1500.5` (số JSON), `"12345678901234"`, `"-1"`, `"abc"` → 422; `"1500.50"` → 201.
- [ ] **Step 2:** Chạy test mới. Expected: FAIL (route 404/405; giá số thực được chấp nhận).
- [ ] **Step 3: Implement** route `['DELETE', '#^/api/variants/(\d+)$#', 'deleteVariant']`; service khóa dòng SKU `FOR UPDATE` trong transaction, từ chối khi tồn > 0 (409), set `is_deleted = 1, is_active = 0`. Trong `createProduct` thay `is_numeric/(float)` bằng kiểm chuỗi `^\d{1,12}(\.\d{1,2})?$` (chỉ nhận string hoặc int, từ chối float JSON) — dùng lại cùng quy tắc với `CatalogAdminService::money` (đổi thành `public static` nếu cần, không sao chép regex).
- [ ] **Step 4:** Chạy toàn bộ file test. Expected: PASS. `php -l` các file đã sửa.
- [ ] **Step 5:** Thêm `DELETE /api/variants/{id}` vào bảng endpoint của `docs/api/CATALOG-ADMIN-INVENTORY.md` (ghi rõ SKU đã xóa vẫn chiếm mã `sku`). Commit: `feat(catalog): xóa mềm SKU và kiểm tra giá không dùng float`.

### Task 3: Siết kho — tồn không âm khi đồng thời, cảnh báo đúng SKU

**Files:**
- Modify: `server/controllers/inventory-controller.php` (nhánh `low_stock`)
- Test: `scripts/catalog-inventory-api.test.mjs`
- Sửa `server/controllers/inventory-movement-controller.php` **chỉ nếu** test dưới đây lộ lỗi.

**Interfaces:**
- Produces: `GET /api/inventory?low_stock=1` chỉ trả SKU có `is_active = 1` và `stock_quantity <= low_stock_threshold`.

- [ ] **Step 1: Viết test lỗi** (hai test):
  - `test('Hai lần xuất đồng thời không làm tồn âm')`: tạo SKU, nhập 5; `Promise.all` hai `POST` xuất 5 với `reference_code` khác nhau từ cùng WAREHOUSE client → thống kê status đúng `[201, 400]` (sắp xếp), tồn cuối = 0, lịch sử có đúng 2 dòng (nhập + một xuất) với `quantity_before/after` liên tiếp (5→0).
  - `test('Đầu vào điều chỉnh kho sai bị từ chối và cảnh báo bỏ SKU ngừng bán')`: `quantity` = `0`, `-1`, `1.5`, `"abc"`, `4294967296` → 400 và tồn không đổi; `note` 501 ký tự → 400; `movement_type: 'adjust'` → 400; SKU không tồn tại → 404; SKU ngừng bán (`PUT /api/variants/{id}` `is_active: false`) không xuất hiện trong `?low_stock=1` dù tồn 0.
- [ ] **Step 2:** Chạy riêng hai test. Expected: test đồng thời PASS hoặc FAIL tùy code hiện tại (nếu FAIL, sửa lỗi gốc trong movement controller); test thứ hai FAIL ở phần SKU ngừng bán.
- [ ] **Step 3: Implement** thêm `AND pv.is_active = 1` vào nhánh `low_stock` của `listInventory`; giữ nguyên danh sách thường (admin kho vẫn thấy SKU ngừng bán).
- [ ] **Step 4:** Chạy toàn bộ file test. Expected: PASS. `php -l`.
- [ ] **Step 5:** Cập nhật dòng `low_stock` trong tài liệu API. Commit: `fix(inventory): cảnh báo sắp hết bỏ SKU ngừng bán, thêm test đồng thời`.

### Task 4: FE — xóa SKU và lọc trạng thái sản phẩm

**Files:**
- Modify: `client/src/services/catalog-service.js`, `client/src/components/admin/ProductAdmin.jsx` (`VariantPanel`, bộ lọc ở `ProductAdmin`)

**Interfaces:**
- Consumes: `DELETE /api/variants/{id}` (Task 2), `GET /api/products?is_active=0|1` (ADMIN, Task 1).
- Produces: `deleteVariant(id: number): Promise<{ id: number }>` trong `catalog-service.js`.

- [ ] **Step 1:** Thêm `export const deleteVariant = id => requestApi(\`/api/variants/${id}\`, { method: 'DELETE' });`.
- [ ] **Step 2:** Trong `VariantPanel` thêm nút "Xóa" mỗi dòng (disabled khi `Number(item.stock_quantity) > 0` kèm `title` "Điều chỉnh tồn về 0 trước"), `window.confirm`, gọi `deleteVariant`, `reload()`, hiển thị lỗi 409 của server qua `error` hiện có.
- [ ] **Step 3:** Thêm `<select>` "Trạng thái" (Tất cả / Đang bán / Ẩn) vào bộ lọc của `ProductAdmin` qua `AdminField`, đưa vào `filters.is_active`; `listProducts` đã bỏ giá trị rỗng.
- [ ] **Step 4:** `cd client && npm run build && npm test`. Expected: build thành công, 4 file test hiện có PASS.
- [ ] **Step 5: Kiểm tra tay** (đăng nhập `admin@example.test`): tạo SKU → xóa được; SKU có tồn → nút bị khóa; lọc "Ẩn" chỉ ra sản phẩm ngừng bán. Ghi kết quả vào báo cáo (không có test tự động cho component). Commit: `feat(admin): xóa SKU và lọc trạng thái sản phẩm`.

### Task 5: FE — cảnh báo sắp hết ở trang tổng quan

**Files:**
- Create: `client/src/utils/inventory-alert.js`, `client/tests/inventory-alert.test.js`, `client/src/components/admin/LowStockAlert.jsx`, `client/src/pages/warehouse/WarehouseOverviewPage.jsx`
- Modify: `client/src/routes/AppRoutes.jsx` (route `/warehouse` và `/admin` dùng `WarehouseOverviewPage` thay vì `WorkspacePage`)

**Interfaces:**
- Consumes: `listInventory(true)` từ `catalog-service.js` (Task 3: đã bỏ SKU ngừng bán).
- Produces: `summarizeLowStock(items: Array<{ stock_quantity: number, low_stock_threshold: number, sku: string }>, limit = 5): { total: number, outOfStock: number, top: Array }` — `top` sắp theo `stock_quantity` tăng dần.

- [ ] **Step 1: Viết test lỗi** `client/tests/inventory-alert.test.js` (`node --test`, import `../src/utils/inventory-alert.js`): danh sách rỗng → `{ total: 0, outOfStock: 0, top: [] }`; 7 SKU (2 tồn 0, còn lại 1–5) → `total 7`, `outOfStock 2`, `top` dài 5 và `top[0].stock_quantity === 0`; không làm thay đổi mảng đầu vào.
- [ ] **Step 2:** `cd client && npm test`. Expected: FAIL (module chưa có).
- [ ] **Step 3: Implement** `summarizeLowStock` thuần (sao chép mảng trước khi sort).
- [ ] **Step 4: Implement** `LowStockAlert.jsx` (gọi `listInventory(true)`, trạng thái đang tải/lỗi có "Thử lại"/rỗng "Không có SKU nào dưới ngưỡng", danh sách `top` + liên kết `/warehouse/inventory`) và `WarehouseOverviewPage.jsx` (render `WorkspacePage` hiện có kèm `LowStockAlert` phía trên shortcut); nối route cho `/warehouse` (WAREHOUSE) và `/admin` (ADMIN) trong `AppRoutes.jsx`.
- [ ] **Step 5:** `npm test` (PASS, thêm test mới) và `npm run build`. Kiểm tra tay với WAREHOUSE và ADMIN: khối cảnh báo hiện số SKU sắp hết khớp `?low_stock=1`. Cập nhật mục Client trong `docs/api/CATALOG-ADMIN-INVENTORY.md`. Commit: `feat(warehouse): cảnh báo sắp hết trên trang tổng quan`.

### Task 6: Kiểm chứng cuối

- [ ] **Step 1:** `php -l` toàn bộ file PHP đã sửa; `node --test scripts/catalog-inventory-api.test.mjs`, `node --test scripts/auth-profile-api.test.mjs` (hồi quy auth), `cd client && npm test && npm run build`. Expected: tất cả PASS.
- [ ] **Step 2:** Mở PR vào `develop` (không push trực tiếp `develop`/`main`), mô tả nêu rõ phần đã chạy / chưa chạy.

## Ngoài phạm vi (cố ý bỏ)

- Loại điều chỉnh "đặt tồn tuyệt đối" (`adjustment`): UI hiện dùng tăng/giảm kèm lý do, đủ before/after; thêm loại mới cần thống nhất với nhóm.
- Chuyển SQL từ controller kho/catalog sang service/model (nợ kỹ thuật #2); thống nhất envelope lỗi (#1); URL ảnh tuyệt đối/tương đối (#3).
- Storefront vẫn dùng dữ liệu tĩnh `data.js`, chưa nối API `/api/products` (thuộc task storefront).
