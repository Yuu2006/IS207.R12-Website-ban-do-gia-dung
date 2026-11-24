# So sánh sản phẩm (giao diện khách hàng)

Bổ sung tuần 4: phần TCO đã chuyển sang component `components/decision/TcoComparison.jsx` dùng chung với công cụ chi phí sở hữu và API `/api/tco/calculate`. Người dùng chọn SKU, 2–4 sản phẩm và giả định; không còn chạy `estimateTco()` ở màn hình production. Chi phí thiếu giữ null và hiện giải thích/công thức từ API. Xem [hướng dẫn tuần 4](../guide/WEEK-4-HANDOFF.md).

## Vị trí và luồng

- `client/src/pages/public/ComparePage.jsx`: trang `/compare`, nhận `?product=<id>&with=<id>&with2=<id>&with3=<id>` để chọn tối đa bốn sản phẩm; `slots=3|4` giữ cột trống khi đang chọn.
- `client/src/utils/product-comparison.js`: kiểm tra cùng danh mục, giá và hợp nhất thông số. Helper TCO cũ chỉ giữ cho test hồi quy cũ, không được dùng trong giao diện production.
- `client/src/components/decision/TcoComparison.jsx`: form SKU/giả định và kết quả TCO từ API, dùng chung với `DecisionToolsPage.jsx`.
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

TCO gọi `POST /api/tco/calculate`: người dùng chọn SKU cho 2–4 sản phẩm cùng danh mục, 1/3/5 năm và nhập giá điện/nước, tần suất, giờ/lần, vật tư và bảo trì từng sản phẩm. Giá/thông số đến từ catalog server, có chuẩn hóa W/kW và L/m³, kiểm tra cả đơn vị lẫn kỳ; tiền làm tròn ở bước cuối. Khoản thiếu giữ null, tổng hiện “Chưa đủ dữ liệu”; nhập 0 khi chủ động giả định không phát sinh. Kết quả kèm công thức/giả định/missingInputs. API ghi một sự kiện TCO theo requestKey; đổi lựa chọn hủy phản hồi cũ. Không dùng kết quả TCO làm giá checkout.

Trang chủ và trang chi tiết catalog trên nhánh tích hợp đã dùng API. Guard cho link cũ/mock vẫn được giữ: ID trùng nhưng khác tên không tự chọn nhầm sản phẩm thật, thay vào đó yêu cầu chọn lại.

## Kiểm tra

`cd client && npm test && npm run build`. Test ở `client/tests/product-comparison.test.js` kiểm tra lọc cùng danh mục, chọn tối đa bốn ID không trùng, tránh ID mẫu trùng ID API, giá, năm sản xuất, thông số động thiếu dữ liệu và công thức TCO.
