# So sánh sản phẩm (giao diện khách hàng)

## Vị trí và luồng

- `client/src/pages/public/ComparePage.jsx`: trang `/compare`, có thể mở với `?product=<id>&with=<id>`.
- `client/src/utils/product-comparison.js`: kiểm tra cùng danh mục, giá và hợp nhất thông số.
- `client/src/services/catalog-service.js`: dùng API catalog hiện có.
- Từ trang chủ hoặc menu, khách chọn sản phẩm thứ nhất, sau đó chọn sản phẩm thứ hai trong cùng `category_id`. Nút tại trang chi tiết chuyển sản phẩm đang xem vào tham số `product`.

## Dữ liệu và hiển thị

| API công khai | Mục đích | Khi lỗi |
| --- | --- | --- |
| `GET /api/products?is_active=1` | Danh sách và danh mục của sản phẩm đang bán | Hiện lỗi và nút thử lại |
| `GET /api/products/{id}` | Hãng, ảnh, phiên bản và giá hiệu lực | Hiện lỗi tải thông số |
| `GET /api/products/{id}/attributes` | Các tiêu chí động của danh mục | Hiện lỗi tải thông số |

Các API trả `{ "success": true, "data": ... }`; khi không tìm thấy sản phẩm, API trả 404. Trang so sánh đọc `data` qua `requestApi`, không dùng dữ liệu mẫu khi API lỗi. Giá là mức thấp nhất của phiên bản đang hoạt động; năm sản xuất chỉ hiện nếu API có trường hoặc thông số tương ứng. Ô thiếu dữ liệu hiển thị `—`. Các tiêu chí động của hai sản phẩm được ghép theo `attribute_key`; giá trị thiếu không được suy diễn.

Trang chủ và trang chi tiết sản phẩm hiện vẫn dùng danh sách mẫu trong `client/src/data.js`, khác với danh mục API. Khi `product` từ trang chi tiết trùng ID nhưng khác tên với API, trang so sánh yêu cầu chọn lại sản phẩm, ưu tiên danh mục tương ứng nếu có. Cần chuyển trang sản phẩm sang cùng API để chọn sẵn chính xác mọi sản phẩm từ trang chi tiết.

## Kiểm tra

`cd client && npm test && npm run build`. Test ở `client/tests/product-comparison.test.js` kiểm tra lọc cùng danh mục, tránh ID mẫu trùng ID API, giá, năm sản xuất và thông số động thiếu dữ liệu.
