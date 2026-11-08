# So sánh sản phẩm (giao diện khách hàng)

## Vị trí và luồng

- `client/src/pages/public/ComparePage.jsx`: trang `/compare`, nhận `?product=<id>&with=<id>&with2=<id>&with3=<id>` để chọn tối đa bốn sản phẩm; `slots=3|4` giữ cột trống khi đang chọn.
- `client/src/utils/product-comparison.js`: kiểm tra cùng danh mục, giá, hợp nhất thông số và ước tính TCO trên giao diện.
- `client/src/services/catalog-service.js`: dùng API catalog hiện có.
- Từ trang chủ hoặc menu, khách chọn sản phẩm thứ nhất, sau đó thêm tối đa ba sản phẩm khác trong cùng `category_id`. ID trùng hoặc khác danh mục từ URL bị bỏ qua. Nút tại trang chi tiết chuyển sản phẩm đang xem vào tham số `product`.

## Dữ liệu và hiển thị

| API công khai | Mục đích | Khi lỗi |
| --- | --- | --- |
| `GET /api/products?is_active=1` | Danh sách và danh mục của sản phẩm đang bán | Hiện lỗi và nút thử lại |
| `GET /api/products/{id}` | Hãng, ảnh, phiên bản, giá hiệu lực, số tháng bảo hành, slug danh mục và tóm tắt đánh giá | Hiện lỗi tải thông số |
| `GET /api/products/{id}/attributes` | Các tiêu chí động của danh mục | Hiện lỗi tải thông số |

Các API trả `{ "success": true, "data": ... }`; khi không tìm thấy sản phẩm, API trả 404. Trang so sánh đọc `data` qua `requestApi`, không dùng dữ liệu mẫu khi API lỗi. Giá là mức thấp nhất của phiên bản đang hoạt động; năm sản xuất chỉ hiện nếu API có trường hoặc thông số tương ứng. Ô thiếu dữ liệu hiển thị `—`. Các tiêu chí động của 2–4 sản phẩm được ghép theo `attribute_key`; giá trị thiếu không được suy diễn.

`GET /api/products/{id}` thêm `category_slug` và `review_summary: { review_count, rating_average }`. `review_count` chỉ tính `product_reviews` có `is_visible=1`, `is_deleted=0` và `order_items.is_deleted=0`; điểm trung bình làm tròn một chữ số. Chưa có đánh giá thì UI ghi rõ “Chưa có đánh giá”, không dùng điểm đánh giá từ dữ liệu mẫu.

TCO hiện là **ước tính trên giao diện**, chưa phải API `POST /api/tco/calculate` trong contract `DECISION-TOOLS.md`. Người dùng chọn 1/3/5 năm và nhập giá điện, giá nước, số lần/tuần, giờ/lần, vật tư/năm và bảo trì/năm cho mỗi sản phẩm. Tủ lạnh dùng `energy_kwh_year`; máy giặt/máy lạnh dùng `power_watts × giờ/lần × lần/tuần × 52 / 1000`. Nước máy giặt dùng `water_liters_cycle × lần/tuần × 52 / 1000`; tủ lạnh/máy lạnh không dùng nước vận hành. Tổng = giá mua + điện + nước + vật tư + bảo trì trong kỳ. Các khoản thiếu giữ `null`; tổng chỉ hiện khi đủ dữ liệu hoặc người dùng nhập 0 để xác nhận không phát sinh. Đây là số tham khảo, không dùng cho checkout hoặc ghi sự kiện TCO. Khi API TCO chính thức hoàn tất, thay phép tính trên giao diện bằng kết quả server.

Trang chủ và trang chi tiết sản phẩm hiện vẫn dùng danh sách mẫu trong `client/src/data.js`, khác với danh mục API. Khi `product` từ trang chi tiết trùng ID nhưng khác tên với API, trang so sánh yêu cầu chọn lại sản phẩm, ưu tiên danh mục tương ứng nếu có. Cần chuyển trang sản phẩm sang cùng API để chọn sẵn chính xác mọi sản phẩm từ trang chi tiết.

## Kiểm tra

`cd client && npm test && npm run build`. Test ở `client/tests/product-comparison.test.js` kiểm tra lọc cùng danh mục, chọn tối đa bốn ID không trùng, tránh ID mẫu trùng ID API, giá, năm sản xuất, thông số động thiếu dữ liệu và công thức TCO.
