# HOME-01 / FIT-01 / TCO-01 / LIFE-01 / CARE-01 — schema và API contract

Trạng thái 06/11/2026: CRUD quy tắc FitCheck cho ADMIN đã có FE/API, cần áp migration `012_decision_tools.sql` rồi `013_fit_rule_versions.sql` trước khi dùng. FitCheck cho khách, room profile, TCO và care vẫn là contract/bản mẫu, chưa có evaluator/API production. Màn hình quản trị lấy field từ catalog, không dùng dữ liệu minh họa. Ba mức kết quả FitCheck được giữ trong contract; thay đổi rule không sửa snapshot phiên bản cũ.

## 1. Quy ước chung

- JSON dùng `{ "success": true, "message": "...", "data": ... }`; lỗi dùng `{ "success": false, "message": "...", "errors": [...] }` và HTTP 400/401/403/404/409/422/503 đúng nguyên nhân.
- Xác thực bằng session hiện có; CSRF bắt buộc cho request ghi. `userId`, `updatedBy`, role được lấy từ session, không tin giá trị client gửi. CUSTOMER chỉ thấy/sửa dữ liệu của mình; ADMIN mới sửa quy tắc và xem dashboard.
- **Mọi chiều dài chuẩn hóa mm**, số nguyên dương. Diện tích dùng m²; điện kWh; nước m³; tiền VND dạng số thập phân chính xác. `null` là chưa biết, khác `false` và khác `0`. Frontend có thể hiển thị cm nhưng phải đổi sang mm trước khi gửi.
- Thời điểm API theo ISO 8601 UTC; ngày bảo trì là ngày địa phương `Asia/Ho_Chi_Minh`. Không tự suy ra chiều cao/độ sâu/khoảng hở khi thiếu dữ liệu.
- API nhận ID số nguyên dương, giới hạn độ dài chuỗi và phân trang danh sách. Product phải `is_active=1`, `is_deleted=0` mới được kiểm tra/tính mới.

## 2. Hồ sơ phòng (`room_profiles`)

`GET /api/room-profiles` (CUSTOMER) trả hồ sơ chưa xóa của phiên hiện tại. `POST /api/room-profiles` tạo; `PATCH /api/room-profiles/{id}` sửa; `DELETE /api/room-profiles/{id}` soft delete. `POST /api/room-profiles/{id}/default` đặt mặc định. Chỉ owner truy cập ID; ID của người khác trả 404 để không lộ sự tồn tại. Xóa default thì chuyển sang hồ sơ khác đã chọn trong cùng transaction hoặc không còn default. Unique generated column trong schema chặn hai default cùng lúc.

Request tạo/sửa (PATCH cho phép gửi một phần):

```json
{
  "name": "Góc bếp",
  "placementWidthMm": 320,
  "placementDepthMm": 320,
  "placementHeightMm": null,
  "doorWidthMm": 700,
  "floorAreaM2": null,
  "occupantCount": 2,
  "powerAvailable": true,
  "waterSupply": false,
  "drainage": false
}
```

Response `data` thêm `id`, `isDefault`, `createdAt`, `updatedAt`. Field không có trong PATCH giữ giá trị cũ; field `null` xóa thông tin đã biết. Tên bắt buộc, trim, tối đa 120 ký tự. Kích thước nếu có phải >0; boolean có thể null. Không lưu địa chỉ chính xác của phòng trong bảng này.

## 3. FitCheck và quy tắc quản trị

`POST /api/fit-checks` (CUSTOMER hoặc khách chưa đăng nhập dùng `roomDraft`) nhận đúng một trong `roomProfileId` hoặc `roomDraft`; `productId` bắt buộc. Chỉ CUSTOMER được dùng `roomProfileId` của mình. `requestKey` UUID chống ghi sự kiện trùng khi retry.

```json
{ "productId": 42, "roomProfileId": 7, "requestKey": "0b05aa35-3170-44d3-94cf-e981f31d7d5b" }
```

Response mẫu (giá trị minh họa, không phải dữ liệu catalog):

```json
{
  "success": true,
  "message": "Đã kiểm tra độ phù hợp",
  "data": {
    "productId": 42,
    "result": "NEEDS_CHECK",
    "label": "Cần kiểm tra thêm",
    "checks": [
      { "ruleId": 12, "ruleVersion": 1, "status": "PASS", "title": "Chiều rộng", "actual": 300, "limit": 320, "unit": "mm", "explanation": "Sản phẩm và khoảng hở nằm trong chiều rộng vị trí đặt." },
      { "ruleId": 13, "ruleVersion": 2, "status": "MISSING", "title": "Chiều cao", "actual": null, "limit": null, "unit": "mm", "explanation": "Chưa có chiều cao vị trí đặt." }
    ],
    "evaluatedAt": "2026-10-19T08:00:00Z"
  }
}
```

Áp dụng quy tắc `ACTIVE` của danh mục và sản phẩm; quy tắc sản phẩm cùng `ruleKey` **ghi đè** quy tắc danh mục. Nếu không có quy tắc áp dụng hoặc thiếu thông số bắt buộc, trả `NEEDS_CHECK`, không báo `FIT`. Với mỗi quy tắc, một vế lấy từ trường phòng hoặc thuộc tính sản phẩm trong whitelist; vế còn lại lấy từ trường/thuộc tính hoặc hằng số. So sánh bằng toán tử `LT/LTE/EQ/GTE/GT`; `marginValue` cộng vào vế trái đối với quy tắc kích thước `mm` (khoảng hở cần chừa). Không dùng `eval`. `FAIL` của `BLOCK` → `NOT_FIT`; nếu không có lỗi chặn nhưng có `MISSING` hoặc `FAIL` của `WARN` → `NEEDS_CHECK`; tất cả `PASS` → `FIT`. Response phải giải thích từng quy tắc, kể cả dữ liệu thiếu. Lưu `decision_events` chỉ sau khi tính thành công; retry cùng `requestKey` không tăng lượt.

ADMIN dùng `GET /api/admin/fit-rules?categoryId=&productId=&status=&page=`, `GET /api/admin/fit-rules/options?categoryId=`, `GET /api/admin/fit-rules/{id}`, `GET /api/admin/fit-rules/{id}/versions`, `POST /api/admin/fit-rules`, `PATCH /api/admin/fit-rules/{id}` và `DELETE /api/admin/fit-rules/{id}` để cấu hình phạm vi, nguồn/toán tử, giá trị, đơn vị, `severity`, thông điệp PASS/FAIL/MISSING và `status`. `DELETE` chỉ đổi trạng thái sang `INACTIVE`. Một quy tắc thuộc **một** `categoryId` hoặc `productId`; `updatedBy`/`updatedAt` do server ghi theo UTC, `version` tăng khi sửa. PATCH nhận toàn bộ field và `expectedVersion` để chặn ghi đè đồng thời. Mỗi lần tạo/sửa/vô hiệu lưu snapshot JSON bất biến trong `fit_rule_versions` cùng transaction; lịch sử cũ không bị cập nhật. Migration 013 lưu trạng thái hiện tại của rule đã có thành bản `BASELINE`, không giả lập các lần sửa trước khi có audit. Chỉ chấp nhận key trong [bảng field chuẩn](SPEC-FIELDS.md) và metadata `product_attributes` của danh mục có đúng kiểu/đơn vị. Không nhận biểu thức mã nguồn và không dùng `eval`. Khoảng hở không âm, chỉ áp cho mm. Cần TV4 xác nhận nguồn field/đơn vị trước khi bật evaluator FitCheck production.

Ví dụ tạo quy tắc chiều rộng (chỉ khi catalog danh mục 2 có `width_mm` kiểu `number`, đơn vị `mm`):

```json
{
  "categoryId": 2, "productId": null, "ruleKey": "width_clearance", "title": "Chiều rộng vị trí",
  "leftSource": "PRODUCT_ATTRIBUTE", "leftKey": "width_mm", "operator": "LTE",
  "rightSource": "ROOM_FIELD", "rightKey": "placement_width_mm", "rightValue": null,
  "marginValue": "20", "unit": "mm", "severity": "BLOCK", "status": "ACTIVE",
  "passMessage": "Vừa vị trí đặt.", "failMessage": "Vượt chiều rộng vị trí đặt.",
  "missingMessage": "Thiếu kích thước để kiểm tra."
}
```

`GET /api/admin/fit-rules` trả `{ items, total, page, pageSize }` với `pageSize=50`; danh sách và lịch sử chỉ ADMIN xem được. POST trả 201, GET/PATCH/DELETE 200. Thiếu phiên 401, sai role 403, scope/field/đơn vị/toán tử sai 422, ID không tồn tại 404, trùng mã quy tắc hoặc `expectedVersion` cũ 409. Mọi thao tác ghi cần cookie phiên và CSRF theo `http-client.js`; `updatedBy` không nhận từ request. `GET /options` trả danh mục, sản phẩm, field phòng và các field catalog **đủ điều kiện FitCheck** của `categoryId` đã chọn. Metadata không khớp bảng chuẩn sẽ không xuất hiện và không được lưu thành rule.

Kiểm thử độc lập từ gốc repo: `powershell -NoProfile -ExecutionPolicy Bypass -File server/tests/run-fit-rule-mysql.ps1` sau khi có Docker và image PHP `is207r12-website-ban-do-gia-dung-api:latest`. Runner tạo MySQL 8.4 tạm không mở cổng, áp baseline/migration trên `fit_rule_isolated`, kiểm tra CRUD, audit, bản cũ bất biến, version cũ 409, role 403, field sai đơn vị 422 và metadata seed của TV4; sau đó xóa đúng container tạm. Không chạy 012/013 trên DB chung chỉ để thử form.

## 4. TCO (`POST /api/tco/calculate`)

Đây là phép tính **stateless**; chưa tạo bảng lưu kịch bản người dùng. Request có `productIds` gồm 2–4 ID cùng danh mục, `years` ∈ {1,3,5}, `usesPerWeek` ≥0, `electricityVndPerKwh` ≥0, `waterVndPerM3` ≥0, cùng `requestKey` UUID. Có thể thêm giả định vật tư/bảo trì theo sản phẩm sau khi TV2/TV3 duyệt nguồn giá. Response cho từng sản phẩm trả `purchase`, `electricity`, `water`, `consumables`, `maintenance`, `total`, `assumptions`, `formula`, `missingInputs`, `currency: "VND"`. Giá mua lấy giá bán hiệu lực **trên server** tại thời điểm tính, không nhận từ client.

`total = purchase + electricity + water + consumables + maintenance` trong kỳ. Chuẩn hóa W→kW, lít→m³, số lần/tuần→số lần trong kỳ trước khi tính. Khi thiếu một thành phần bắt buộc, thành phần đó và `total` là `null`, kèm `missingInputs`; không thay `null` bằng 0. Số 0 chỉ dùng khi dữ liệu xác nhận thực sự không phát sinh chi phí. Chi phí là ước tính, không phải số tiền checkout. Ghi một `decision_events` loại TCO sau mỗi request thành công, dedupe bằng `requestKey`.

## 5. Thiết bị sở hữu và chăm sóc

`GET /api/owned-devices` và `GET /api/owned-devices/{id}` (CUSTOMER) đọc thiết bị của chính mình, phân trang; `PATCH /api/owned-devices/{id}` chỉ cho sửa `serialNumber` (tùy chọn) và trạng thái lưu trữ. Không cho client sửa SKU/ngày mua/bảo hành snapshot. `GET /api/owned-devices/{id}/care-tasks` lấy lịch; `POST /api/care-tasks/{id}/complete` và `/postpone` (với `newDueDate`, `reason`) chỉ tác động task của owner. Hoàn thành lặp trả cùng trạng thái; không tạo chu kỳ tiếp theo hai lần. Hoãn không được xóa ngày đến hạn gốc.

Khi đơn chuyển hợp lệ sang `COMPLETED`, service đơn hàng tạo **một `owned_devices` cho mỗi đơn vị số lượng** trong `order_items`, trong cùng transaction/outbox có idempotency. Khóa `(order_item_id, unit_number)` và `(owned_device_id, care_rule_id, cycle_number)` bảo vệ retry. Lấy `purchasedAt` từ `orders.placed_at`, `completedAt` từ thời điểm hoàn tất; snapshot tên/SKU/bảo hành từ `order_items`. Ngày bắt đầu bảo hành để `null` cho đến khi chính sách nhóm thống nhất, không tự cộng tháng từ ngày đặt. Không bắt buộc serial.

ADMIN dùng `GET/POST/PATCH /api/admin/care-rules` để cấu hình quy tắc theo danh mục hoặc sản phẩm, `firstDueDays`, `intervalDays`, hướng dẫn, trạng thái, người/thời gian sửa. Quy tắc sản phẩm cùng `ruleKey` ghi đè quy tắc danh mục. Chỉ tạo lịch cho quy tắc đang hoạt động; thay đổi quy tắc không âm thầm viết lại task đã phát sinh. Khi API/bridge đơn hàng chưa sẵn sàng, UI phải hiển thị empty/error thật, không tự sinh thiết bị mẫu.

## 6. Lỗi và giới hạn cần kiểm thử

| Tình huống | Kết quả |
|---|---|
| Người khác truy cập room/device/task ID | 404 |
| CUSTOMER sửa rule hoặc xem dashboard | 403 |
| Kích thước ≤0, đơn vị sai, quy tắc key không whitelist | 422 |
| Hai sản phẩm TCO khác danh mục | 422 |
| Product không tồn tại/không hoạt động | 404 |
| Quy tắc không có dữ liệu đầu vào | `NEEDS_CHECK` với `MISSING`, không lỗi 500 |
| TCO thiếu giá hoặc thông số | `total: null` với `missingInputs` |
| Completed event hoặc requestKey lặp | Không thêm device/task/event lần hai |

## 7. Ranh giới triển khai hiện tại

CRUD rule quản trị đã triển khai nhưng cần áp cả migration 012/013 trên database được duyệt. Chưa có CRUD phòng, rule evaluator, TCO calculator, completion bridge hay care scheduler production. `decision_events` hiện chỉ ghi lượt và mức kết quả, chưa lưu chi tiết từng lần đánh giá; không được coi bảng phiên bản rule là lịch sử kết quả FitCheck của khách. Trước khi nối evaluator cần TV4 xác nhận metadata catalog và kiểm thử quyền, dữ liệu thiếu, biên kích thước, đổi đơn vị và idempotency.
