# Task 3 — Giao diện checkout và đơn hàng

Phạm vi: CHK-01, ORD-01/02/03/04, SAL-01/02/03; lựa chọn phương thức PAY-01/PAY-02. Đã dựng React, mock API development, HTTP service/contract và khung PHP route/controller/service chạy được. Chưa triển khai nghiệp vụ checkout/đơn hàng qua MySQL.

## Chạy và xem

Từ `client/`: `npm ci`, `npm run dev`. Các route: `/`, `/products`, `/products/:id`, `/login`, `/internal/login`, `/orders`, `/orders/:orderId`, `/checkout`, `/sales/orders`. Root giữ trang chủ; `/login` dùng luồng OTP hiện tại. Task 3 dùng font Be Vietnam Pro, teal #0F5F73, hover #0B4E60, nền #F7F8FA, text #1F2937/#667085, border #E5E7EB. Tab là text có underline; card 8px, button 6px; trạng thái dùng màu semantic. Không bổ sung sửa chữa dù ảnh tham khảo có nút yêu cầu sửa chữa.

UI hỗ trợ lọc trạng thái, chi tiết/timeline, mua lại, kiểm tra form checkout, nhập mã ưu đãi, hủy có lý do trước giao hàng, tra cứu đơn nhân viên và chuyển trạng thái trên giao diện. Dữ liệu trang được khởi tạo để trình bày đầy đủ các trạng thái; thao tác hiện tại chưa được lưu vào hệ thống.

## Điều chỉnh trang đơn hàng — 07/10/2026

- `client/src/pages/customer/OrderWorkspace.jsx`: dùng `components/Header.jsx` và `Footer.jsx` chung với trang chủ/sản phẩm của Lan Chi. `/orders` chỉ chứa đơn và tab trạng thái; không còn khung tab Thanh toán/Nhân viên hay banner thử nghiệm. `/checkout` truy cập qua biểu tượng giỏ hàng; `/sales/orders` là màn nhân viên riêng, không liên kết trong menu khách.
- `routes/CustomerRoute.jsx` + `context/CustomerAuthContext.jsx`: chờ xác nhận phiên trước khi render đơn; chưa đăng nhập chuyển `/login` và giữ đường dẫn để quay lại sau OTP. Lỗi xác nhận phiên có nút thử lại và không hiển thị dữ liệu. Header hỗ trợ đăng xuất và menu điện thoại.
- `services/order-ui-data.js`: mỗi fixture có `customerId`; mock service kiểm tra chủ sở hữu trước đọc/hủy, trả 404 cho đơn người khác giống đơn không tồn tại. HTTP mode lấy principal/owner từ backend, không lọc theo userId client để thay bảo vệ API. Animation tab, điều hướng bàn phím và reduced motion được giữ lại.
- Đơn mẫu chỉ được khởi tạo ở chế độ development dùng OTP UI (`isDemoAuth()`). Tài khoản kiểm tra có đơn: `nguyen.minh@example.com`; email khác có danh sách rỗng. Phiên UI lưu trong `sessionStorage` của tab, hết hạn sau một giờ và không được dùng trong production. Không có tài khoản/mật khẩu thật được tạo bằng cơ chế này.
- Production kiểm tra cookie qua contract `GET /auth/customer/session`, đăng xuất qua `POST /auth/customer/logout`. Những API này **chưa được backend triển khai**. Production tải đơn qua HTTP service, hiển thị loading/error khi API chưa sẵn sàng; không lấy empty state hoặc dữ liệu mẫu để thay API lỗi. Route guard không thay thế việc backend kiểm tra chủ đơn và vai trò.
- Route guard nhân viên frontend vẫn cần nối staff session của Tuấn Vũ. Khung PHP hiện kiểm tra session server/role cho endpoint đơn nhân viên; không coi việc tách đường dẫn UI hoặc principal giả trong test là đã có đăng nhập production.

### Test tự động và kiểm tra thủ công

Chạy tại `client/`: `npm run test:orders`, `npm run build`. Bộ test `tests/customer-orders.test.js` dùng Node test và render React SSR, không thêm dependency. Đã chạy: **11/11 test pass**, build pass, `git diff --check` pass. Test bao gồm phiên thiếu/sai role/hết hạn, URL quay lại an toàn, OTP sai/đúng/dùng lại, logout, lọc chủ đơn, chi tiết của người khác, tách route và không nhận phiên preview trong production. Phiên production được kiểm tra bằng HTTP response giả trong test, không phải API thật.

Chạy giao diện: `npm run dev`. Các bước nghiệm thu trên trình duyệt:

1. Mở `/orders` khi chưa đăng nhập: phải chuyển `/login`, không hiện đơn. Thử mở thẳng `/orders/HC2026100002` cũng phải yêu cầu đăng nhập.
2. Đăng nhập bằng `nguyen.minh@example.com`, nhận OTP và nhập mã hiển thị trong **development**. Bấm `Xem đơn hàng`: quay lại đường dẫn đã mở, thay vì về trang đăng nhập.
3. Danh sách có 4 đơn: chờ xác nhận 1, đang chuẩn bị 0, đang giao 1, đã giao 1, đã hủy 1. Chuyển trạng thái bằng chuột/phím mũi tên; kiểm tra animation và empty state.
4. Xem đơn đang giao: có trạng thái, sản phẩm, địa chỉ và timeline; mở mã không tồn tại không được thấy thông tin đơn khác. Trang không có tab Thanh toán/Nhân viên hay nút Thanh toán cạnh tiêu đề.
5. Reload: phiên UI còn hiệu lực vẫn nhận đúng tài khoản. Đăng xuất, vào lại `/orders`: phải yêu cầu đăng nhập.
6. Đăng nhập email khác: danh sách rỗng; mở `/orders/HC2026100002` hiện không tìm thấy, không hiện thông tin Nguyễn Minh.
7. Trên màn hình 320/375px, mở menu điện thoại để vào Đơn hàng/Đăng xuất; tab trạng thái cuộn ngang, card không tràn màn hình. Biểu tượng giỏ hàng mở checkout độc lập.

Chưa kiểm chứng trực tiếp animation/mobile/click chuyển route trên trình duyệt: Browser trong phiên làm việc không có kết nối. Kết quả SSR không được coi là thay thế kiểm tra trực quan hoặc end-to-end.

## Thiết kế dữ liệu đề xuất — chưa phải migration áp dụng

| Bảng | Trường và ràng buộc chính |
| --- | --- |
| orders | id, code UNIQUE, customer_id FK users, order_status, payment_status, payment_method, recipient_name/phone/address snapshot, subtotal/discount/shipping/total DECIMAL, voucher_code snapshot, note, created_at, updated_at, version |
| order_items | id, order_id FK orders, sku_id FK SKU Task 2, product_name/sku_code/variant snapshot, unit_price DECIMAL, quantity > 0, discount DECIMAL, warranty_months snapshot; UNIQUE(order_id, sku_id) |
| payments | id, order_id, attempt_reference UNIQUE, provider, amount DECIMAL, status, provider_transaction_id UNIQUE nullable, created_at, verified_at; nhiều lần thử, một kết quả thu tiền hợp lệ cho đơn |
| order_status_history | id, order_id, from_status, to_status, actor_id, actor_role, reason, created_at; chỉ thêm, không sửa lịch sử |
| inventory_movements | Task 2 sở hữu: sku_id, delta, before/after, order_id, event_key UNIQUE, actor_id, reason, created_at |

Trạng thái đơn: pending → confirmed → preparing → shipping → delivered → completed. Hủy chỉ từ pending/confirmed/preparing. Trạng thái thanh toán độc lập: unpaid/pending/paid/failed/refunded. Cần bổ sung quy trình trả hàng/hoàn tiền mô phỏng RET-01/02 trong giai đoạn backend; không coi task UI này hoàn thành toàn bộ Task 3 nghiệp vụ.

## Quyết định trạng thái/API/tồn kho — 07/10/2026

Người dùng đã chốt **giảm tồn khả dụng một lần khi tạo đơn, VNPay giữ 15 phút**. Task 2 chưa xác nhận tích hợp/schema; không áp dụng kho thật trong task này. Quyết định được ghi trước code checkout backend. Contract chia sẻ qua Git tại [OpenAPI checkout/đơn hàng](../api/order-checkout.openapi.json); mapping và quy tắc tích hợp nằm ngay trong tài liệu này, không tạo Markdown mới.

`client/src/utils/order-state.js` kiểm tra chuỗi bước, role/owner, version, lý do hủy và thanh toán; mock service dùng helper này. Component không tự đổi đơn bằng setOrders. COD chỉ ghi paid ở shipping → delivered khi xác nhận thu đủ tiền; VNPay chưa paid không được xác nhận/giao; đơn đã trả tiền bị hủy cần hoàn tiền riêng, không tự đổi refunded. Đây là frontend + mock API development, không có mutation MySQL.

22 test UI + state trước service layer đã pass. Bộ kiểm chứng service/contract và PHP skeleton được bổ sung bên dưới; không thay thế test transaction/concurrency MySQL. Đã nối endpoint PHP ở mức skeleton; chưa triển khai migration hoặc job hết hạn.

Các contract cần nhóm review/tích hợp: users/address/cart/voucher từ Task 1; SKU/price/stock từ Task 2; cách áp dụng thời hạn VNPay 15 phút đã chốt; phí giao hàng; hoàn tiền mô phỏng khi hủy đơn đã paid; schema và quyền truy cập. Mua lại phải dựng giỏ từ giá/tồn hiện tại trên backend.

## Tiêu chí kiểm tra khi tích hợp

Kiểm tra desktop/mobile, form sai/rỗng, lọc không có kết quả, đường dẫn đơn không tồn tại, chuyển trạng thái và hủy có lý do. Nghiệp vụ tồn kho, thanh toán, phân quyền và lưu trữ dữ liệu sẽ được kiểm tra khi triển khai backend.

Kiểm chứng lần tích hợp: `npm run build` và `git diff --check` đã chạy thành công.

## Tuần 1 — mục 6: frontend service layer và API contract

Nguồn phân công: [IS207.R12 - Task, tab Công việc](https://docs.google.com/spreadsheets/d/1CHakHVjI-oRh2QNu7mhIRaRb-q2cQBn4KugjZ_9hjGc/edit?gid=2034618477#gid=2034618477), đọc ngày 07/10/2026. Mục 5 và 6 giao Tấn Vĩ; tiêu chí mục 6 là frontend dùng service layer, contract có HTTP status, role và ví dụ request/response. Không chỉnh tiến độ trên Sheet. Các dòng tuần 2–4 chưa có tên ở cột người phụ trách; mapping dưới đây dựa trên ownership tuần 1, không tự gán trạng thái hoàn thành cho thành viên.

### Source → trách nhiệm → đầu vào/đầu ra

| Source | Trách nhiệm, đầu vào → đầu ra |
| --- | --- |
| `client/src/services/api-client.js` | API base URL, credential cookie, timeout/AbortSignal, CSRF, envelope → data hoặc ApiError(status/code/fields). Không fallback mock khi HTTP lỗi. |
| `client/src/services/order-service.js` | Endpoint order/customer/sales/checkout và đầu vào cart/address; whitelist request field; DTO camelCase → model hiển thị. URL dùng database ID, mã đơn chỉ hiển thị. |
| `client/src/services/order-mock-service.js` | Mock bất đồng bộ development, phiên khách/actor nhân viên giả được cô lập tại service; owner/version/transition, phân trang, replay idempotency → snapshot. Không sửa DB, không mô phỏng callback VNPay hay tồn thật. |
| `client/src/context/OrderServiceContext.jsx` | Chọn mock khi DEV + auth preview + `VITE_ORDER_API_MODE != http`; production luôn HTTP, kể cả env cố chọn mock. Không chứa fixture trong App.jsx. |
| `client/src/hooks/use-order-api.js` | Query loading/error/data/retry, AbortSignal và bỏ response cũ; mutation khóa gửi lặp, giữ key/body khi kết quả chưa xác định. |
| `OrderHistory.jsx` / `SalesOrders.jsx` / `Checkout.jsx` | Render state và gọi service; không fetch trực tiếp, không nhận role/userId từ form để cấp quyền, không tự tính voucher/phí checkout. |
| `docs/api/order-checkout.openapi.json` | OpenAPI 3.0.3 v1.2.0: schema, endpoint, role, cookie/CSRF, HTTP status, request/response example và lỗi; ghi rõ runtime skeleton và các dependency chưa tích hợp. |

Ví dụ gọi service: `service.cancelOrder('101', { expectedVersion: 1, reason: 'Thay đổi nhu cầu' }, { idempotencyKey: crypto.randomUUID() })`. Kết quả resolve mới cập nhật UI; reject giữ dữ liệu cũ và hiện lỗi. Tạo đơn timeout phải dùng lại **cùng key và cùng payload**, không sinh đơn mới hoặc cho sửa payload khi chưa xác định kết quả.

### Endpoint, quyền và status

Tất cả response thành công dùng `{success:true,message,data}`; lỗi dùng `{success:false,message,errors:{code,fields}}`. ID string, tiền integer VND, thời gian ISO timezone, orderStatus/paymentStatus lowercase; paymentMethod COD/VNPAY. PHP mapper chuyển từ tên cột/trạng thái uppercase hiện có, không âm thầm đổi schema chung.

| Endpoint | Role / ownership | Thành công | Lỗi chính |
| --- | --- | --- | --- |
| GET `/orders` | CUSTOMER, session owner | 200 OrderPage | 401/403/422/503 |
| GET `/orders/{orderId}` | CUSTOMER chủ đơn | 200 OrderDTO + history | 401/403/404/503 |
| POST `/orders/{orderId}/cancel` | CUSTOMER chủ đơn | 200 OrderDTO | 401/403/404/409/422/503 |
| POST `/orders/{orderId}/reorder` | CUSTOMER chủ đơn | 200 Cart | 401/403/404/409/422/503 |
| GET `/sales/orders` | SALES / ADMIN | 200 SalesOrderPage | 401/403/422/503 |
| GET `/sales/orders/{orderId}` | SALES / ADMIN | 200 OrderDTO | 401/403/404/503 |
| PATCH `/sales/orders/{orderId}/status` | SALES / ADMIN | 200 OrderDTO | 401/403/404/409/422/503 |
| POST `/checkout/quote` | CUSTOMER; giỏ/địa chỉ thuộc session | 200 Quote | 401/403/404/409/422/503 |
| POST `/checkout/orders` | CUSTOMER; giỏ/địa chỉ thuộc session | 201 CreateOrderResult; replay cùng status/body | 401/403/404/409/422/503 |
| GET `/cart` | CUSTOMER, session owner; Tuấn Vũ | 200 Cart | 401/403/503 |
| GET `/addresses` | CUSTOMER, session owner; Tuấn Vũ | 200 AddressList | 401/403/503 |

Mỗi operation OpenAPI có ví dụ response; POST/PATCH có ví dụ request. GET dùng ví dụ query/path, không gửi request body. 400 MALFORMED_JSON cũng áp dụng khi parse JSON thất bại. 401 yêu cầu đăng nhập; 403 sai quyền/CSRF; 404 dữ liệu thiếu hoặc không thuộc khách; 409 stale version/state/stock/idempotency; 422 validation; 503 không sẵn sàng. HTTP 200 thiếu data/success không được xem là thành công. 5xx không hiển thị stack/SQL từ server.

Guardrail PHP bổ sung: 405 METHOD_NOT_ALLOWED kèm Allow; 413 REQUEST_BODY_TOO_LARGE (JSON tối đa 16 KiB); 415 UNSUPPORTED_MEDIA_TYPE nếu không dùng application/json; 500 INTERNAL_ERROR cho lỗi không dự kiến, không lộ exception. ID database theo schema hiện có là chuỗi số dương, không dùng mã HC trong URL HTTP thật. Idempotency-Key dài 16–128 ký tự thuộc A–Z/a–z/0–9/._:-; frontend dùng UUID. Đây là validation header, chưa phải cơ chế replay lưu MySQL.

Phân trang `page>=1`, `pageSize=1..50`; sort created_at DESC, id DESC. Filter trước phân trang; tab Đang chuẩn bị gửi `confirmed,preparing`, Đã giao gửi `delivered,completed`. Customer list không trả phone/address; endpoint sales có customerName/customerPhone. Tìm kiếm sales tối đa 100 ký tự, debounce 300ms.

### Quy tắc chuyển trạng thái và giữ/hoàn tồn đã ghi trước checkout backend

`pending → confirmed → preparing → shipping → delivered → completed`; không đi lùi/nhảy bước/same-state. Chỉ pending/confirmed/preparing được cancelled. CUSTOMER chỉ hủy đơn của mình; SALES/ADMIN chuyển trạng thái; WAREHOUSE không chuyển trạng thái bán hàng. Actor server lấy từ session, không từ request. Hủy cần lý do trim 1–500 ký tự; ghi from/to/actor/time/reason và tăng version một lần. Đơn đã giao dùng luồng trả hàng riêng.

VNPay phải paid do server xác minh mới được tiến luồng. COD unpaid trước giao; shipping → delivered bắt buộc codCollected=true và ghi paid cùng transaction. Hủy đơn paid giữ paid và refundRequired=true, không tự đánh dấu refunded. Tiền hoàn là ghi nhận mô phỏng ở task RET riêng.

Quyết định tồn: khi transaction tạo đơn commit, giảm tồn khả dụng đúng một lần theo SKU. Các bước xác nhận/chuẩn bị/giao/hoàn thành không giảm lại. inventoryState reserved/released/consumed; hủy trước giao chỉ hoàn reservation đang reserved, một lần. Movement reserve/release có khóa UNIQUE theo order+SKU+loại sự kiện, cùng transaction với order/history/voucher/idempotency. Trả hàng chỉ nhập lại số lượng được WAREHOUSE duyệt bán lại, không tự cộng toàn bộ.

VNPay `paymentExpiresAt = createdAt + 15 phút`, do server tạo, retry link không gia hạn. Job server xác minh/reconcile trước khi nhả kho; lỗi mạng chưa rõ kết quả không được mặc định chưa trả tiền. Không gọi mạng trong transaction mở. Lock order/payment, đọc lại trạng thái sau đối soát để xử lý cạnh tranh IPN. Callback thành công muộn sau cancel: giữ cancelled, ghi paid + refundRequired/reconciliationRequired, không hồi sinh/trừ kho lại; failed muộn không hạ paid. Callback/timeout/hủy đều idempotent. IPN/return/retry/worker là task VNPay tuần 3, chưa có trong service mock tuần 1.

Thứ tự khóa thống nhất: idempotency → order → payment → cart → address → voucher/usage → SKU; bỏ qua loại không dùng, nhiều bản ghi cùng loại khóa ID tăng dần. Không có luồng đảo SKU → voucher/order. Lỗi bất kỳ bước rollback toàn bộ; deadlock retry giới hạn cùng key.

### Mapping cần thành viên xác nhận/cung cấp

| Người / ownership | Yêu cầu mapping cụ thể | Đầu ra / tiêu chí nhận |
| --- | --- | --- |
| **Tuấn Vũ — auth/role** | Xác nhận cookie session, GET `/auth/customer/session`, POST logout; response frontend cần success/sessionEstablished/user(id,role,fullName). PHP skeleton đọc `$_SESSION['user']={id,role,fullName}`, `expiresAt` Unix seconds integer và `csrfToken`. Owner phải cấp dữ liệu này hoặc thống nhất adapter; client không được tự gửi principal. Cấp cookie đọc được `XSRF-TOKEN`, nhận header `X-CSRF-Token`; token khớp csrfToken session. Thống nhất staff session cho SALES/ADMIN, guard route/UI và envelope auth. | Chưa login 401, sai role 403; CSRF sai 403; session hết hạn không dùng fixture. Cookie phiên HttpOnly/SameSite/Secure phù hợp. CORS dùng đúng CLIENT_URL, không wildcard. Hiện chưa có endpoint login/session/logout PHP. |
| **Tuấn Vũ — địa chỉ/giỏ/voucher** | GET `/addresses` → data.items[{id,recipientName,phone,addressLine,isDefault}]; GET `/cart` → data{cartVersion,items[{skuId,skuCode,productName,variantName,unitPrice,quantity,warrantyMonths,imageUrl}]}. Chốt cartVersion khi add/update/delete, quyền địa chỉ, voucher usage/giới hạn/nhả slot khi hủy. | ID string; gộp SKU; cartVersion integer>=1; chỉ dữ liệu session owner; addressLine chuẩn hóa để snapshot. Giá/voucher tính lại tại quote/create, không nhận tổng tiền client. |
| **Lan Chi — catalog/SKU/tồn** | Xác nhận API skuId = product_variants.id, skuCode unique; DB giá DECIMAL → VND integer; active/soft-delete và giá giảm hiện hành. Xác nhận stock_quantity là tồn khả dụng; sở hữu migration inventory_movements, UNIQUE reference reserve/release, before/after/delta/actor/reason. | Review bằng văn bản quyết định trừ khi tạo đơn, VNPay 15 phút; transaction/conditional update hoặc row lock không âm/không oversell; số lượng hủy hoàn đúng một lần. Không dùng product ID thay SKU ID. |
| **Đinh Tùng — thiết bị/bảo trì/báo cáo** | Chốt input sự kiện completed: eventKey/orderId/orderItemId/customerId/skuId/quantity/deliveredAt/warranty snapshot; tạo device/care theo order item idempotent. Thống nhất nguồn và định nghĩa doanh thu, đơn hủy và refund mô phỏng. | Xử lý lặp không tạo device/care trùng, bảo vệ owner; không tự gán serial. Dashboard không cộng cancelled như doanh thu, khoản refund có nguồn audit. Đây là mapping đề xuất, chờ owner review. |
| **Lê Tấn Vĩ — backend order/payment** | Khung 9 route/controller/service và guardrail đã nối. Bước tiếp theo sau mapping: repository/model MySQL, migrations version/history/snapshot/payment references/idempotency; fees được team duyệt; worker VNPay/IPN và RET đúng tuần phân công. | Service tương lai kiểm tra owner/state/version từ DB, transaction rollback, last-SKU concurrency, callback/replay không ghi kho/payment lần hai. Skeleton đang trả 503, không đánh dấu checkout hoặc payment thật hoàn thành. |

Chưa ai khác xác nhận các mapping này trong phiên làm việc. Không thể đánh dấu mục 5 đã thống nhất với Lan Chi chỉ vì Vĩ đã chọn thời điểm trừ tồn. Mapping tồn là điều kiện trước backend checkout; không cần chờ để nghiệm thu prototype service layer tuần 1.

### Chạy và kiểm chứng phần service layer

Tại `client/`: `npm run test:orders`, `npm run build`. DEV mặc định dùng mock khi auth preview đang bật. Để kiểm tra HTTP integration, đặt `VITE_ORDER_API_MODE=http`, `VITE_AUTH_DEMO=false` và `VITE_API_URL=<base của team>` trong env Vite local, rồi restart. Không commit .env. Production luôn dùng HTTP và không tự chuyển mock khi endpoint lỗi.

Test service/contract: HTTP status/error envelope, credentials/CSRF, timeout/abort, DTO id/code/tiền, payload không có actor/role/tổng tiền, phân trang/lọc, owner/role, transition/replay và COD mock. Mock không giữ tồn thật, không áp quota voucher thật, không có timeout worker hoặc thiết bị tự sinh. Mock VNPay trả 409 PAYMENT_NOT_AVAILABLE trước tạo đơn, không trả thành công giả.

Kết quả frontend ngày 07/10/2026: **41/41 test pass** (14 UI/session/provider/SSR + 11 state + 16 service/contract), `npm run build` pass, `git diff --check` pass. Production bundle không chứa fixture `preview:sales` / `SS-RT38-382`. Chưa kiểm chứng click/mobile/animation trực tiếp vì Browser không có kết nối; không coi HTTP 200/SSR là E2E. Không có Markdown mới. Mutation key giữ trong vòng đời component; phục hồi attempt qua reload/đổi máy cần hoàn thiện cùng backend ở tuần checkout/payment.

Kịch bản trình duyệt cần chạy: login preview bằng nguyen.minh@example.com → orders/loading/list → filter → detail/timeline → cancel có reason → sales xác nhận/chuẩn bị/giao COD và thu tiền → customer reload; checkout chọn địa chỉ/mã HOMECARE → quote → COD → detail/order mới. Email khác không được xem đơn Nguyễn Minh. DEV reload reset đơn/giỏ mock trong bộ nhớ, không gọi là lưu DB. API mode tắt backend phải hiện error/retry, không hiện empty hoặc thành công từ fixture.

## Hoàn thiện PHP skeleton — 07/10/2026

Luồng: `server/index.php` → `utils/order-api.php` → route + auth/role/CSRF/validation → `OrderController`/`CheckoutController` → interface/service tương ứng. Đã nối 9 operation của Vĩ: checkout quote/create, customer list/detail/timeline/cancel/reorder, SALES list/detail/status. `/cart`, `/addresses`, auth và VNPay IPN chưa đăng ký trong router này vì thuộc dependency hoặc task sau; không dựng stub thành công cho phần của thành viên khác.

| Source | Phần thực sự hoạt động |
| --- | --- |
| `server/index.php`, `utils/order-api.php` | Dispatcher HTTP, CORS theo CLIENT_URL, OPTIONS, cookie phiên đọc server, 404/405/500; không trả generic success cho mọi URL như scaffold cũ. |
| `middleware/{auth,role,validation}-middleware.php` | Phiên bắt buộc có ID/role và hạn server; role cố định; CSRF khớp session; JSON object/UTF-8, size/media type, ID/version, reason, filter/pagination/search, idempotency header và whitelist field. |
| `routes/{order,checkout}-routes.php` | 9 path/method/role/action/schema khớp OpenAPI. |
| `controllers/{order,checkout}-controller.php` | Gọi service với principal server + input chuẩn hóa + key; response envelope 200/201 khi service thực sự trả data. Không SQL/tính giá/giữ tồn trong controller. |
| `services/{order,checkout}-service.php` | Interface tích hợp repository/transaction; implementation hiện trả 503 SERVICE_UNAVAILABLE. Không đọc/ghi DB hoặc trả OrderDTO giả. |
| `server/tests/order-api.test.php` | 20 test CLI router/controller/middleware/interface; service/principal giả chỉ nằm trong test, không bật bằng env/header/query và không chạy qua HTTP. |
| `server/tests/order-api-http.test.mjs` | 8 test HTTP qua index.php thật, tự mở/dừng PHP server trên loopback/port tạm, không seed DB/user. |

Auth/role guard skeleton không đồng nghĩa auth production đã xong. Owner/transition/version/idempotency transaction sẽ được service kiểm tra từ DB khi triển khai tiếp; test double minh họa contract không chứng minh quyền sở hữu DB đã được bảo vệ. Service mặc định từ chối trước khi có dữ liệu nên không lộ đơn hoặc thay đổi tồn. Không thay schema/migration, không connect/reset MySQL và không gọi VNPay trong lần này.

Lệnh từ gốc repo khi PHP CLI có trong PATH:

```powershell
php server/tests/order-api.test.php
node --test server/tests/order-api-http.test.mjs
php -S 127.0.0.1:8080 -t server server/index.php
```

Nếu PHP ngoài PATH, set `PHP_BIN` cho Node HTTP test và dùng đường dẫn php.exe khi chạy CLI. CORS cần CLIENT_URL trùng origin frontend; ví dụ http://localhost:5173 khác http://127.0.0.1:5173. Mặc định request `/orders` chưa có cookie phiên hợp lệ trả 401; principal hợp lệ + payload đúng tới service trả 503. Không thêm tài khoản/endpoint fixture để lấy response thành công.

Kết quả skeleton: **20/20 PHP test, 8/8 HTTP test pass**, lint 13 file PHP pass (12 runtime + 1 test). CLI dùng PHP 8.3 tạm ngoài repo, không thay PATH/cài XAMPP hay bật Docker/MySQL. Docker daemon trong máy chưa chạy; chưa test Apache/.htaccess thực tế. Test HTTP dùng built-in server, không thay thế kiểm thử triển khai Apache.

Trạng thái bảng công việc: **mục 6 tuần 1 đạt phạm vi frontend mock/service + PHP skeleton + response contract**. Mục 5 vẫn chờ Lan Chi xác nhận thống nhất SKU/tồn và team duyệt mapping dữ liệu; không tick toàn bộ nghiệp vụ Task 3. Không tự sửa tiến độ Sheet hoặc merge thay team.

## Tổng hợp từ lần đồng bộ code mới về

1. Fast-forward nhánh cá nhân `users/le-tan-vi` tới code tích hợp `198ce85` từ origin/main; giữ trang chủ/catalog/login của team, cài dependency bằng npm ci và build kiểm tra. Không tự merge lên main/develop.
2. Trang đơn của khách dùng Header/Footer storefront chung; bỏ tab Thanh toán/Nhân viên khỏi `/orders`, tách checkout và SALES. Bổ sung menu mobile/tài khoản/logout và giữ animation tab.
3. Route đơn/checkout chờ phiên, chưa login chuyển `/login` rồi quay lại URL an toàn; kiểm tra phiên production qua API, fixture chỉ development. Đơn fixture gắn chủ, email khác không xem được đơn Nguyễn Minh; lỗi API không được cho qua bằng phiên mẫu.
4. Thêm helper state transition dùng chung trong mock: chuỗi hợp lệ, role/owner/version, reason hủy, COD paid đúng lúc, VNPay chưa paid không tiến luồng, lịch sử đầy đủ và không giả hoàn tiền.
5. Ghi quyết định trừ tồn một lần khi tạo đơn/VNPay 15 phút, giữ/hoàn một lần và mapping Tuấn Vũ/Lan Chi/Đinh Tùng. Dọn 2 Markdown mới khỏi phần push theo yêu cầu, giữ README/AGENTS/docs gốc; bản phục hồi local trong .git. Contract/mapping được gộp vào tài liệu này và OpenAPI JSON.
6. Nối UI với service layer + mock bất đồng bộ; HTTP client dùng cookie/CSRF/error status, DTO id/code và tiền, pagination/search/debounce/abort; mutation khóa gửi lặp và giữ key khi chưa rõ kết quả. Checkout lấy giỏ/địa chỉ/quote từ service, không tự áp phí/voucher trong JSX.
7. Bổ sung OpenAPI v1.2.0 và PHP route/controller/service skeleton có guardrail; 41 test frontend + 20 test PHP + 8 test HTTP, build/lint/diff check. Chưa triển khai lưu đơn/giữ kho/payment thật; không merge hoặc deploy.

## Bàn giao review trên nhánh cá nhân — 07/10/2026

Theo yêu cầu người dùng, thay đổi được đóng gói thành commit contract/mapping, frontend/service/test và PHP skeleton/test để gửi lên `users/le-tan-vi`. Không push trực tiếp `main`; remote hiện chưa có `develop`, nên không tự chọn `main` làm đích PR hoặc tạo nhánh tích hợp thay nhóm. Push nhánh cá nhân không đồng nghĩa review/merge hoặc nghiệm thu nghiệp vụ đã hoàn tất.

- Mục 5: đã có UI, state transition, contract và quyết định tồn được ghi trước checkout backend. Chờ Lan Chi xác nhận SKU/tồn và giữ–hoàn kho; Tuấn Vũ xác nhận schema/contract giỏ, địa chỉ, voucher; team duyệt mapping/ERD chung để nghiệm thu tuần 1.
- Mục 6: đạt phạm vi frontend service/mock + loading/error/empty, OpenAPI và 9 PHP endpoint skeleton; chờ team review/nghiệm thu. Nối auth/cart/address/voucher/SKU và triển khai MySQL/VNPay là bước tích hợp tiếp theo, không phải điều kiện để biến skeleton tuần 1 thành checkout production. Runtime storage hiện trả 503, không báo tạo đơn thành công giả.
- Kiểm chứng trước bàn giao: 41 test frontend, 20 test PHP, 8 test HTTP pass; lint 13 file PHP, build và diff check pass. Giữ nguyên dữ liệu/tiến độ/kiểm tra của thành viên khác khi cập nhật hai ghi chú cho Vĩ trên Sheet.
