# BOT-01..06 — thiết kế chatbot theo quy tắc và API contract

Trạng thái 20/10/2026: **bản mẫu FE và contract BE**, chưa có endpoint chatbot, rule engine hay model API. Giao diện ở `client/src/components/chatbot/` dùng dữ liệu minh họa cô lập trong `demo-products.js`, không đọc catalog và không đưa ra báo giá thật. Lịch sử bản mẫu lưu trong `sessionStorage` của tab hiện tại (tối đa 40 tin nhắn), không gửi lên server; đóng/mở hộp chat không xóa hội thoại. Chatbot MVP dùng ý định, bộ lọc, quy tắc và FAQ; **không dùng LLM**. PR so sánh sản phẩm và contract FitCheck/TCO đang ở nhánh khác, chưa được coi là đã tích hợp vào `develop`.

## 1. Luồng và tiêu chí trả lời

1. Giao diện hiển thị trước ba câu hỏi mẫu: **Hỏi giá**, **So sánh sản phẩm**, **Chỉ so sánh giá**. Đây là lối vào nhanh, không phải danh sách các câu hỏi mà bot đã trả lời được trong bản mẫu. Tin nhắn tự nhập hiện chỉ được nhận trên giao diện và trả thông báo chưa xử lý.
2. Khi triển khai BE, phân loại ý định `PRICE`, `COMPARE`, `RECOMMEND`, `FAQ`, `UNKNOWN` bằng quy tắc/keyword có kiểm soát. Tách tên/ID sản phẩm, danh mục, ngân sách và tiêu chí được nhắc tới thành slot có cấu trúc. Không đoán sản phẩm từ câu mơ hồ; thiếu ID hoặc danh mục thì hỏi làm rõ trước khi truy vấn.
3. Mỗi câu trả lời bắt đầu bằng **kết luận trực tiếp**, tối đa 2–3 câu ngắn trước khi hiển thị bảng/thẻ chi tiết. Chỉ nêu dữ kiện có nguồn, đơn vị và thời điểm phù hợp. Không tự tạo giá, tồn kho, công suất, độ bền, chính sách hay “sản phẩm tốt nhất”. Nếu có dữ liệu thiếu, nói rõ “Chưa có dữ liệu”.
4. Sau **mỗi** câu trả lời hiển thị **một câu hỏi mở** liên quan đến bước tiếp theo, ví dụ: “Bạn muốn so sánh thêm tiêu chí nào?” hoặc “Bạn muốn hỏi giá của sản phẩm nào?”. Không lặp máy móc một câu hỏi khi người dùng vừa trả lời nó.
5. Với `COMPARE`, chỉ hiển thị trường người dùng yêu cầu. Nếu họ không nêu trường, mặc định **giá, thông số hiệu năng phù hợp danh mục, nhu cầu sử dụng**. Chọn 2–4 sản phẩm **cùng `category_id`**; không chọn trùng sản phẩm. “Hiệu năng” phải ánh xạ sang thông số có ý nghĩa theo loại hàng, không dùng một chỉ số chung cho mọi danh mục. Nhu cầu sử dụng chỉ được suy ra từ quy tắc đã được nhóm phê duyệt, có nhãn **ước tính** và giải thích; nếu chưa có quy tắc, trả “Chưa đủ dữ liệu để đánh giá nhu cầu”.
6. Với `RECOMMEND`, chỉ xét sản phẩm đang hoạt động, 3–5 gợi ý, chấm điểm theo tiêu chí đã đáp ứng và nêu một điểm phù hợp cùng một đánh đổi. Thiếu giá/thông số không được coi là đáp ứng. Với FAQ chính sách, chỉ dùng nội dung đã được ADMIN duyệt; không suy diễn cam kết giao hàng, đổi trả hay bảo hành.
7. Nút hành động BOT-06 chỉ mở đường dẫn đã có thật. “Thêm giỏ” yêu cầu chọn SKU và kiểm tra tồn trên backend; bản mẫu chưa tạo thao tác mua hàng.

## 2. Dữ liệu catalog được phép sử dụng

| Mục trả lời | Nguồn dữ liệu thực | Điều kiện |
| --- | --- | --- |
| Danh mục, tên, thương hiệu | `products.category_id/name/brand_id`, `categories`, `brands` | Product/category/brand phải active và chưa soft delete |
| Giá | `product_variants.price/sale_price/sale_starts_at/sale_ends_at`, SKU | Chỉ SKU active; tính giá khuyến mãi hiệu lực tại thời điểm trả lời; nếu nhiều SKU, nêu SKU hoặc hỏi chọn SKU, không coi giá thấp nhất là giá của mọi SKU |
| Tồn kho | `product_variants.stock_quantity` | Chỉ nếu BE kiểm tra hiện trạng; không hứa còn hàng tại checkout |
| Hiệu năng | `products.power_watts/capacity_liters`; `product_attributes.attribute_key/unit` + `product_attribute_values` | Theo danh mục: tủ lạnh `capacity_liters/energy_kwh_year`; máy giặt `capacity_kg/power_watts/water_liters_cycle`; máy lạnh `cooling_btu/room_area_max_m2/power_watts`. Chỉ dùng key có giá trị; số 0 khác thiếu dữ liệu |
| Kích thước, bảo hành | Các thuộc tính `*_mm`, `products.warranty_months` | mm là đơn vị kích thước chuẩn; bảo hành không thay thế điều kiện chính sách |
| Đánh giá | `product_reviews` đang hiển thị | Chỉ khi module đánh giá có API tính tổng/điểm trung bình được xác minh |
| Chi phí sở hữu, FitCheck | API/contract riêng | Chỉ hiển thị khi các API này triển khai; dữ liệu thiếu không được giả thành 0 hoặc “phù hợp” |

Danh sách catalog hiện có: `GET /api/products?is_active=1`, chi tiết `GET /api/products/{id}`, SKU `GET /api/products/{id}/variants`, thuộc tính `GET /api/products/{id}/attributes`. BE chatbot phải tái kiểm tra điều kiện active và quyền truy cập, không tin giá/thông số/điểm chấm từ client. Khi nối UI, dùng cùng lớp service frontend, không hardcode host.
Nếu thông số cùng tên có cả ở cột `products` và thuộc tính động nhưng giá trị khác nhau, service phải báo dữ liệu catalog cần kiểm tra; không tự chọn một giá trị rồi giải thích như dữ kiện chắc chắn. Chỉ so sánh giá trị, không tự kết luận “mạnh hơn” hay “tiết kiệm hơn” khi chưa có quy tắc xếp hạng cho danh mục.

## 3. FAQ và quy tắc — schema đề xuất, chưa migration

`chatbot_faqs`: `id`, `intent_key`, `question`, `answer`, `keywords` (JSON), `category_id` nullable, `status` (`DRAFT`, `ACTIVE`, `INACTIVE`), `updated_by`, `created_at`, `updated_at`. Chỉ FAQ `ACTIVE` được trả lời; một câu trả lời cần nguồn chính sách và ngày cập nhật. ADMIN có quyền tạo/sửa/vô hiệu; không cho nhập HTML/script để render. Các nhóm FAQ dự kiến: đặt hàng, giao hàng, thanh toán, đổi trả, voucher, FitCheck, bảo hành. Nội dung chính sách cụ thể phải do nhóm quản trị xác nhận, **không** lấy từ câu trả lời demo.

`chatbot_intent_rules`: `id`, `intent_key`, `pattern_type` (`KEYWORD`, `PHRASE`), `pattern`, `priority`, `status`, `updated_by`, `updated_at`. Rule match theo text chuẩn hóa, không chạy `eval` hoặc regex do ADMIN nhập nếu chưa có bộ kiểm tra an toàn. Xung đột ý định hoặc độ tin cậy thấp trả `NEEDS_CLARIFICATION`, không tự đoán. Ma trận ánh xạ trường so sánh theo `category_id` dùng whitelist trong service/config được review với chủ catalog; không cho client yêu cầu tên cột SQL bất kỳ.

## 4. API dự kiến

| Method/path | Quyền | Mục đích |
| --- | --- | --- |
| `POST /api/chatbot/messages` | Guest/CUSTOMER | Nhận câu hỏi, context tối thiểu; trả lời theo intent/FAQ/catalog |
| `GET /api/chatbot/quick-questions` | Public | Danh sách câu hỏi gợi ý được duyệt |
| `GET /api/admin/chatbot/faqs` | ADMIN | Danh sách FAQ và trạng thái |
| `POST /api/admin/chatbot/faqs` | ADMIN | Tạo FAQ nháp |
| `PATCH /api/admin/chatbot/faqs/{id}` | ADMIN | Sửa, kích hoạt hoặc vô hiệu FAQ |

Request tin nhắn (không gửi giá, tồn hoặc role từ client):

```json
{
  "message": "So sánh giá của các sản phẩm đã chọn",
  "selectedProductIds": [12, 15],
  "requestedFields": ["price"],
  "context": { "categoryId": 3, "budgetVnd": null }
}
```

Response mẫu về **shape**, không phải lời khuyên từ catalog:

```json
{
  "success": true,
  "message": "Đã xử lý câu hỏi",
  "data": {
    "intent": "COMPARE",
    "state": "ANSWERED",
    "reply": "Hai sản phẩm thuộc cùng danh mục. Bảng dưới đây chỉ so sánh giá của SKU đang hoạt động.",
    "followUpQuestion": "Bạn muốn so sánh thêm tiêu chí nào?",
    "comparison": {
      "categoryId": 3,
      "fields": ["price"],
      "products": [
        { "productId": 12, "name": "Sản phẩm mẫu A", "skuId": 31, "sku": "SAMPLE-A", "values": { "price": "7900000.00" } },
        { "productId": 15, "name": "Sản phẩm mẫu B", "skuId": 32, "sku": "SAMPLE-B", "values": { "price": "8900000.00" } }
      ],
      "missingFields": []
    },
    "facts": [],
    "actions": []
  }
}
```

`comparison.products[]` khi có dữ liệu gồm `productId`, `name`, `skuId`/`sku`, `values` theo field được yêu cầu và `sourceUpdatedAt` nếu có. `facts[]` ghi `field`, `value`, `unit`, `sourceType` (`CATALOG`, `FAQ`, `RULE`), `productId` và `isEstimate`; UI có thể mở chi tiết sau nhưng câu ngắn vẫn phải đủ ý. `actions[]` chỉ chứa route nội bộ có thật, chẳng hạn `/products/{id}`. Trạng thái: `ANSWERED`, `NEEDS_CLARIFICATION`, `NO_DATA`. Với `NEEDS_CLARIFICATION`, `comparison` có thể null và `followUpQuestion` hỏi đúng trường còn thiếu. Nội dung tự do tối đa 500 ký tự; ID không tồn tại/không active → 404 hoặc `NO_DATA` theo trường hợp, 2–4 sản phẩm khác danh mục/trùng → 422, request sai quyền → 401/403, dịch vụ catalog lỗi → 503 với lời nhắn thử lại; không trả HTTP 200 giả thành công khi dependency hỏng.

## 5. Kiểm thử khi triển khai BE

- Hỏi giá không chỉ rõ sản phẩm/SKU; SKU nhiều giá; sale hết hạn; thiếu giá; sản phẩm ngừng bán.
- So sánh 2, 3, 4 sản phẩm cùng danh mục; trùng ID; khác danh mục; yêu cầu chỉ một tiêu chí; không nêu tiêu chí; yêu cầu key không nằm whitelist.
- FAQ chưa được ADMIN duyệt, nội dung chính sách hết hiệu lực, câu hỏi không match, hai intent cùng match.
- Mọi câu trả lời có câu hỏi mở; không khẳng định nhu cầu phù hợp khi quy tắc/giá trị thiếu; không bịa số liệu, tồn hay chính sách.
- Đóng/mở UI không mất hội thoại trong tab hiện tại, mobile bảng có cuộn ngang, bàn phím thao tác được; sau khi nối API phải có loading/error/retry thật.
