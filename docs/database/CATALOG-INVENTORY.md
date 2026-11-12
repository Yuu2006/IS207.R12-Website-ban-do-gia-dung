# Catalog và kho — dữ liệu và quy tắc

Cập nhật 12/11/2026. Bảng xem [ERD.md](ERD.md) mục 2; API xem [docs/api/CATALOG-ADMIN-INVENTORY.md](../api/CATALOG-ADMIN-INVENTORY.md).

## Mô hình

| Bảng | Vai trò | Ràng buộc chính |
| --- | --- | --- |
| `categories` | Danh mục (cây qua `parent_id`), `slug` duy nhất, `sort_order` | MVP dùng 3 danh mục: `tu-lanh`, `may-giat`, `may-lanh` |
| `brands` | Thương hiệu, `logo_url`, `description` | — |
| `products` | Sản phẩm chung: `product_code`, `slug` duy nhất, `warranty_months`, mô tả | Thuộc đúng một danh mục và một thương hiệu |
| `product_variants` | **SKU — đơn vị bán và tồn kho**: `sku` duy nhất, `price`, `sale_price` + khung thời gian, `stock_quantity`, `low_stock_threshold` | Giỏ, đơn, kho, voucher đều tham chiếu SKU, không tham chiếu sản phẩm |
| `product_attributes` | Định nghĩa thông số theo danh mục: `attribute_key`, `data_type` (text/number/boolean), `unit` | `(category_id, attribute_key)` duy nhất |
| `product_attribute_values` | Giá trị thông số của sản phẩm (một trong `value_text`, `value_number`, `value_boolean`) | `(product_id, attribute_id)` duy nhất |
| `product_images` | Ảnh sản phẩm, `is_primary`, `sort_order` | Ảnh tải lên lưu đường dẫn tương đối `/uploads/products/<md5>.(jpg|png|webp)` |
| `inventory_movements` | Nhật ký mọi thay đổi tồn | `reference_code` duy nhất |
| `banners` | Banner trang chủ có khung thời gian hiển thị | — |

## Thông số dùng chung

Các khóa được FitCheck, TCO, chatbot và trang so sánh đọc (định nghĩa trong `server/config/spec-fields.php`, đơn vị chuẩn):

| Danh mục | Khóa |
| --- | --- |
| Tủ lạnh | `capacity_liters` (L), `energy_kwh_year` (kWh/năm), `width_mm`/`depth_mm`/`height_mm`, `inverter` |
| Máy giặt | `capacity_kg` (kg), `power_watts` (W), `water_liters_cycle` (L), kích thước mm, `inverter` |
| Máy lạnh | `cooling_btu` (BTU), `room_area_max_m2` (m²), `power_watts` (W), `indoor_width_mm`, `inverter` |

Thiếu giá trị là thiếu dữ liệu, không phải 0. Cột cũ `products.power_watts`/`capacity_liters` trong baseline không phải nguồn cho các module mới; dùng `product_attribute_values`.

## Giá

Giá bán hiện hành của một SKU = `sale_price` nếu có, nhỏ hơn `price` và đang trong `[sale_starts_at, sale_ends_at]` (UTC, mốc trống = không giới hạn); ngược lại là `price`. Giá hiển thị của sản phẩm là giá hiện hành thấp nhất trong các SKU đang bán. Khi đặt hàng, backend tính lại giá và lưu snapshot vào `order_items`; sửa catalog sau đó không đổi đơn cũ.

## Tồn kho

Mọi thay đổi `product_variants.stock_quantity` đi kèm một dòng `inventory_movements` ghi tồn trước/sau, người thực hiện, lý do và mã tham chiếu, trong cùng transaction có khóa `SELECT … FOR UPDATE` trên SKU. Tồn không bao giờ âm.

| `movement_type` | Nguồn | Ghi chú |
| --- | --- | --- |
| `import` | WAREHOUSE/ADMIN nhập kho | Số lượng dương, bắt buộc mã tham chiếu và lý do |
| `export` | WAREHOUSE/ADMIN xuất kho | Không xuất vượt tồn |
| `RESERVE` | Tạo đơn (checkout) | Giữ tồn ngay khi tạo đơn; `orders.inventory_state = RESERVED` |
| `RELEASE` | Hủy đơn / hết hạn thanh toán VNPay | Hoàn tồn đúng một lần (`inventory_state` chuyển `RELEASED`) |

Đơn chuyển sang xử lý thì `inventory_state = CONSUMED`, không trừ thêm. Trả hàng **không** tự nhập lại kho. Cảnh báo sắp hết: SKU đang bán có `stock_quantity <= low_stock_threshold` (mặc định 5), hiển thị ở trang Tồn kho và dashboard.

## Trạng thái hiển thị và xóa mềm

Tìm kiếm (`/api/products/search`), chatbot và wishlist chỉ hiện sản phẩm khi sản phẩm, danh mục, thương hiệu đều `is_active = 1, is_deleted = 0` và có ít nhất một SKU đang bán. Xóa sản phẩm/SKU trong trang quản trị là xóa mềm (`is_deleted = 1`) để giữ lịch sử đơn, kho và đánh giá; sản phẩm đã có đơn thì vô hiệu hóa thay vì xóa cứng. Còn tồn tại: `GET /api/products` (trang chủ, danh sách cũ) mới lọc `is_active` của sản phẩm, chưa lọc danh mục/thương hiệu ngừng hoạt động.

## Dữ liệu demo

Seed `003`–`005` tạo 60 sản phẩm (20 mỗi danh mục: mã `TL-`, `MG-`, `ML-001..020`), 73 SKU, thuộc tính và ảnh; `004` gắn thương hiệu thật cho 30 sản phẩm; seed `011` (tùy chọn) thay ảnh placeholder bằng URL ảnh model gần nhất. Sản phẩm là **mô phỏng**, giá và thông số không phải cam kết của nhà sản xuất.
