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
| GET `/api/products`, `/api/products/{id}` | Thấy cả sản phẩm ẩn (lọc `is_active=0|1`) | Chỉ sản phẩm đang bán | Công khai; sản phẩm ngừng bán trả 404 và không có trong danh sách |

## Endpoint bổ sung

| Method/path | Body | Kết quả |
| --- | --- | --- |
| GET `/api/products/{id}/variants` | — | Mọi SKU chưa xóa của sản phẩm, kể cả ngừng bán |
| POST `/api/products/{id}/variants` | `{ sku, variant_name, price, sale_price?, sale_starts_at?, sale_ends_at?, low_stock_threshold?, is_active? }` | 201, SKU mới với `stock_quantity = 0` |
| PUT `/api/variants/{id}` | Một phần các trường trên (trừ `sku`) | SKU sau cập nhật |
| DELETE `/api/variants/{id}` | — | `{ id }`; xóa mềm. 404 nếu không có/đã xóa; **409 nếu còn tồn > 0** (điều chỉnh về 0 trước) hoặc đây là SKU cuối cùng của sản phẩm (hãy ngừng bán sản phẩm). Mã `sku` đã xóa vẫn chiếm chỗ (tạo lại → 409); lịch sử kho của SKU đã xóa không hiện trong danh sách movement nhưng vẫn còn trong DB |
| GET `/api/products/{id}/images` | — | Ảnh chưa xóa, ảnh đại diện trước rồi theo `sort_order` |
| POST `/api/products/{id}/images` | `{ image_url, sort_order?, is_primary? }` | 201, danh sách ảnh; ảnh đầu tiên tự thành ảnh đại diện; tối đa 10 ảnh |
| PUT `/api/product-images/{id}` | `{ sort_order?, is_primary: true? }` | Danh sách ảnh; `is_primary: false` → 422 (chọn ảnh khác thay vì bỏ cờ) |
| DELETE `/api/product-images/{id}` | — | Xóa mềm; nếu là ảnh đại diện thì ảnh đứng đầu còn lại thay thế |
| POST `/api/categories/{id}/attributes` | `{ name, attribute_key, data_type: number|text|boolean, unit?, is_required? }` | 201, định nghĩa thông số mới |
| GET `/api/admin/banners` | — | Mọi banner chưa xóa (API công khai chỉ trả banner đang hiển thị) |

Quy tắc:

- `POST /api/products` dùng cùng quy tắc tiền: `price` số thực JSON/âm/quá 12 chữ số → 422.
- Tiền nhận chuỗi/số nguyên dạng `^\d{1,12}(\.\d{1,2})?$` và lưu DECIMAL, không qua float; số thực JSON (`1500.5`) bị từ chối — gửi chuỗi `"1500.50"`. Giá khuyến mãi phải nhỏ hơn giá bán; `sale_ends_at` sau `sale_starts_at`; thời gian nhận `YYYY-MM-DD HH:MM[:SS]` hoặc `YYYY-MM-DDTHH:MM`. Đơn hàng vẫn lưu giá thực tế lúc mua (snapshot của module đơn).
- `sku` duy nhất (409), không đổi sau khi tạo (422). Gửi `stock_quantity` → 422: tồn chỉ đổi qua điều chỉnh kho. `POST /api/products` của Lan Chi cũng bỏ qua `stock_quantity`.
- Thao tác ảnh khóa dòng sản phẩm (`FOR UPDATE`) nên luôn đúng một ảnh đại diện. `GET /api/products/{id}` (công khai) trả thêm `images`, `GET /api/products` trả `primary_image`.
- `image_url` phải là URL http(s) có đường dẫn `/uploads/products/<32 hex>.(jpg|png|webp)` — tức ảnh đã qua `POST /api/uploads/images` (kiểm MIME thực, ≤ 5 MB, ≤ 6000×6000, tên ngẫu nhiên). `.htaccess` chặn thực thi script trong `uploads/`.
- `attribute_key` dạng `^[a-z][a-z0-9_]*$`, duy nhất trong danh mục (409). Giá trị thông số để trống được giữ là "chưa có dữ liệu", không ghi 0.

## Trường bổ sung cho API của Lan Chi (migration 011)

- Danh mục (PRD-01): `sort_order` (0–100000, mặc định 0), danh sách sắp theo `sort_order, id`. **Tối đa hai cấp**: danh mục cha phải là danh mục gốc; danh mục đang có con không thể thành cấp 2 (422).
- Thương hiệu (PRD-02): `description` (≤ 1000 ký tự).
- Banner (ADM-PRO-02): `sort_order`; API công khai và `/api/admin/banners` sắp theo `sort_order` rồi mới nhất.

## Điều chỉnh kho (WH-03/04)

POST `/api/inventory/movements` `{ sku, movement_type: import|export, quantity > 0, reference_code, note }`:

- `note` (lý do) bắt buộc, ≤ 500 ký tự; `performed_by` = người đăng nhập (không nhận từ client).
- Transaction + `SELECT … FOR UPDATE` trên SKU; xuất vượt tồn → 400; `reference_code` trùng → 409, nên gửi lặp cùng mã không cộng tồn hai lần. Màn hình kho lập phiếu nhập/xuất/kiểm kê nhiều dòng, tự sinh mã phiếu `PN-` / `PX-` / `DC-<thời gian>-<ngẫu nhiên>` (chỉ đọc, mở form mới thì sinh mã mới); mỗi dòng là một POST với `reference_code` = `<mã phiếu>-<số dòng>` (≤ 100 ký tự), giữ cố định qua các lần gửi lại. Lý do gửi vào `note` dạng `<lý do>: <ghi chú>` (≤ 500 ký tự). Kiểm kê không có loại `adjust` ở API: chênh lệch dương gửi `import`, âm gửi `export`, dòng không lệch không gửi.
- **Phiếu nhiều dòng không atomic**: mỗi SKU ghi trong transaction riêng nên nếu dòng sau lỗi thì dòng trước đã ghi. Client gửi tuần tự và dừng ở dòng lỗi đầu tiên; dòng đã ghi bị khóa (hiện tồn trước → sau do server trả về), gửi lại chỉ gửi các dòng còn lại cùng mã. Nhận 409 khi gửi lại nghĩa là lần trước có thể đã ghi: client báo kiểm tra Nhật ký kho, không coi là thành công. SKU ngừng bán vẫn có trong `GET /api/inventory` nhưng POST trả 404, lỗi hiện trên đúng dòng. Muốn phiếu atomic cần thêm endpoint batch ở PHP (chưa làm).
- GET `/api/inventory/movements?sku=&movement_type=&page=1&pageSize=20` trả `data: { items, pagination: { page, pageSize, totalItems, totalPages } }`, mới nhất trước, kèm `performed_by_name`. `pageSize` 1–100; sai → 400.
- GET `/api/inventory?low_stock=1` trả SKU **đang bán** (`is_active = 1`) có `stock_quantity <= low_stock_threshold` (WH-02). Không có `low_stock`, danh sách vẫn gồm SKU ngừng bán.
- Màn hình: trang tổng quan `/warehouse` (WAREHOUSE) và `/admin` (ADMIN) có khối cảnh báo sắp hết (tối đa 5 SKU ít tồn nhất) liên kết sang `/warehouse/inventory`; trang quản trị sản phẩm có lọc trạng thái và nút Xóa SKU (khóa khi còn tồn).

## Dữ liệu demo

`server/db/seeds/003_catalog_appliances.sql`: 4 thương hiệu hư cấu, 3 danh mục, 30 sản phẩm mô phỏng (10/nhóm), 39 SKU, thông số động (kích thước mm, dung tích/khối lượng, BTU, điện năng/công suất, nước/chu trình, inverter). Tồn ban đầu được tạo bằng movement `SEED-<sku>` do `admin@example.test` thực hiện. Khóa thông số là đề xuất để thống nhất với TV4 (FitCheck/TCO).

## Kiểm thử

`node --test scripts/catalog-inventory-api.test.mjs` (PHP + MySQL thử nghiệm đã seed 001 + 003): quyền kho 401/403, lọc sắp hết, lý do bắt buộc, CSRF, chứng từ trùng 409, chặn tồn âm, `performed_by_name`; SKU tồn 0, chặn `stock_quantity`, giá khuyến mãi ≥ giá, số thực, SKU trùng/đổi mã, khung thời gian sai, SKU ngừng bán ẩn khỏi storefront; thuộc tính sai khóa/trùng; ảnh URL ngoài bị chặn, upload PNG thật pass, file PHP giả PNG bị chặn, WAREHOUSE không upload ảnh catalog; thư viện ảnh (đại diện tự động, đổi đại diện, thứ tự, xóa mềm và thay thế); phân trang lịch sử; sản phẩm ngừng bán ẩn khỏi API công khai; xóa mềm SKU (chặn khi còn tồn hoặc là SKU cuối, 403 WAREHOUSE/CSRF); giá tạo sản phẩm không float; hai lần xuất đồng thời không âm tồn; đầu vào điều chỉnh sai; cảnh báo bỏ SKU ngừng bán; danh mục 2 cấp/thứ tự, mô tả thương hiệu, thứ tự banner. Test để lại ảnh 1×1 trong `server/uploads/products/` (đã gitignore).

## Tìm kiếm sản phẩm và danh sách yêu thích (STT 10–11)

`GET /api/products/search` — Public. Query: `keyword` (tên/mã sản phẩm, tối đa 100 ký tự, `%`/`_` tìm như ký tự thường), `category_id`, `brand_id` (một ID hoặc danh sách `1,2`), `min_price`, `max_price` (VND nguyên, so với giá bán hiện hành thấp nhất), `warranty_months` (danh sách), `sort` (`newest`, `price_asc`, `price_desc`, `best_selling`, `rating_desc`), `page`, `page_size` (1–100). Chỉ trả sản phẩm active có danh mục, thương hiệu active và ít nhất một SKU đang bán. Response: `{ items: [...], pagination: { page, page_size, total_items, total_pages } }`; mỗi item có `variant_count`, `min_price`, `total_stock`, `sold_quantity`, `review_count`, `rating_average`, `primary_image`.

Wishlist (Order API, chỉ CUSTOMER, cần CSRF + `Idempotency-Key` cho thao tác ghi; migration `019_wishlists.sql`):

| Method/path | Body | Ghi chú |
| --- | --- | --- |
| `GET /wishlist` | — | Mỗi sản phẩm một dòng: `wishlist_id`, `product_id`, `name`, `product_code`, `image_url`, `min_price`, `total_stock`, `variant_count`. |
| `POST /wishlist` | `{ productId }` | Sản phẩm không tồn tại/ngừng bán → 404 `PRODUCT_NOT_FOUND`; thêm lại không tạo dòng trùng. |
| `DELETE /wishlist/{productId}` | `{}` | Xóa mềm; xóa lặp không lỗi. |
| `POST /wishlist/{productId}/move-to-cart` | `{ skuId, quantity }` | SKU phải thuộc sản phẩm đã lưu (422 `SKU_PRODUCT_MISMATCH`); thêm vào giỏ qua `POST /cart/items` nên kiểm tồn/version như giỏ hàng (409 `OUT_OF_STOCK`). |
