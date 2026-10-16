# Quản trị catalog và kho cơ bản — Task 12 (PRD-01..06, ADM-PRO-02/03, WH-01..04)

Ngày 16/10/2026, Tuấn Vũ. Bổ sung lên API catalog của Lan Chi (PR #9). Mọi thao tác ghi cần phiên (cookie `HOMECARE_SESSION`) và header `X-CSRF-Token` (xem `AUTH-PROFILE.md`).

## Source

- Mới: `server/routes/catalog-admin-routes.php` → `controllers/catalog-admin-controller.php` → `services/catalog-admin-service.php` → `models/catalog-admin-model.php`.
- Sửa của Lan Chi: `routes/inventory-routes.php`, `routes/inventory-movement-routes.php`, `controllers/inventory-movement-controller.php` (người thực hiện, lý do bắt buộc, quyền WAREHOUSE), `controllers/product-controller.php` (tồn ban đầu = 0), `models/product-model.php` (`primary_image`, sửa placeholder trùng).
- Client: `services/catalog-service.js`; `pages/admin/CatalogAdminPage.jsx` (tab Sản phẩm & SKU / Danh mục / Thương hiệu / Banner), `components/admin/{ProductAdmin,SimpleCrud}.jsx`; `pages/warehouse/{InventoryPage,InventoryHistoryPage}.jsx`.

## Quyền

| Endpoint | ADMIN | WAREHOUSE | Khác |
| --- | --- | --- | --- |
| Ghi categories/brands/products/banners/upload (API Lan Chi) | Có | 403 | 401/403 |
| Endpoint bổ sung bên dưới (SKU, ảnh, thuộc tính, banner admin) | Có | 403 | 401/403 |
| GET `/api/inventory`, GET/POST `/api/inventory/movements` | Có | Có | 401/403 (trước đây công khai GET và chỉ ADMIN được POST) |

## Endpoint bổ sung

| Method/path | Body | Kết quả |
| --- | --- | --- |
| GET `/api/products/{id}/variants` | — | Mọi SKU chưa xóa của sản phẩm, kể cả ngừng bán |
| POST `/api/products/{id}/variants` | `{ sku, variant_name, price, sale_price?, sale_starts_at?, sale_ends_at?, low_stock_threshold?, is_active? }` | 201, SKU mới với `stock_quantity = 0` |
| PUT `/api/variants/{id}` | Một phần các trường trên (trừ `sku`) | SKU sau cập nhật |
| PUT `/api/products/{id}/image` | `{ image_url }` | Đặt ảnh đại diện; ảnh cũ bỏ cờ primary |
| POST `/api/categories/{id}/attributes` | `{ name, attribute_key, data_type: number|text|boolean, unit?, is_required? }` | 201, định nghĩa thông số mới |
| GET `/api/admin/banners` | — | Mọi banner chưa xóa (API công khai chỉ trả banner đang hiển thị) |

Quy tắc:

- Tiền nhận chuỗi/số nguyên dạng `^\d{1,12}(\.\d{1,2})?$` và lưu DECIMAL, không qua float; số thực JSON (`1500.5`) bị từ chối — gửi chuỗi `"1500.50"`. Giá khuyến mãi phải nhỏ hơn giá bán; `sale_ends_at` sau `sale_starts_at`; thời gian nhận `YYYY-MM-DD HH:MM[:SS]` hoặc `YYYY-MM-DDTHH:MM`. Đơn hàng vẫn lưu giá thực tế lúc mua (snapshot của module đơn).
- `sku` duy nhất (409), không đổi sau khi tạo (422). Gửi `stock_quantity` → 422: tồn chỉ đổi qua điều chỉnh kho. `POST /api/products` của Lan Chi cũng bỏ qua `stock_quantity`.
- `image_url` phải là URL http(s) có đường dẫn `/uploads/products/<32 hex>.(jpg|png|webp)` — tức ảnh đã qua `POST /api/uploads/images` (kiểm MIME thực, ≤ 5 MB, ≤ 6000×6000, tên ngẫu nhiên). `.htaccess` chặn thực thi script trong `uploads/`.
- `attribute_key` dạng `^[a-z][a-z0-9_]*$`, duy nhất trong danh mục (409). Giá trị thông số để trống được giữ là "chưa có dữ liệu", không ghi 0.

## Điều chỉnh kho (WH-03/04)

POST `/api/inventory/movements` `{ sku, movement_type: import|export, quantity > 0, reference_code, note }`:

- `note` (lý do) bắt buộc, ≤ 500 ký tự; `performed_by` = người đăng nhập (không nhận từ client).
- Transaction + `SELECT … FOR UPDATE` trên SKU; xuất vượt tồn → 400; `reference_code` trùng → 409, nên gửi lặp cùng mã không cộng tồn hai lần. Màn hình kho tự sinh mã `ADJ-<thời gian>-<ngẫu nhiên>` cho mỗi lần mở form.
- GET `/api/inventory/movements?sku=&movement_type=` trả 200 bản ghi mới nhất kèm `performed_by_name` (shortcut: chưa phân trang).
- GET `/api/inventory?low_stock=1` trả SKU có `stock_quantity <= low_stock_threshold` (WH-02).

## Dữ liệu demo

`server/db/seeds/003_catalog_appliances.sql`: 4 thương hiệu hư cấu, 3 danh mục, 30 sản phẩm mô phỏng (10/nhóm), 39 SKU, thông số động (kích thước mm, dung tích/khối lượng, BTU, điện năng/công suất, nước/chu trình, inverter). Tồn ban đầu được tạo bằng movement `SEED-<sku>` do `admin@example.test` thực hiện. Khóa thông số là đề xuất để thống nhất với TV4 (FitCheck/TCO).

## Kiểm thử

`node --test scripts/catalog-inventory-api.test.mjs` (PHP + MySQL thử nghiệm đã seed 001 + 003): quyền kho 401/403, lọc sắp hết, lý do bắt buộc, CSRF, chứng từ trùng 409, chặn tồn âm, `performed_by_name`; SKU tồn 0, chặn `stock_quantity`, giá khuyến mãi ≥ giá, số thực, SKU trùng/đổi mã, khung thời gian sai, SKU ngừng bán ẩn khỏi storefront; thuộc tính sai khóa/trùng; ảnh URL ngoài bị chặn, upload PNG thật pass, file PHP giả PNG bị chặn. Test để lại ảnh 1×1 trong `server/uploads/products/` (đã gitignore).
