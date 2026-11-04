# DASH-01 / RPT-03 — dashboard contract để TV2/TV3 duyệt

Trạng thái 04/11/2026: **dashboard tổng hợp vẫn là đề xuất, chưa được TV2/TV3 xác nhận và chưa có endpoint**. React preview tại `client/src/pages/admin/DashboardPreviewPage.jsx` hiển thị dấu `—`, không tạo số liệu giả. Task 30 đã bổ sung CSV giao dịch riêng theo quy tắc bên dưới; không coi CSV là endpoint dashboard.

## Endpoint dự kiến

`GET /api/admin/dashboard?from=2026-10-01&to=2026-10-19&timezone=Asia/Ho_Chi_Minh` — ADMIN; ngày `from` gồm đầu ngày, `to` gồm hết ngày địa phương; backend đổi sang khoảng UTC `[from, toExclusive)`. Giới hạn kỳ tối đa 366 ngày, validate `from <= to`. Response: `period`, `sales`, `ordersByStatus`, `topProducts`, `lowStock`, `decisionTools`, `dataStatus`. Mỗi chỉ số không có nguồn đủ tin cậy trả `value: null` và `dataStatus: "UNAVAILABLE"`, không trả 0.

```json
{
  "success": true,
  "message": "Đã lấy dashboard",
  "data": {
    "period": { "from": "2026-10-01", "to": "2026-10-19", "timezone": "Asia/Ho_Chi_Minh" },
    "sales": { "netRevenueVnd": null, "placedOrders": null, "purchasingCustomers": null, "soldUnits": null },
    "ordersByStatus": [], "topProducts": [], "lowStock": [],
    "decisionTools": { "fitChecks": null, "notFitRate": null, "tcoCalculations": null, "careCompletionRate": null },
    "dataStatus": "UNAVAILABLE"
  }
}
```

Ví dụ chỉ mô tả shape khi nguồn dữ liệu chưa sẵn sàng, **không** phải response production.

## Định nghĩa đề xuất

| Chỉ số | Tử số / cách tính | Mốc thời gian và loại trừ |
|---|---|---|
| Doanh thu thuần (VND) | Tổng các sự kiện SALE trừ các sự kiện REFUND mô phỏng | CSV Task 30 ghi SALE một lần tại lần đầu đơn `COMPLETED` và đã `PAID`; ghi REFUND âm theo `created_at` của ledger. Hủy không phải SALE. Dashboard tổng hợp cần thống nhất tiếp cách hiển thị theo kỳ với TV2/TV3. |
| Đơn hàng đã đặt | `COUNT(DISTINCT orders.id)` | Theo `placed_at` trong kỳ; có thể gồm đơn hủy, vì đây là số đơn **đã đặt**, không phải đơn thành công. |
| Khách mua hàng | `COUNT(DISTINCT customer_id)` của đơn hợp lệ | Theo ngày hoàn tất trong kỳ; loại đơn hủy/chưa hoàn tất. |
| Sản phẩm đã bán | `SUM(order_items.quantity)` của đơn hoàn thành | Theo ngày hoàn tất trong kỳ; điều chỉnh hàng trả chỉ khi có quy tắc trả hàng được duyệt. |
| Đơn theo trạng thái | `COUNT(DISTINCT order_id)` theo trạng thái hiện tại | Lấy các đơn đặt trong kỳ và phân nhóm bằng trạng thái tại thời điểm truy vấn. Tổng các nhóm phải bằng đơn đã đặt. |
| Top sản phẩm | `SUM(order_items.quantity)` theo `product_id`/snapshot SKU của đơn hoàn thành | Theo ngày hoàn tất trong kỳ; thứ tự giảm dần, tie-break bằng ID. Không dùng tên hiện tại làm khóa. |
| Cảnh báo tồn | SKU đang hoạt động có `stock_quantity <= low_stock_threshold` | Snapshot tại thời điểm truy vấn, **không** phải số liệu lịch sử trong kỳ. |
| Lượt FitCheck | `COUNT(decision_events)` loại `FIT_CHECK` | Theo `created_at` trong kỳ; một `request_key` tính một lần. |
| Tỷ lệ không phù hợp | Số event `NOT_FIT` / tổng event `FIT_CHECK` có kết quả | Trong kỳ; không có lượt thì trả `null`, không chia 0. `NEEDS_CHECK` ở mẫu số. |
| Lượt tính TCO | `COUNT(decision_events)` loại `TCO` | Theo `created_at` trong kỳ; một `request_key` tính một lần. |
| Tỷ lệ hoàn tất bảo trì | Số task có `completed_at` trong kỳ và đến hạn trong kỳ / số task đến hạn trong kỳ | Cần TV2/TV3 xác nhận cách tính task được hoãn và task hoàn thành muộn; cho đến đó `UNAVAILABLE`. |

## Cần TV2/TV3 xác nhận trước khi bật endpoint

1. **TV2 — đơn/tiền:** CSV Task 30 đã chốt mốc SALE là lần đầu chuyển `COMPLETED` khi đơn `PAID`, và ghi khoản hoàn toàn đơn mô phỏng âm theo thời điểm lập ledger; dashboard tổng hợp còn cần thống nhất hiển thị kỳ và việc hàng trả có trừ `soldUnits` hay không. Không thể lấy doanh thu thuần chuẩn chỉ bằng cột `orders.total_amount` hiện tại.
2. **TV3 — catalog/kho/thiết bị:** khóa tổng hợp top sản phẩm khi SKU đổi tên; ngưỡng tồn hiện tại; nguồn clearance/kích thước chuẩn mm; thời điểm bắt đầu lịch bảo trì và cách xử lý hoãn.
3. **Cả hai:** thống nhất timezone báo cáo, dữ liệu đơn cũ thiếu mốc hoàn tất, và liệu khách hàng/đơn bị soft delete còn được tính trong báo cáo lịch sử.

## Kiểm thử nghiệm thu sau khi có API

Đối chiếu ba đơn mẫu: một đơn hoàn thành/đã trả tiền, một đơn hủy, một đơn hoàn tiền một phần; kiểm tra mốc kỳ, tổng doanh thu và phân nhóm trạng thái. Gửi lặp cùng `request_key` để chứng minh FitCheck/TCO không tăng hai lượt. Kiểm tra kỳ không có mẫu trả tỷ lệ `null`. ADMIN nhận dữ liệu, CUSTOMER nhận 403. Chạy trên dữ liệu đã review; không reset database chung để tạo báo cáo.

### CSV giao dịch Task 30 hiện có

`GET /admin/reports/revenue.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` chỉ dành cho ADMIN. Ngày bao gồm cả hai đầu theo `Asia/Ho_Chi_Minh`, tối đa 366 ngày. Một dòng SALE dương được ghi vào lần đầu lịch sử đơn chuyển `COMPLETED`, nếu thanh toán đã xác nhận `PAID` (bao gồm đơn đã hoàn sau đó); mỗi khoản hoàn mô phỏng tạo một dòng REFUND âm theo thời gian ghi sổ; NET_TOTAL bằng tổng SALE trừ REFUND trong kỳ. Refund hiện hoàn toàn bộ `orders.total_amount`, gồm phí giao hàng, sau SALES phân loại, ADMIN duyệt mức MAJOR/CRITICAL và WAREHOUSE xác nhận đủ checklist. Đây là sổ mô phỏng; không gọi ngân hàng và không tự nhập hàng trả lại vào tồn. Schema/route cần migration `015_return_refund_reporting.sql`.
