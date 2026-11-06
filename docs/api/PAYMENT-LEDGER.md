# Thanh toán và chứng từ bán hàng

## Luồng đã triển khai

React `/cart` → `/checkout` dùng giỏ/SKU/địa chỉ/giá/khuyến mãi thật từ MySQL. Runtime `ORDER_STORAGE_MODE=mysql` nối `CatalogCheckoutDependencies`; frontend mặc định HTTP. Mock chỉ khi Vite dev và bật rõ `VITE_ORDER_API_MODE=mock`; không có xác nhận tiền/QR/chứng từ giả trong mock.

- **COD:** tạo đơn `PENDING/UNPAID`, giữ tồn tại checkout. Chỉ giao hàng cùng xác nhận đã thu đủ tiền mới ghi `PAID`, thời điểm thu và audit người xử lý. Chuyển trạng thái giao không trừ kho lần hai.
- **BANK_TRANSFER:** tạo `PENDING/PENDING`, lưu snapshot tài khoản nhận từ cấu hình server. QR VietQR là hướng dẫn chuyển tiền, không phải bằng chứng thu tiền. SALES/ADMIN phải kiểm tra sao kê, nhập số tiền thực nhận, mã ngân hàng và ghi chú nguồn kiểm tra. Chỉ chấp nhận số tiền khớp toàn bộ đơn; sai tiền hoặc mã ngân hàng dùng lại bị từ chối. Chuyển khoản sau khi hủy được ghi nhận tiền vào nhưng đánh dấu `refundRequired`, không phục hồi đơn/tồn.
- **VNPAY:** chỉ Sandbox. Link ký HMAC SHA512, số tiền VND nhân 100, hiệu lực 15 phút. Chỉ IPN có checksum, merchant, mã tham chiếu và số tiền đúng mới cập nhật ledger. Trang return chỉ tra trạng thái của đơn thuộc khách, không dùng `vnp_ResponseCode` trên URL để xác nhận tiền. IPN lặp trả `02`, không thu thêm. Thành công đến sau hủy/hết hạn được lưu và đưa sang cần đối soát/hoàn tiền.

`server/scripts/expire-payments.php` là worker CLI: chạy mỗi phút bằng hạ tầng triển khai để hủy đơn VNPay vẫn chờ và hết hạn, giải phóng đúng reservation/voucher một lần. Worker và IPN khóa cùng order → payment, nên không đồng thời bán/hoàn cùng lượng hàng. Không tự hủy chuyển khoản thủ công: nhân viên phải đối soát khoản tiền có thể đến muộn trước khi quyết định xử lý.

## Bill khách và chứng từ nội bộ

- Bill khách có người bán, người mua/nhận, dòng hàng/SKU, đơn giá, số lượng, tiền hàng, giảm giá, giao hàng, tổng đã thu và phương thức/thời điểm thu.
- Chứng từ nội bộ dùng **cùng snapshot số tiền và hàng hóa**, thêm audit xử lý, actor và mã đối soát. Khách không được đọc chứng từ/audit nội bộ.
- Chỉ phát hành biên nhận sau khi ledger xác nhận thu tiền. Chưa thanh toán hiển thị yêu cầu chuyển khoản, không in “đã thu”. Bill đã thanh toán không còn QR yêu cầu chuyển lại tiền.
- Đơn đã hủy hoặc khoản thu cần đối soát không phát hành bill bán hàng mới; bill đã phát hành trước đó vẫn có thể in lại kèm trạng thái hiện tại, giữ snapshot gốc.
- Snapshot cửa hàng lấy tại checkout; hàng, giá và địa chỉ lấy từ snapshot đơn. Đổi catalog/cấu hình không làm bản in lại đổi số liệu. Hai mẫu dùng chung snapshot bán hàng, có mã riêng `BILL-...` / `INT-...`.
- React cho phép in/lưu PDF bằng trình duyệt. Đây là biên nhận bán hàng, **chưa tích hợp hóa đơn điện tử thuế hoặc gửi email tự động**. Trạng thái đối soát hiện tại nằm ngoài snapshot gốc để người xem biết khoản thu cần hoàn/kiểm tra.

## API

Tất cả endpoint bên dưới dùng envelope JSON chung. CUSTOMER chỉ xem đơn của mình (ID người khác → 404); SALES/ADMIN xem endpoint nhân viên. Các request ghi dùng cookie phiên, CSRF và `Idempotency-Key`; actor và vai trò lấy từ session.

| Method/path | Quyền | Dữ liệu / kết quả |
| --- | --- | --- |
| GET `/cart` | CUSTOMER | `{ cartVersion, items }` từ SKU còn bán, giá hiện hành |
| PUT `/cart` | CUSTOMER | `{ expectedCartVersion, items: [{ skuId, quantity }] }`; thay giỏ có version, không nhận giá |
| GET `/addresses` | CUSTOMER | Địa chỉ của phiên hiện tại |
| GET `/payments/methods` | CUSTOMER | Phương thức đã đủ cấu hình server |
| GET `/orders/{id}/payment` | CUSTOMER owner | Trạng thái, số tiền, reference; thông tin QR chỉ khi còn chờ |
| GET `/sales/orders/{id}/payment` | SALES/ADMIN | Như trên, thêm audit |
| POST `/sales/orders/{id}/payment/confirm-transfer` | SALES/ADMIN | `{ expectedVersion, amount, bankTransactionRef, reason }` |
| GET `/payments/reference/{reference}` | CUSTOMER owner | Tra trạng thái sau return, không cập nhật |
| GET `/orders/{id}/document` | CUSTOMER owner | Bill khách từ snapshot |
| GET `/sales/orders/{id}/document/customer` | SALES/ADMIN | Bill khách |
| GET `/sales/orders/{id}/document/internal` | SALES/ADMIN | Chứng từ nội bộ + audit |
| GET `/payments/vnpay/ipn` | Callback ký, không dùng phiên | Tham số `vnp_*`; trả `RspCode/Message` theo VNPay |

Lỗi: 401 chưa đăng nhập, 403 sai role/CSRF, 404 sai owner/ID, 409 version cũ/giao dịch đã xử lý/mã ngân hàng đã dùng/chưa thu tiền, 422 tiền không khớp hoặc input sai, 503 thiếu cấu hình/schema. Mã ngân hàng không phải secret nhưng không công khai cho khách trong audit. Không log hash secret hoặc dữ liệu đăng nhập ngân hàng.

Ví dụ xác nhận thủ công (chỉ sau khi nhân viên đã thấy tiền vào tài khoản nhận):

```json
{"expectedVersion":1,"amount":1250000,"bankTransactionRef":"BANK-TXN-EXAMPLE-01","reason":"Đã đối chiếu sao kê tài khoản nhận của cửa hàng."}
```

Response trạng thái: `{ orderId, orderCode, version, reference, method, status, amount, paidAt, refundRequired, bank }`. `bank` chỉ có lúc chờ chuyển khoản và gồm `{ bankBin, accountNo, accountName, content, qrUrl }`; nhân viên được thêm `audit`. `paidAt` của đối soát thủ công là thời điểm xác nhận; của VNPay là `vnp_PayDate` đã kiểm tra chữ ký và đổi sang UTC. Response chứng từ: `{ code, issuedAt, snapshot, type, currentPaymentStatus, refundRequired, electronicTaxInvoice: false }`; chỉ loại INTERNAL có `paymentAudit`. Snapshot gồm `merchant`, `orderCode`, `orderedAt`, `customer`, `items`, `totals`, `paymentMethod`, `paidAt`, `currency`.

## Thiết lập và migration

1. Trên DB đã review/backup, áp baseline + migration catalog/auth/order hiện có. Áp **một lần** `server/db/migrations/014_payment_ledger.sql` sau `008_order_runtime.sql`. 014 độc lập với 012/013 của FitCheck. Không import lại baseline, không xóa volume. Đơn cũ không có snapshot cửa hàng bị chặn phát hành bill mới cho đến khi được kiểm tra, không bịa snapshot lịch sử.
2. Trong `.env` server, đặt `ORDER_STORAGE_MODE=mysql`; `BANK_TRANSFER_BIN`, `BANK_TRANSFER_ACCOUNT_NO`, `BANK_TRANSFER_ACCOUNT_NAME` theo tài khoản cửa hàng đã duyệt; không đặt secret trong `VITE_*`.
3. `CHECKOUT_SHIPPING_VND` bắt buộc, là phí VND do nhóm chốt. `CHECKOUT_FREE_SHIPPING_MIN_VND` tùy chọn, xét subtotal trước giảm giá. Không có cấu hình phí thì checkout trả 503 thay vì tự đặt mức phí.
4. Đặt `STORE_NAME`, `STORE_ADDRESS`, `STORE_PHONE` đúng thông tin demo/cửa hàng. Đặt `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL` theo merchant Sandbox. Đăng ký IPN public tới backend `/payments/vnpay/ipn`; localhost không nhận callback từ cổng bên ngoài nếu chưa có địa chỉ truy cập được.
5. Tạo lại API container để nhận env: `docker compose up -d --build api`. Trong `client/.env.local`, đặt `VITE_ORDER_API_MODE=http`, `VITE_API_URL=http://localhost:8080`; khởi động lại Vite.
6. Nhân viên thử tại `/sales/orders`; khách chọn hàng thực ở `/cart`, tiếp tục `/checkout`. Giá/khuyến mãi/kho luôn được kiểm tra lại trong transaction tạo đơn. Chi tiết từng dòng, giảm giá, thanh toán và reservation commit cùng nhau.

Trang chủ/chi tiết storefront vẫn còn dữ liệu mock của module catalog. Nút mua chuyển sang `/cart` để khách chọn lại SKU từ API; không tự dùng ID mock để mua nhầm sản phẩm thật. Chuyển toàn bộ storefront sang catalog API là bước tích hợp của module sản phẩm.

## Nghiệp vụ đã sửa so với bản Java

Tách trạng thái đơn/tiền; QR không tự đánh dấu trả tiền; tài khoản nhận không hardcode vào report; lưu mã ngân hàng duy nhất, audit và idempotency; bill khách/nội bộ dùng chung số liệu; không cho đổi số liệu đã chốt qua form sửa hóa đơn; hủy không giả thành hoàn tiền; nhận tiền muộn không phục hồi đơn; tiền tính bằng integer VND; giữ/hoàn kho và voucher cùng transaction; bản in lại không phụ thuộc catalog hiện tại.

## Kiểm thử và giới hạn

`node server/tests/run-order-mysql-tests.mjs` với `PHP_BIN`, `PHP_EXTENSION_DIR`, `MYSQLD_BIN`: tạo datadir và port ngẫu nhiên riêng, áp 008/014, chạy test đơn/kho + bốn race hai process + test payment/bank/IPN/documents. Không dùng DB đồ án. `cd client; npm.cmd test; npm.cmd run build` kiểm tra FE.

Kiểm tra thủ công: tạo QR nhưng không chuyển tiền vẫn pending; sai số tiền không chuyển PAID; trùng mã ngân hàng không trả hai đơn; replay không thêm audit; khách khác không đọc bill; bill in lại sau đổi catalog không đổi; IPN checksum/số tiền sai không đổi trạng thái; hủy trước IPN thành công không hoàn kho lần hai; xác nhận COD chỉ tại giao hàng. Bản build/test chưa thay cho một giao dịch Sandbox thật với merchant đã cấp khóa.

Giới hạn: chưa chia nhiều lần trả tiền, chưa nhận thiếu/thừa tiền tự động, chưa hoàn tiền ngân hàng thật, chưa phát hành hóa đơn thuế/email; quyền xét duyệt trả hàng/hoàn tiền phải được chốt riêng. Completed vẫn cần bridge thiết bị/bảo trì của module tương ứng. Không gọi “lãi gộp” bằng doanh thu trừ tiền nhập kho trong kỳ; báo cáo doanh thu/hoàn cần dùng ledger và chính sách ghi nhận đã thống nhất với TV3.

Nguồn tích hợp: [VNPAY Sandbox 2.1.0](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [VietQR Quick Link](https://www.vietqr.io/).
