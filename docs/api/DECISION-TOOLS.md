# HOME-01 / FIT-01 / TCO-01 / LIFE-01 / CARE-01 — schema và API contract

Trạng thái 06/11/2026: **TCO-01 và STT 24 (LIFE-01/CARE-01/ADM-CARE-01) đã có FE/API implementation trên branch `users/le-tan-vi`.** STT 24 thêm bridge tạo thiết bị/lịch cùng transaction hoàn tất đơn, API theo quyền sở hữu, cấu hình chu kỳ ADMIN và liên kết SKU vật tư hiện hành. Migration 012 và 016 chưa được áp vào DB local/chung; cần review rồi áp cả hai trước khi dùng các luồng này với MySQL. HOME/FIT vẫn là contract, chưa nối API.

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

ADMIN dùng `GET /api/admin/fit-rules?categoryId=&productId=`, `POST /api/admin/fit-rules`, `PATCH /api/admin/fit-rules/{id}` để cấu hình phạm vi, nguồn/toán tử, giá trị, đơn vị, `severity`, thông điệp PASS/FAIL/MISSING, `status`. Một quy tắc thuộc **một** `categoryId` hoặc `productId`; `updatedBy`/`updatedAt` do server ghi, `version` tăng khi sửa. Cho phép vô hiệu hóa, không xóa cứng quy tắc đã được dùng. Chỉ chấp nhận key thuộc whitelist theo danh mục, đúng kiểu/đơn vị, và tối đa một khoảng hở dương. Cần thống nhất với catalog nguồn dữ liệu kích thước và clearance trước khi bật rule production.

## 4. TCO (`POST /api/tco/calculate`)

Route công khai (guest hoặc tài khoản đăng nhập), không tạo đơn và không thay đổi tồn kho. Phép tính **stateless**; chỉ ghi một sự kiện `decision_events` để thống kê. Chỉ nhận 2–4 sản phẩm không trùng, cùng danh mục, đang hoạt động và mỗi sản phẩm phải đi cùng một SKU đang bán. Giá mua được đọc từ SKU trên server; nếu sale có hiệu lực, dùng giá sale. Giá và tổng tiền trả dạng chuỗi DECIMAL, không nhận giá sản phẩm từ client.

Request:

```json
{
  "productIds": [12, 15],
  "variantIds": [31, 42],
  "years": 3,
  "usesPerWeek": 5,
  "hoursPerUse": "1.50",
  "electricityVndPerKwh": "3000.00",
  "waterVndPerM3": "25000.00",
  "annualCosts": [
    { "productId": 12, "consumablesVndPerYear": "100000", "maintenanceVndPerYear": "0" },
    { "productId": 15, "consumablesVndPerYear": "", "maintenanceVndPerYear": "150000" }
  ],
  "requestKey": "4d52b3d1-49dc-4e65-9476-51b4f5d1c200"
}
```

`variantIds` ghép theo vị trí tương ứng với `productIds`. `years` chỉ nhận 1, 3 hoặc 5; `usesPerWeek` là số nguyên 0–168; `hoursPerUse` tối đa 24 giờ và cần khi tính từ công suất W với tần suất lớn hơn 0. Đơn giá điện/nước là số không âm, tối đa hai chữ số thập phân. `annualCosts` có một dòng cho mỗi sản phẩm; ô để trống là chưa biết, nhập 0 là người dùng chủ động xác nhận không phát sinh. Chi phí vật tư/bảo trì là giả định người dùng nhập theo năm, không phải giá được catalog xác nhận.

Quy tắc tính hiện tại:

- Tủ lạnh có `energy_kwh_year`: điện = kWh/năm trong catalog × số năm × giá điện. Không nhân thêm tần suất sử dụng vào chứng nhận kWh/năm.
- Sản phẩm có `power_watts`: đơn vị catalog `W` hoặc `kW` được chuẩn hóa về W; điện = W chuẩn hóa ÷ 1000 × giờ/lần × lần/tuần × 52 × số năm × giá điện. Tần suất và giờ/lần là một kịch bản chung để so sánh các sản phẩm cùng danh mục.
- Sản phẩm có `water_liters_cycle`: đơn vị catalog `L` hoặc `m³` mỗi chu trình được chuẩn hóa về lít; nước = lít chuẩn hóa ÷ 1000 × lần/tuần × 52 × số năm × giá nước. Danh mục tủ lạnh và máy lạnh hiện không khai báo tiêu thụ nước theo chu trình nên khoản nước là 0, có ghi rõ trong assumptions/formula.
- Đơn vị vật lý không được hỗ trợ hoặc thông số không hợp lệ được coi là thiếu dữ liệu; API không âm thầm diễn giải chúng thành W/L.
- Nếu trường `unit` để trống, các key `power_watts`, `water_liters_cycle` và `energy_kwh_year` lần lượt mang đơn vị mặc định W, L/chu trình và kWh/năm.
- Vật tư và bảo trì = chi phí năm người dùng nhập × số năm. Không tự giả định khoản chưa biết bằng 0.

Nếu thiếu giá hoặc thông số/giả định bắt buộc, component tương ứng và `total` là `null`, kèm `missingInputs`; các component biết vẫn được hiển thị. Tất cả phép nhân tiền dùng đơn vị cent integer, làm tròn half-up tới 0,01 VND; không dùng float cho tiền. Khi retry cùng `requestKey` và cùng tài khoản, event không bị ghi thêm lần nữa. Client chỉ dùng lại key với đúng payload retry; dùng key đã thuộc người dùng khác hoặc loại event khác trả 409.

Response mẫu:

```json
{
  "success": true,
  "message": "Đã tính chi phí sở hữu.",
  "data": {
    "requestKey": "4d52b3d1-49dc-4e65-9476-51b4f5d1c200",
    "categoryId": 3,
    "categoryName": "Máy giặt",
    "years": 3,
    "usesPerWeek": 5,
    "hoursPerUse": "1.50",
    "electricityVndPerKwh": "3000.00",
    "waterVndPerM3": "25000.00",
    "products": [
      {
        "productId": 12,
        "variantId": 31,
        "productName": "Máy giặt mẫu",
        "categoryId": 3,
        "categoryName": "Máy giặt",
        "sku": "SAMPLE-12-A",
        "variantName": "Trắng",
        "purchase": "8900000.00",
        "electricity": "7897500.00",
        "water": "1579500.00",
        "consumables": "300000.00",
        "maintenance": "0.00",
        "total": "18677000.00",
        "assumptions": ["Điện năng ước tính từ công suất W và kịch bản sử dụng.", "Chi phí vật tư mỗi năm do người dùng nhập."],
        "formula": { "total": "Giá mua + điện + nước + vật tư + bảo trì." },
        "missingInputs": [],
        "currency": "VND"
      }
    ]
  }
}
```

Status: 400 JSON sai; 403 CSRF thiếu/sai; 404 sản phẩm/SKU không tồn tại hoặc ngừng bán; 409 `requestKey` đã gắn với user/event khác; 422 sai dữ liệu hoặc khác danh mục; 503 khi migration/schema hoặc MySQL chưa sẵn sàng. API dùng envelope chung `{success, message, data}` / `{success, message, errors}`.

## 5. Thiết bị sở hữu và chăm sóc

API dùng session, CSRF cho request ghi, envelope chung. CUSTOMER chỉ đọc/sửa thiết bị và lịch của chính mình; ID không thuộc chủ tài khoản trả 404. ADMIN mới được quản lý quy tắc. Query/body thừa hoặc sai kiểu trả 422.

| Method/path | Role | Request/response và lỗi chính |
|---|---|---|
| `GET /api/owned-devices?status=ACTIVE&page=1&pageSize=20` | CUSTOMER | 200 `{items, pagination}`; 401 chưa đăng nhập, 403 sai role, 422 query sai, 503 schema/API chưa sẵn sàng |
| `GET /api/owned-devices/{id}` | CUSTOMER | 200 một thiết bị cùng `careTasks`; 404 không tồn tại/không thuộc owner |
| `PATCH /api/owned-devices/{id}` | CUSTOMER | Body chỉ nhận `serialNumber` (nullable, tùy chọn) và/hoặc `status` (`ACTIVE`/`ARCHIVED`); 200 thiết bị sau cập nhật, 404/422 |
| `GET /api/owned-devices/{id}/care-tasks` | CUSTOMER | 200 `{items: [...]}`; 404 nếu device không thuộc owner |
| `POST /api/care-tasks/{id}/complete` | CUSTOMER | Body `{}`; 200 chu kỳ vừa hoàn thành; gọi lặp không tạo chu kỳ sau trùng; 404 owner mismatch, 409 thiết bị lưu trữ/trạng thái xung đột |
| `POST /api/care-tasks/{id}/postpone` | CUSTOMER | Body `{"newDueDate":"2026-12-01","reason":"Chưa thể sắp xếp thời gian"}`; ngày mới phải ở tương lai, lý do 1–255 ký tự; 200 lịch đã cập nhật, 404/409/422 |
| `GET /api/admin/care-rules` | ADMIN | 200 `{items: [...]}` gồm scope, cadence, trạng thái, version và SKU vật tư |
| `POST /api/admin/care-rules` | ADMIN | Tạo quy tắc; 201 DTO quy tắc; 409 trùng `ruleKey` trong cùng scope; 422 dữ liệu sai |
| `PATCH /api/admin/care-rules/{id}` | ADMIN | Body đầy đủ như POST; 200 DTO cập nhật, 404/409/422. Đặt `status: INACTIVE` để ngừng áp dụng, không xóa cứng lịch sử |
| `GET /api/admin/care-supply-options?q=` | ADMIN | Tối đa 40 SKU catalog đang hoạt động, gồm giá hiện tại và tồn; 422 query sai |

Ví dụ một item thiết bị trong list:

```json
{
  "id": "81", "productId": "12", "variantId": "31", "productName": "Máy giặt mẫu",
  "sku": "WM-12-WH", "purchasedAt": "2026-10-20T08:00:00Z", "completedAt": "2026-10-28T03:15:00Z",
  "warrantyMonths": 24, "warrantyStartDate": null, "warrantyStartConfirmed": false,
  "status": "ACTIVE",
  "careTasks": [{"id":"91","cycleNumber":1,"title":"Vệ sinh lưới lọc","originalDueDate":"2026-11-27","dueDate":"2026-11-27","status":"DUE","supplies":[]}]
}
```

Khi đơn chuyển hợp lệ sang `COMPLETED`, service đơn hàng tạo **một `owned_devices` cho mỗi đơn vị số lượng** trong `order_items`, trong cùng transaction với cập nhật trạng thái. Khóa `(order_item_id, unit_number)` và `(owned_device_id, care_rule_id, cycle_number)` bảo vệ retry. Lấy `purchasedAt` từ `orders.placed_at`, `completedAt` từ thời điểm hoàn tất; snapshot tên/SKU/bảo hành từ `order_items`. Ngày bắt đầu bảo hành để `null` cho đến khi chính sách nhóm thống nhất, không tự cộng tháng từ ngày đặt. Không bắt buộc serial.

Tại thời điểm tạo thiết bị, chỉ quy tắc `ACTIVE` được đưa vào lịch. Quy tắc sản phẩm cùng `ruleKey` ghi đè quy tắc danh mục. Chu kỳ đầu đến hạn sau `firstDueDays` tính từ ngày hoàn tất; chu kỳ kế tiếp tính theo `intervalDays` hiện hành từ ngày khách đánh dấu hoàn thành. Sửa quy tắc không đổi due date của task đã tạo; chu kỳ kế tiếp dùng interval mới nếu rule còn `ACTIVE`. Tắt rule giữ lịch đã tạo, nhưng không sinh thêm chu kỳ sau khi khách hoàn thành task cuối. SKU vật tư liên kết là SKU catalog đang bán; trang đích hiển thị giá/tồn tại lúc truy vấn, không đảm bảo giữ tồn đến checkout.

## 6. Lỗi và giới hạn cần kiểm thử

| Tình huống | Kết quả |
|---|---|
| Người khác truy cập room/device/task ID | 404 |
| CUSTOMER sửa rule hoặc xem dashboard | 403 |
| Kích thước ≤0, đơn vị sai, quy tắc key không whitelist | 422 |
| Hai sản phẩm TCO khác danh mục | 422 |
| Product không tồn tại/không hoạt động | 404 |
| Quy tắc không có dữ liệu đầu vào | `NEEDS_CHECK` với `MISSING`, không lỗi 500 |
| TCO thiếu giá, thông số, giờ sử dụng hoặc giả định chi phí | component tương ứng và `total: null` với `missingInputs` |
| Completed event hoặc requestKey lặp | Không thêm device/task/event lần hai |

## 7. Ranh giới triển khai hiện tại

CRUD phòng và FitCheck evaluator chưa được triển khai. STT 24 cần migrations 012 và 016 đã review/áp dụng; code không tự chạy DDL. Quy tắc bảo hành bắt đầu ngày nào vẫn chờ nhóm thống nhất nên API không tự đặt ngày. Trước khi merge cần người khác review bridge/migration và xác nhận chu kỳ bảo trì với chủ catalog/nghiệp vụ.
