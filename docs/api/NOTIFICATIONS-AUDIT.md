# Thông báo trong web và nhật ký audit

## Quyền và hành vi chung

- Hộp thư lưu trong MySQL và luôn giới hạn theo tài khoản trong session. API không nhận `userId` từ trình duyệt.
- Nhật ký audit chỉ đọc, dành cho `ADMIN`; mỗi sự kiện lưu actor, role, hành động, đối tượng, metadata và thời điểm UTC.
- Bốn role cố định: `CUSTOMER`, `ADMIN`, `SALES`, `WAREHOUSE`.
- API dùng prefix gốc; ví dụ là `/notifications`, không có `/api` ở trước.
- Các request ghi dữ liệu cần cookie session và header `X-CSRF-Token`. Client dùng HTTP service chung để gửi cookie và token.
- Thành công trả `{ "success": true, "message": "Thành công.", "data": ... }`. Lỗi trả status HTTP phù hợp cùng `success: false`, `message` và `errors`.

## Hộp thư thông báo

| Method và đường dẫn | Quyền | Query/body | Kết quả |
| --- | --- | --- | --- |
| `GET /notifications` | Bất kỳ role đã đăng nhập | Query tùy chọn: `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 50), `unreadOnly` (`true/false`, mặc định `false`). | Trang thông báo của chính người dùng, tổng chưa đọc và metadata phân trang. |
| `PATCH /notifications/{id}/read` | Bất kỳ role đã đăng nhập | Không cần body; `id` là số nguyên dương. Có CSRF. | ID và thời điểm đọc. ID không tồn tại/thuộc tài khoản khác trả cùng `404`. |
| `POST /notifications/read-all` | Bất kỳ role đã đăng nhập | Không cần body. Có CSRF. | Số thông báo chưa đọc được cập nhật; retry trả `updatedCount: 0`. |

Ví dụ `GET /notifications?page=1&pageSize=20&unreadOnly=false`:

```json
{
  "success": true,
  "message": "Thành công.",
  "data": {
    "items": [
      {
        "id": "42",
        "type": "ORDER",
        "title": "Đã tiếp nhận đơn hàng",
        "message": "Đơn hàng #HC202611200001 đang chờ xác nhận.",
        "targetUrl": "/orders/9",
        "readAt": null,
        "createdAt": "2026-11-20 09:00:00"
      }
    ],
    "unreadCount": 1,
    "pagination": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 }
  }
}
```

Ví dụ `PATCH /notifications/42/read`:

```json
{
  "success": true,
  "message": "Thành công.",
  "data": { "id": "42", "readAt": "2026-11-20 09:05:00" }
}
```

Thông báo chỉ chấp nhận loại (`ORDER`, `RETURN`, `CARE`, `WARRANTY`, `ACCOUNT`, `SYSTEM`) và đường dẫn nội bộ được allowlist (`/orders`, `/orders/{id}`, `/customer/devices`, `/sales/orders`, `/sales/returns`, `/warehouse/returns`, `/notifications`). `(recipient_id, event_key)` là duy nhất, nên retry hoặc callback lặp không phát thông báo trùng. Thông báo đơn hàng (tạo đơn, đổi trạng thái, khách tự hủy đơn → báo khách và `SALES`), thanh toán (xác nhận, thất bại, hết hạn, hoàn tiền mô phỏng từ server/IPN), và trả hàng (tạo yêu cầu → khách + `SALES`, phân loại → khách + `ADMIN`, quản lý duyệt/từ chối → khách + `WAREHOUSE` khi duyệt, kho kiểm nhận & hoàn tiền mô phỏng → khách) được ghi cùng transaction nghiệp vụ; trình duyệt quay về từ VNPay không tự xác nhận thanh toán.

## Nhật ký audit

`GET /admin/audit-logs` chỉ dành cho `ADMIN`. Không có API sửa hoặc xóa audit.

Query tùy chọn:

- `action`, `entityType`: lọc chính xác, chỉ chữ/số/`_`/`-`, tối đa 80 ký tự.
- `actorId`: ID nguyên dương.
- `from`, `to`: ngày `YYYY-MM-DD`; ngày bắt đầu không được sau ngày kết thúc.
- `page`: mặc định 1; `pageSize`: mặc định 25, tối đa 100.

Ví dụ response:

```json
{
  "success": true,
  "message": "Thành công.",
  "data": {
    "items": [
      {
        "id": "8",
        "actorId": "3",
        "actorName": "Quản trị viên",
        "actorRole": "ADMIN",
        "action": "USER_DISABLE",
        "entityType": "user",
        "entityId": "12",
        "details": { "from": "ACTIVE", "to": "DISABLED", "reason": "Vi phạm chính sách" },
        "createdAt": "2026-11-20 09:00:00"
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 1, "totalPages": 1 }
  }
}
```

Các sự kiện đã nối gồm:
- Xác thực (`auth`): `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `LOGOUT`.
- Quản trị tài khoản (`user`): `USER_CREATE`, `USER_UPDATE`, `USER_DISABLE`, `USER_ENABLE`.
- Catalog (`category`, `brand`, `product`, `product_variant`, `product_image`, `product_attribute`, `banner`): tạo/sửa/xóa mềm danh mục, thương hiệu, sản phẩm, cập nhật thông số sản phẩm (`CATALOG_PRODUCT_ATTRIBUTES_UPDATED`), biến thể SKU, ảnh, tạo thuộc tính danh mục, banner.
- FitCheck & bảo trì (`fit_rule`, `decision_event`, `care_rule`): tạo/sửa/vô hiệu hóa quy tắc FitCheck, hoàn tất đánh giá FitCheck (cùng transaction `decision_events`), tạo/cập nhật quy tắc bảo trì (`CARE_RULE_CREATED`, `CARE_RULE_UPDATED`).
- Đơn hàng, thanh toán, trả hàng (`order`, `payment`, `return_request`): `ORDER_CREATED`, `ORDER_STATUS_CHANGED`, `PAYMENT_*`, `RETURN_REQUESTED`, `RETURN_TRIAGED`, `RETURN_DECIDED`, `RETURN_REFUND_SIMULATED`.
- Kho (`inventory_movement`): `INVENTORY_ADJUSTED`.

Metadata không ghi mật khẩu, token, secret hoặc dữ liệu xác thực.

## Mã lỗi

| HTTP | Khi nào |
| --- | --- |
| `400` | JSON body sai cú pháp. |
| `401` | Chưa đăng nhập hoặc session hết hạn. |
| `403` | Sai CSRF hoặc role không có quyền xem audit. |
| `404` | Thông báo không tồn tại trong hộp thư hiện tại. |
| `405` | Method không hỗ trợ; response có header `Allow`. |
| `413` | Request body vượt 16 KiB. |
| `422` | Query, phân trang hoặc bộ lọc không hợp lệ. |

## Migration và nhắc lịch

- Migration `022_notifications_audit.sql` thêm bảng `notifications`, cột `audit_logs.actor_role` và index lọc audit; áp sau `021_installation_checklists.sql`.
- Migration `023_owned_device_returns.sql` thêm trạng thái `RETURNED` và siêu dữ liệu trả hàng cho `owned_devices` để giữ lịch sử sở hữu nhưng loại thiết bị đã trả khỏi nhắc lịch bảo trì/bảo hành; áp sau `022_notifications_audit.sql`.
- Xem trạng thái bằng `php server/db/setup.php status --database=<DB_NAME>`. Chỉ áp migration còn thiếu sau khi review và sao lưu. Không chạy lại DDL đã áp dụng.
- `server/scripts/send-reminders.php` chạy CLI, yêu cầu `ORDER_STORAGE_MODE=mysql`, và chọn bảo trì đến hạn trong 7 ngày cùng bảo hành hết hạn trong 30 ngày (chỉ thiết bị `ACTIVE` của khách `ACTIVE`). Unique event key làm cho chạy lặp an toàn.
- Job cần scheduler của môi trường vận hành gọi hằng ngày. Ví dụ PowerShell/Windows Task Scheduler action: `php.exe E:\DoAnWeb\server\scripts\send-reminders.php`; cấu hình working directory `E:\DoAnWeb` và biến môi trường DB theo môi trường chạy. Nếu chưa cấu hình scheduler thì thông báo tức thời vẫn hoạt động, thông báo định kỳ chưa tự phát.

## Kiểm thử

- Backend đơn vị: `php server/tests/notification-audit.test.php`, `php server/tests/admin-user-management-test.php`, `php server/tests/db-setup.test.php`.
- Backend tích hợp MySQL cô lập: `node server/tests/run-order-mysql-tests.mjs` chạy trên MySQL datadir tạm riêng, gồm quyền sở hữu hộp thư, trạng thái đọc, thông báo khách hủy đơn & kho nhận hàng trả, audit thông số/quy tắc bảo trì, quyền/filter audit và chạy job nhắc lịch hai lần. Bộ kiểm thử từ chối kết nối port MySQL mặc định và chỉ xóa datadir do chính runner vừa tạo.
- Frontend: `cd client && npm test && npm run build` (gồm `client/tests/notification-audit-services.test.js`).
