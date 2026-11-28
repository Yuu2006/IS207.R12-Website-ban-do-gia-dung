# FIT-02 — Checklist chuẩn bị giao/lắp

## Source và luồng

`components/decision/InstallationChecklist.jsx` → `services/installation-checklist-service.js` → route/controller/service/model `installation-checklist-*.php` → `installation_checklists` và `installation_checklist_events` (migration **021**, sau 012).

CUSTOMER mở `/customer/decision-tools`, chọn sản phẩm ở tab Không gian & FitCheck. Checklist dùng cùng sản phẩm và hồ sơ phòng đang chọn; không có hồ sơ thì dùng phạm vi khách/sản phẩm. Có liên kết tới ảnh/thông số trong trang sản phẩm. Không đọc/diễn giải ảnh và không kết luận đã đủ điều kiện lắp từ việc đánh dấu checklist.

Mẫu v1 gồm `spaceMeasured`, `manualReviewed`, `utilitiesChecked`, `deliveryConfirmed`. Đây là lời tự xác nhận đã đo vị trí/đường đi qua cửa, đã đọc hướng dẫn model, đã kiểm tra điện/nước nếu áp dụng và đã chốt phương án giao/lắp với cửa hàng. Khách có thể đính kèm một ảnh tham khảo vị trí/lối lắp; ảnh không được phân tích. Không đưa ra khoảng hở hay cấu hình điện/nước tự bịa.

## API

| Method/path | Quyền | Request / kết quả |
| --- | --- | --- |
| GET `/api/installation-checklists?productId=50&roomProfileId=7` | CUSTOMER owner | `roomProfileId` tùy chọn; trả mẫu, checks, version, trạng thái, firstCompletedAt, history 20 phiên bản gần nhất |
| POST `/api/installation-checklists` | CUSTOMER owner + CSRF | Lưu tiến độ, `referencePhotoUrl` tùy chọn; theo version và `requestKey` UUID v4 để replay |

```json
{
  "productId": 50,
  "roomProfileId": 7,
  "expectedVersion": 0,
  "requestKey": "d49761b2-6d22-4a54-a714-b7a1e7c013bd",
  "referencePhotoUrl": "/uploads/checklists/0123456789abcdef0123456789abcdef.jpg",
  "checks": {
    "spaceMeasured": true,
    "manualReviewed": false,
    "utilitiesChecked": false,
    "deliveryConfirmed": false
  }
}
```

Response envelope chung, `data`: `id`, `productId`, `roomProfileId`, `version`, `templateVersion`, `items`, `checks`, `completed`, `firstCompletedAt`, `referencePhotoUrl`; GET và POST đều trả `history: [{version,checks,referencePhotoUrl,savedAt}]` (20 phiên bản gần nhất). Chưa lưu thì version 0, mọi check false, firstCompletedAt null. Lưu lần đầu version 1. Chỉ khi tất cả check true mới ghi mốc hoàn tất đầu tiên. Thời điểm ISO UTC.

401 chưa đăng nhập/phiên không còn hợp lệ; 403 sai vai trò/CSRF; 404 sản phẩm không còn công khai hoặc hồ sơ phòng không thuộc khách; 409 version cũ hoặc cùng key nhưng nội dung khác; 422 ID/version/checks/key sai hoặc có field lạ; 503 schema chưa sẵn sàng. Không nhận owner/role từ body. Không lộ lịch sử khách khác.

Một checklist duy nhất trên `(customer_id, product_id, COALESCE(room_profile_id,0))`. Transaction giữ khóa request trước checklist; key lặp replay response cũ, không tạo revision mới. Key khác nhưng version cũ trả 409. Các snapshot event đã lưu không bị sửa khi checklist thay đổi. `first_completed_at` giữ nguyên kể cả bỏ check rồi đánh dấu lại: dashboard đếm checklist hoàn tất lần đầu, không đếm click hoặc số request.

## Kiểm chứng

`week4-mysql.test.php`: quyền owner/role, dữ liệu boolean, version, replay, key khác payload, lịch sử bất biến, hoàn tất lại không tăng mốc; runner thử hai tiến trình đồng thời cùng/khác key. `scripts/test-week4-http.mjs` kiểm cookie/CSRF qua router thật trên database demo được nhận diện riêng.

Ảnh tham khảo được upload qua `POST /api/uploads/images` với `type=checklists`; chỉ nhận JPEG/PNG/WebP tối đa 5 MB và 6000×6000, tên ngẫu nhiên do server sinh. Migration 026 lưu URL trên checklist và snapshot lịch sử.

Giới hạn: mẫu chuẩn bị chung v1, chưa có template riêng theo hãng; không cấp chứng nhận an toàn/lắp đặt, không tự xác thực việc đã đo, không phân tích ảnh.
