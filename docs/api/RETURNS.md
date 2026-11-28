# Trả hàng và hoàn tiền mô phỏng (RET-01)

## Source và luồng

`OrderHistory.jsx` → `order-service.js` → `orders/{id}/returns` → order model/service. Nhân viên dùng `ReturnManagementPage.jsx` → `return-refund-service.js` → `returns`, `sales/returns`, `admin/returns`, `warehouse/returns` → return-refund model/service.

Khách chỉ được tạo một yêu cầu trên đơn đã giao/hoàn thành, đã thanh toán và còn trong `RETURN_WINDOW_DAYS` kể từ ngày giao xác nhận. Yêu cầu chọn dòng hàng/số lượng đã mua, loại vấn đề, mô tả và tối đa `RETURN_MAX_IMAGES` ảnh bằng chứng. Ảnh tải qua `POST /api/uploads/images` với `type=returns`; ảnh không được phân tích tự động. Chi tiết ghi nhận số tiền, phương thức thanh toán gốc và trạng thái hoàn mô phỏng.

SALES phân loại `MINOR`, `MAJOR` hoặc `CRITICAL`. MINOR bị từ chối và không chuyển duyệt. MAJOR/CRITICAL chuyển ADMIN duyệt/từ chối. WAREHOUSE chỉ nhận hàng sau khi duyệt, xác nhận checklist và nhập số lượng đủ điều kiện bán lại cho từng dòng trả. Trong cùng transaction, hệ thống chỉ nhập lại số lượng này, ghi `inventory_movements` với mã tham chiếu duy nhất, lưu checklist và ghi sổ hoàn tiền mô phỏng. Không gọi ngân hàng.

## API

| Method / path | Quyền | Kết quả |
| --- | --- | --- |
| `POST /api/orders/{orderId}/returns` | CUSTOMER sở hữu đơn + CSRF | Tạo yêu cầu với `expectedVersion`, `issueCategory`, `reason`, `items: [{orderItemId, quantity}]`, `photos: string[]`; không tự duyệt/hoàn tiền. |
| `GET /api/returns` | SALES, ADMIN, WAREHOUSE | Danh sách lọc/phân trang. |
| `GET /api/returns/{returnId}` | SALES, ADMIN, WAREHOUSE | Snapshot đơn, dòng trả, ảnh, trạng thái, kiểm tra kho, lịch sử và sổ hoàn. |
| `POST /api/sales/returns/{returnId}/triage` | SALES + CSRF | `{severity, note}`; MINOR bị từ chối, hai mức còn lại chuyển ADMIN. |
| `POST /api/admin/returns/{returnId}/decision` | ADMIN + CSRF | `{decision: APPROVE\|REJECT, reason}`. |
| `POST /api/warehouse/returns/{returnId}/receive` | WAREHOUSE + CSRF | `{checklist, resalableQuantities: [{orderItemId, resalableQuantity}]}`; mọi dòng yêu cầu phải được kiểm tra, số lượng nhập lại không vượt số lượng trả. |

Các POST ghi dữ liệu cần `Idempotency-Key`. Thay đổi trạng thái, người xử lý, ghi chú và chi tiết được lưu trong `order_return_status_history`. Việc nhận kho, nhập tồn, ledger hoàn tiền, trạng thái đơn/thanh toán và idempotency commit cùng transaction.

## Chính sách cần chốt trước nghiệm thu

- `RETURN_WINDOW_DAYS` cần được đặt thành số ngày 1–60; file `.env.example` để trống cho tới khi nhóm chọn 7, 14 hay 30 ngày. Khi chưa cấu hình, API trả 503 có mã `RETURN_WINDOW_NOT_CONFIGURED` và không nhận yêu cầu.
- Luồng tồn kho đã hỗ trợ yêu cầu trả một phần. Quy tắc tiền hoàn cho trả một phần cần được nhóm trưởng xác nhận trước khi nghiệm thu: tính theo snapshot dòng trả và phân bổ giảm giá, số tiền do kho nhập trong giới hạn, hay chỉ cho phép hoàn toàn bộ đơn. Mã hiện giữ cách hoàn toàn bộ tổng đơn đã có từ migration 015; không dùng làm bằng chứng rằng một phần hàng được hoàn đúng giá trị.
- Audit log/thông báo và chuyển `owned_devices.status` nằm trong tích hợp STT18; cần ghép sau khi nhánh tương ứng được review/merge.

## Schema và giới hạn

`015_return_refund_reporting.sql` tạo workflow/ledger cơ bản; `025_return_line_items.sql` lưu dòng/số lượng trả, ảnh và số lượng kho đánh giá lại. Migration 025 đặt một yêu cầu trên mỗi đơn, không cho mở yêu cầu mới sau từ chối; chính sách mở lại chưa được định nghĩa. Các migration mới chỉ được áp trên DB đã review và backup.

Lỗi chính: `401` chưa đăng nhập/phiên hết hạn, `403` sai role hoặc không sở hữu đơn, `404` không tìm thấy đơn/yêu cầu, `409` đơn chưa giao/đã đổi phiên bản/quá hạn/trạng thái xử lý không hợp lệ, `422` dòng hàng/ảnh/số lượng sai, `503` thời hạn trả chưa cấu hình hoặc schema chưa sẵn sàng.
