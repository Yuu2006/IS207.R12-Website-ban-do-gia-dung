# Tutorial kiểm thử thủ công các task của Lê Tấn Vĩ

> Hướng dẫn thao tác trên môi trường phát triển local. Không dùng tài khoản, dữ liệu hoặc cổng thanh toán thật.

## 1. Phạm vi và trạng thái

Hướng dẫn này gom các phần của Vĩ được ghi nhận trong mapping và tài liệu hiện có trên branch `users/le-tan-vi`:

| STT | Phần cần kiểm tra | Trạng thái trước khi bắt đầu |
| --- | --- | --- |
| 13 | Checkout COD, tính phí và tạo đơn | Backend checkout có; kiểm thử trình duyệt còn phụ thuộc cart ghi được, mapping SKU và migration 013. |
| 14 | Lịch sử, chi tiết, timeline, hủy/mua lại và xử lý đơn | Luồng API/UI có; kiểm tra DB cần schema đơn hàng. Mua lại còn phụ thuộc cart ghi được. |
| 23 | TCO – Chi phí sở hữu | UI/API có; cần migration 012 và dữ liệu thông số catalog phù hợp. |
| 24 | Thiết bị của tôi, lịch bảo trì, cấu hình quy tắc và tra cứu catalog trong chatbot | UI/API có; cần migrations 012, 016 và quy tắc bảo trì. Tạo thiết bị cần đơn hoàn tất hợp lệ. |
| 29 | E2E checkout COD/VNPay | Backend có test cô lập; E2E thật cần cart/catalog tích hợp, migration 013/014, cấu hình VNPay Sandbox và IPN. |
| 30 | Yêu cầu trả hàng, phân loại, duyệt, kiểm nhận, hoàn tiền mô phỏng và CSV | Luồng đã triển khai; cần migration 015 và dữ liệu đơn đủ điều kiện để kiểm thử xuyên vai trò. |

Task 3 là nền tảng contract/order cho STT 13–14 và 29–30, nên được kiểm tra cùng các luồng này. Bảng trên mô tả tình trạng code, không có nghĩa các task đã được team nghiệm thu. Mã STT được đối chiếu từ tài liệu repo và thông tin Sheet đã có trong phiên trước; đối chiếu lại Sheet trước khi đổi trạng thái task.

## Kiểm toán checkout local — 2026-11-06

Đây là kết quả kiểm tra mã nguồn, test tự động và đọc database local theo chế độ chỉ đọc. Không tạo đơn mới và không thay đổi dữ liệu trong database. Trạng thái migration dưới đây chỉ áp dụng cho máy local tại thời điểm kiểm tra; không suy ra trạng thái database dùng chung.

- Database local có dấu hiệu của migration `008_order_runtime` và `013_checkout_runtime`; `ORDER_STORAGE_MODE=mysql`. Các cột/dấu hiệu này không thay thế việc xác nhận đầy đủ từng migration đã chạy.
- Có 30 sản phẩm active, 39 SKU active, 3 dòng giỏ hàng active và một tài khoản có địa chỉ mặc định. Các dòng giỏ được kiểm tra có SKU hợp lệ và đủ tồn.
- Không có voucher active, hợp lệ để thử. SKU active có giá hiệu dụng thấp nhất 9.090.000₫, nên chưa có dữ liệu để xác nhận nhánh phí giao hàng 30.000₫ dưới ngưỡng 500.000₫.
- Kiểm thử MySQL cô lập: **46/47 đạt**. Kiểm thử thêm SKU vào giỏ thất bại; runner dừng trước các kiểm tra race đa tiến trình, vì vậy các race đó chưa được chạy.
- `server/tests/order-api.test.php`: **21/22 đạt**; kiểm tra số lượng route khai báo không khớp route hiện tại.
- `node --test server/tests/order-api-http.test.mjs`: **9/9 đạt**.
- `npm test` trong `client`: **69/71 đạt**; còn lỗi kỳ vọng accessible label ở header và ví dụ response OpenAPI thiếu trường `availableQuantity`.
- Chưa thực hiện E2E trình duyệt cho một checkout mới trong lượt kiểm tra này. Vì lỗi cart integration và các kiểm tra lặp/race chưa hoàn tất, STT 13/14/29 chưa đủ bằng chứng để đánh dấu hoàn thành.

Kết luận hiện tại: giữ các task checkout/E2E ở trạng thái **Đang làm**. Trước khi nghiệm thu, sửa các lỗi test nêu trên, chạy lại kiểm tra cạnh tranh SKU/idempotency, rồi thao tác checkout COD trên giao diện và đối chiếu đơn/timeline/kho. VNPay cần được xác nhận riêng với Sandbox và callback.

## 2. Chuẩn bị môi trường an toàn

### 2.1 Dùng database phát triển riêng

1. Chỉ kiểm thử trên `homecare_local` hoặc một database dev riêng mà ông kiểm soát. Không chạy trên database dùng chung/production.
2. Trước khi thêm migration, kiểm tra các bảng/cột tương ứng đã tồn tại chưa và backup database. Chỉ chạy migration còn thiếu, đúng thứ tự trong [`server/db/README.md`](../../server/db/README.md). Không import lại baseline vào database đang có dữ liệu; không DROP/TRUNCATE/reset.
3. Các task dưới đây cần những migration chính:
   - STT 13–14: baseline, `008_order_runtime.sql`, `013_checkout_runtime.sql`.
   - STT 23: `012_decision_tools.sql`.
   - STT 24: `012_decision_tools.sql`, sau đó `016_care_rule_supplies.sql`.
   - STT 29: thêm `014_vnpay_runtime.sql`.
   - STT 30: thêm `015_return_refund_reporting.sql`.
4. Áp dụng DDL bằng tài khoản quản trị MySQL trong Workbench. API dùng user ứng dụng có quyền CRUD; không lưu mật khẩu thật vào Git hoặc gửi trong chat.
5. `server/db/README.md` là nguồn hướng dẫn thứ tự và cấu hình Windows. Nếu chưa chắc một migration đã chạy chưa, dừng lại kiểm tra trước, không chạy lại theo kiểu thử.

Migration 012/016 và các migration checkout/VNPay/return được ghi nhận là chưa áp dụng vào DB local/chung trong tài liệu hiện tại. Hãy xác minh trạng thái DB của chính ông trước khi làm theo.

### 2.2 Khởi động API và frontend

Mở PowerShell tại `E:\DoAnWeb`:

```powershell
powershell -NoProfile -File .\scripts\start-api.ps1
```

Giữ cửa sổ API đang chạy. Mở PowerShell khác:

```powershell
Set-Location E:\DoAnWeb\client
npm run dev
```

Mở địa chỉ Vite mà terminal hiển thị, thường là `http://localhost:5173`. Kiểm tra API tại `http://localhost:8080/auth/me`; khi chưa đăng nhập, phản hồi bình thường có `user: null`. Nếu API không chạy hoặc database chưa sẵn sàng, sửa cấu hình theo README trước khi đánh giá giao diện.

Trong `.env` ở root, `ORDER_STORAGE_MODE=mysql` chỉ bật sau khi các schema checkout cần thiết đã được review và áp dụng. Khởi động lại API sau khi đổi `.env`. Việc đổi biến này không tự chạy migration.

### 2.3 Tài khoản và dữ liệu cần có

- CUSTOMER: đăng ký tài khoản local hoặc dùng tài khoản test chỉ dành cho dev.
- ADMIN, SALES, WAREHOUSE: dùng tài khoản có role tương ứng trong seed/test local. Không cấp role bằng cách sửa request từ trình duyệt.
- Dữ liệu catalog cần có sản phẩm đang hoạt động, SKU đang bán, giá, tồn kho và thông số phù hợp với task.
- Checkout cần CUSTOMER có địa chỉ nhận hàng và giỏ chứa SKU hợp lệ. Dữ liệu trong catalog không đồng nghĩa với việc thao tác “Thêm vào giỏ” đã nối API.
- Để tránh cookie của các role đè nhau, dùng cửa sổ ẩn danh/profile trình duyệt riêng cho từng role hoặc đăng xuất hoàn toàn trước khi đổi tài khoản.

**Giới hạn tích hợp hiện đã biết:** thao tác ghi giỏ và mapping từ UI catalog sang SKU cần được nối bởi các task liên quan. Nếu giỏ không có hàng dù catalog có sản phẩm, ghi nhận là chặn tích hợp; không tự sửa database hoặc gọi API giả để biến kết quả thành pass.

## 3. Kiểm thử STT 13 — Checkout COD

### Điều kiện

- CUSTOMER đã đăng nhập, có địa chỉ mặc định/hợp lệ.
- Có giỏ chứa SKU đang hoạt động và đủ tồn.
- Checkout chạy ở MySQL mode, migration 008 và 013 đã được áp dụng sau khi review.

### Các bước

1. Mở `/checkout`, kiểm tra các dòng hàng, số lượng, địa chỉ và tổng tiền.
2. Thử nhập voucher hợp lệ, voucher hết hạn/sai điều kiện (nếu có dữ liệu test). Tổng giảm phải được server tính lại.
3. Kiểm tra phí giao hàng: miễn phí từ **500.000₫**; dưới mức đó là **30.000₫**.
4. Chọn COD và đặt đơn một lần.
5. Mở `/orders`, vào đơn mới và kiểm tra mã đơn, snapshot tên/SKU/đơn giá/số lượng/địa chỉ, tổng tiền, phương thức COD, trạng thái ban đầu và timeline.
6. Kiểm tra COD ban đầu là **chưa thanh toán**. Chỉ khi nhân viên chuyển đơn từ đang giao sang đã giao và xác nhận đã thu COD thì mới thành đã thanh toán.
7. Thử bấm đặt hàng lặp lại hoặc refresh sau khi nhận kết quả. Không được tạo hai đơn cho cùng một yêu cầu/idempotency key.
8. Nếu có quyền xem lịch sử kho, đối chiếu một lần giữ/trừ tồn cho đơn. Các bước xác nhận/chuẩn bị/giao tiếp theo không được trừ thêm.

### Kết quả đạt

- Server tính lại giá, voucher, phí và tổng; không dùng số tiền do trình duyệt gửi làm chuẩn.
- Đơn COD mới ở trạng thái chưa thanh toán; lịch sử trạng thái có người xử lý và thời gian.
- Submit lặp không tạo đơn/giữ tồn/voucher lần hai.
- Hủy hợp lệ trước khi đơn đang giao thì hoàn lượng tồn đã giữ đúng một lần; hủy sau khi đang giao phải bị từ chối.

Nếu chưa thể đưa SKU vào giỏ qua giao diện, chỉ ghi nhận bước frontend E2E là **blocked bởi cart/catalog integration**. Backend có thể được kiểm tra bằng suite cô lập ở mục 9.

## 4. Kiểm thử STT 14 — Đơn hàng và xử lý nhân viên

### CUSTOMER

1. Đăng nhập customer A, mở `/orders`; lọc các tab trạng thái rồi mở chi tiết một đơn.
2. Kiểm tra timeline theo thứ tự thời gian, tổng tiền và các dòng hàng khớp snapshot của đơn.
3. Đăng nhập customer B ở profile riêng; thử mở URL chi tiết đơn của A. B không được xem dữ liệu cá nhân/đơn của A (trả 404 hoặc từ chối theo API contract).
4. Hủy một đơn còn ở giai đoạn được phép, nhập lý do. Kiểm tra timeline có sự kiện hủy và tồn chỉ được hoàn một lần. Thử hủy lại hoặc hủy đơn đã giao/đang giao: thao tác phải bị từ chối.
5. Thử “Mua lại” với đơn DELIVERED/COMPLETED/CANCELLED nếu giỏ và tích hợp đã sẵn sàng. Sản phẩm phải dùng giá/tồn hiện tại; SKU ngừng bán/hết hàng không được thêm như một dòng hàng mua được.

### SALES / ADMIN

1. Đăng nhập SALES hoặc ADMIN, mở `/sales/orders`.
2. Lọc/tìm đơn, mở chi tiết, kiểm tra thông tin khách và timeline theo quyền được cấp.
3. Chỉ chọn bước chuyển trạng thái mà UI/API cho phép. Ghi lý do khi được yêu cầu; với COD, xác nhận đã thu tiền khi đánh dấu đã giao.
4. Tải lại trang và xác nhận trạng thái/timeline được lưu trong DB, không chỉ đổi màu ở giao diện.
5. Thử thao tác sai thứ tự hoặc gửi cập nhật từ dữ liệu phiên bản cũ; API phải từ chối xung đột (thường HTTP 409), không ghi thêm lịch sử/kho/thanh toán.
6. Đăng nhập bằng CUSTOMER rồi mở `/sales/orders`; backend phải từ chối quyền, kể cả khi gõ URL trực tiếp.

### Kết quả đạt

- Khách chỉ xem đơn của chính mình; role guard phía server chặn truy cập trái phép.
- Trạng thái chỉ chuyển theo state transition hợp lệ; có actor/thời gian/lý do phù hợp.
- COD chỉ ghi PAID cùng lần giao thành công có xác nhận thu tiền.
- Tồn, thanh toán và lịch sử không bị cập nhật lặp khi request retry.

## 5. Kiểm thử STT 23 — TCO (Chi phí sở hữu)

1. Đăng nhập CUSTOMER, mở `/customer/decision-tools` và chọn phần “Chi phí sở hữu”.
2. Chọn 2–4 sản phẩm cùng danh mục có giá và thông số năng lượng/nước trong catalog.
3. Chạy lần lượt thời hạn 1, 3 và 5 năm; nhập số lần/thời lượng sử dụng cùng đơn giá điện/nước nếu biểu mẫu yêu cầu.
4. Điền chi phí vật tư/bảo trì năm cho sản phẩm có dữ liệu. Thử để trống một trường rồi thử nhập `0`:
   - Để trống nghĩa là chưa có dữ liệu và kết quả cần nêu trường còn thiếu.
   - `0` là giá trị đã xác nhận bằng 0.
5. Tính TCO và kiểm tra các khoản giá mua, điện, nước, vật tư, bảo trì và tổng theo từng sản phẩm. Đối chiếu công thức `giá mua + điện + nước + vật tư + bảo trì` trong cùng kỳ.
6. Thử chọn sản phẩm khác danh mục, kỳ ngoài 1/3/5, số giờ/lần dùng vượt giới hạn hoặc dữ liệu không hợp lệ. Giao diện phải báo lỗi rõ; không tự coi dữ liệu thiếu là 0 hay đưa ra kết luận bịa.
7. Thử tính lại cùng đầu vào và kiểm tra UI không nhân đôi kết quả. Tính idempotency/event ledger được bao phủ thêm bằng test service ở mục 9.

### Kết quả đạt

- Chỉ so sánh sản phẩm cùng danh mục; kỳ hợp lệ là 1, 3 hoặc 5 năm.
- Số tiền được tính chính xác, làm tròn theo contract; kết quả hiển thị giả định và dữ liệu thiếu.
- API không biến thông số thiếu thành số 0 mà không giải thích.

Nếu API trả lỗi dịch vụ chưa sẵn sàng, kiểm tra migration 012, `decision_events` và cấu hình DB; đây chưa phải lỗi của phép tính trên giao diện.

## 6. Kiểm thử STT 24 — Thiết bị của tôi và bảo trì

### Cấu hình quy tắc (ADMIN)

1. Xác nhận migrations 012 và 016 đã được review/áp dụng.
2. Đăng nhập ADMIN, mở `/admin/care-rules`.
3. Tạo quy tắc cho một danh mục hoặc sản phẩm đang hoạt động: `ruleKey`, tên, chu kỳ đầu, chu kỳ lặp, trạng thái và SKU vật tư đang bán nếu có.
4. Lưu rồi tải lại trang; quy tắc phải còn nguyên. Tạo trùng `ruleKey` cùng scope hoặc nhập ngày/chu kỳ sai phải bị từ chối.
5. Thử tắt quy tắc. Lịch sử đã tạo phải giữ nguyên; quy tắc tắt không sinh chu kỳ mới.

### Tạo và chăm sóc thiết bị (CUSTOMER)

1. Chỉ dùng một đơn test có thể đi qua luồng hợp lệ và chuyển tới `COMPLETED`. Không sửa trực tiếp status trong SQL để tạo dữ liệu test.
2. Đăng nhập đúng CUSTOMER mua đơn, mở `/customer/devices`.
3. Xác nhận mỗi đơn vị sản phẩm tạo một hồ sơ thiết bị và các task tương ứng với quy tắc ACTIVE. Refresh hoặc gửi lại sự kiện hoàn tất: không được tạo thiết bị/task trùng.
4. Mở thiết bị, đánh dấu một task hoàn thành; ngày đến hạn của chu kỳ sau phải theo interval của quy tắc. Thử dời lịch nếu có, kiểm tra ghi nhận lịch mới.
5. Kiểm tra serial là tùy chọn. Ngày bắt đầu bảo hành có thể chưa có; hệ thống không được tự đoán ngày khi chính sách chưa chốt.
6. Đăng nhập customer khác và thử mở thiết bị của người đầu; thông tin phải bị chặn.

### Chatbot tra catalog

1. Mở chatbot, hỏi bằng tên/brand/SKU của sản phẩm đang bán.
2. Xác nhận kết quả lấy từ catalog hiện tại, hiển thị giá/tồn tại lúc truy vấn và liên kết mở đúng `/catalog/products/{id}` với SKU tương ứng.
3. Tìm sản phẩm/SKU không hoạt động hoặc không tồn tại; bot không được bịa giá, tồn hoặc thông số.

Phần chatbot hiện mới có tra cứu catalog theo dữ liệu thật; FAQ tổng quát, so sánh đầy đủ và rule engine chưa được triển khai. Không đánh dấu các phần đó là đã test xong của STT 24.

Nếu chưa có đơn hoàn tất hợp lệ, kiểm tra CRUD quy tắc và quyền sở hữu trước; phần tự tạo thiết bị được ghi là đang chờ bridge order completion/dữ liệu đủ điều kiện.

## 7. Kiểm thử STT 29 — Checkout COD/VNPay và tổng đơn

### COD

Thực hiện lại checkout COD ở mục 3, đồng thời đối chiếu tổng tiền phía server với báo giá trước khi đặt. Thử sửa giá/số lượng/tổng trong DevTools hoặc request của trình duyệt: backend phải tính lại từ SKU/giỏ/voucher/địa chỉ hiện tại và từ chối quote cũ hoặc không khớp.

### VNPay Sandbox

Chỉ thực hiện sau khi migration 014 được review/áp dụng và đã cấu hình **thông tin Sandbox** trong `.env` (TMN code, hash secret, return URL, IPN URL). IPN cần URL API công khai qua HTTPS để VNPay gọi được; không dùng secret production và không gửi secret trong chat.

1. Từ checkout, chọn VNPay. Server tạo giao dịch và URL Sandbox; kiểm tra tổng tiền khớp quote và order.
2. Hoàn tất hoặc hủy trong môi trường Sandbox. Trang return phải truy vấn trạng thái từ API server; query string quay về không tự chứng minh thanh toán thành công.
3. Xác nhận IPN hợp lệ mới đổi payment sang PAID. Sai chữ ký, sai số tiền hoặc mã giao dịch phải bị từ chối và không đổi đơn thành đã thanh toán.
4. Gửi lại cùng callback/event nếu môi trường Sandbox cho phép; chỉ được ghi nhận một lần.
5. Kiểm tra phiên chưa thanh toán hết hạn sau 15 phút: worker `php server/commands/expire-vnpay-payments.php` phải hủy/đánh dấu hết hạn và giải phóng tồn/voucher một lần. Chạy lịch worker mỗi phút theo hướng dẫn DB README.
6. Nếu callback thành công đến sau khi phiên hết hạn, hệ thống cần ghi nhận tình huống để đối soát thủ công; không tự hoàn tiền ngân hàng.

### Ma trận lỗi backend cần có

- Double submit cùng idempotency key → một đơn/giao dịch/hold.
- Hai checkout cạnh tranh SKU cuối → tối đa một checkout giữ được hàng; không tồn âm.
- Giá, voucher, phí hoặc fingerprint quote sai/cũ → bị từ chối.
- VNPay sai chữ ký/số tiền, callback lặp, COD chưa thu nhưng bị đánh dấu PAID → không ghi nhận thanh toán sai.

Phần ma trận này cần đối chiếu thêm suite tự động ở mục 9. E2E trình duyệt VNPay chỉ được coi là đạt sau khi cart/catalog integration, migration và IPN Sandbox hoạt động.

## 8. Kiểm thử STT 30 — Trả hàng, duyệt, nhận hàng và CSV

### Tạo yêu cầu (CUSTOMER)

1. Dùng đơn test đã `DELIVERED` hoặc `COMPLETED` và đã `PAID`.
2. Mở chi tiết đơn tại `/orders/{orderId}`, gửi yêu cầu trả hàng với nhóm vấn đề và mô tả/lý do rõ ràng.
3. Xác nhận yêu cầu ở trạng thái chờ phân loại. Việc gửi yêu cầu chưa tự hủy đơn, hoàn tiền, hoàn kho hay trả hàng về kho.
4. Gửi trùng yêu cầu cho cùng trường hợp; backend không được nhân đôi yêu cầu.

### Phân loại (SALES)

1. Đăng nhập SALES, mở `/sales/returns`, chọn yêu cầu và nhập mức độ cùng căn cứ.
2. Chọn `MINOR`: yêu cầu phải bị từ chối theo quy tắc hiện tại và không xuất hiện trong hàng chờ ADMIN.
3. Tạo yêu cầu test khác, chọn `MAJOR` hoặc `CRITICAL`, ghi lý do. Chỉ yêu cầu đủ nặng mới được chuyển tới ADMIN.

### Quyết định (ADMIN)

1. Đăng nhập ADMIN, mở hàng chờ trả hàng trong màn quản lý.
2. Duyệt một yêu cầu MAJOR/CRITICAL có căn cứ; xác nhận yêu cầu chuyển sang bước chờ WAREHOUSE.
3. Từ chối yêu cầu thứ hai và nhập lý do. Yêu cầu bị từ chối không thể tiếp tục kiểm nhận/hoàn tiền.
4. Thử duyệt yêu cầu MINOR hoặc quyết định lại cùng một yêu cầu; API phải từ chối hoặc giữ kết quả idempotent.

### Kiểm nhận và hoàn tiền mô phỏng (WAREHOUSE)

1. Đăng nhập WAREHOUSE, mở `/warehouse/returns`, chỉ chọn yêu cầu đã được ADMIN duyệt.
2. Đánh dấu đủ cả bốn mục: bao bì đã nhận (`packageReceived`), đúng đơn (`orderMatched`), đủ sản phẩm (`allItemsPresent`), đã đánh giá tình trạng (`conditionAssessed`). Nhập ghi chú kiểm nhận.
3. Thử lưu khi thiếu một checkbox hoặc thiếu ghi chú; không được ghi hoàn tiền.
4. Lưu đủ điều kiện. Hệ thống ghi **một khoản hoàn mô phỏng bằng toàn bộ tổng đơn** vào ledger, cập nhật trạng thái payment/order theo contract và kết thúc yêu cầu.
5. Gửi lại thao tác kiểm nhận; không được tạo khoản hoàn thứ hai.
6. Xác nhận đây không phải hoàn tiền ngân hàng và không tự nhập lại tồn kho.

### Báo cáo CSV (ADMIN)

1. Đăng nhập ADMIN, mở `/admin/reports`, xuất CSV cho khoảng ngày có giao dịch test.
2. Đối chiếu: SALE dương một lần khi đơn lần đầu `COMPLETED` và `PAID`; REFUND mô phỏng âm theo ngày ghi ledger; đơn hủy không tính là SALE; tổng NET_TOTAL bằng SALE cộng REFUND trong khoảng đã chọn.
3. Đăng nhập role khác rồi thử gọi/xuất CSV; API phải từ chối quyền.

Migration 015 là điều kiện để chạy quy trình trả/hoàn/CSV trên DB MySQL. “Hoàn thành” ở đây chỉ là sổ cái mô phỏng, không phải chuyển tiền thật.

## 9. Kiểm tra hồi quy tự động

Các lệnh này được ghi để ông tự chạy trên môi trường dev sau khi đã chuẩn bị cấu hình. **Mình chưa chạy chúng trong lúc tạo tutorial.**

Tại PowerShell:

```powershell
Set-Location E:\DoAnWeb\client
npm test
npm run build
Set-Location E:\DoAnWeb
php .\server\tests\order-api.test.php
node --test .\server\tests\order-api-http.test.mjs
php .\server\tests\tco-service.test.php
```

Các test MySQL nên chạy bằng runner cô lập trong [`server/db/README.md`](../../server/db/README.md):

```powershell
Set-Location E:\DoAnWeb
node .\server\tests\run-order-mysql-tests.mjs
```

Runner cần PHP có `pdo_mysql` và `mysqld`; đọc phần cấu hình runner trong README trước. Runner tạo database/datadir tạm riêng. Không thay lệnh này bằng cách chạy test trực tiếp vào `homecare_local`.

Khi test thất bại, lưu tên test, đầu ra lỗi, role, migration đã có và bước tái hiện. Không chụp/gửi `.env`, mật khẩu, hash secret hoặc cookie.

## 10. Ghi kết quả vào Sheet

Với mỗi STT, chỉ chọn **Hoàn thành** khi luồng tương ứng chạy được trên DB dev đã cấu hình, các kiểm tra quyền/lỗi/idempotency cần thiết pass, và dependency của thành viên khác đã tích hợp. Nếu chỉ code hoặc test cô lập pass nhưng chưa chạy E2E, giữ trạng thái **Đang làm** và ghi rõ chặn.

Mẫu ghi chú:

> Đã kiểm tra ngày YYYY-MM-DD trên local, role …; migrations …; luồng … đạt …/… bước. Còn chờ … (nếu có). Test tự động …; E2E ….

Phân biệt rõ:

- **Pass:** đã thao tác và đối chiếu được kết quả mong đợi.
- **Fail:** đã tái hiện lỗi; ghi bước, kết quả thực tế và lỗi API.
- **Blocked:** thiếu migration, tài khoản/role, dữ liệu test hoặc tích hợp cart/catalog/VNPay/order-completion.
- **Not tested:** chưa chạy; không suy ra pass từ việc trang mở được hoặc code đã có.

## 11. Xử lý lỗi thường gặp

| Hiện tượng | Kiểm tra trước |
| --- | --- |
| “Dịch vụ dữ liệu chưa sẵn sàng” / HTTP 503 | API đang chạy chưa; `.env`; `ORDER_STORAGE_MODE`; quyền MySQL; migration cần thiết. Đừng giả lập kết quả thành công. |
| `CSRF token` hoặc hết phiên | Dùng cùng host `localhost` cho Vite/API, refresh trang, đăng nhập lại và kiểm tra cookie/session. |
| Catalog có hàng nhưng giỏ rỗng | Cart write/catalog-to-SKU integration là dependency đã biết; kiểm tra trạng thái tích hợp, không tự chèn giỏ bằng SQL. |
| TCO không trả kết quả | Kiểm tra migration 012, `decision_events`, dữ liệu thông số và sản phẩm cùng danh mục. |
| Thiết bị chưa xuất hiện | Cần đơn hoàn tất hợp lệ, CARE rule ACTIVE, migration 012/016 và đúng tài khoản sở hữu. |
| API trả 403 | Dùng đúng role cho trang; route guard UI không thay thế role phía backend. |
| VNPay không tạo URL/callback | Kiểm tra migration 014, Sandbox credentials, IPN HTTPS công khai và worker hết hạn. Không dùng khóa thật. |
| Return/CSV lỗi schema | Kiểm tra migration 015 và quyền role; không chạy lại baseline để sửa. |

## Tài liệu tham chiếu trong repo

- [Database setup và migration order](../../server/db/README.md)
- [Task 3: checkout và đơn hàng](../plan/TASK-3-ORDER-UI.md)
- [Contract TCO, thiết bị và bảo trì](../api/DECISION-TOOLS.md)
- [Contract chatbot catalog](../api/CHATBOT-DESIGN-CONTRACT.md)
- [OpenAPI đơn hàng, checkout, VNPay và trả hàng](../api/order-checkout.openapi.json)
- [Function mapping](../requirements/FUNCTION-MAPPING.md)
## Kiểm thử storefront: thêm giỏ, mua ngay và so sánh cùng danh mục

1. Chạy API ở MySQL mode và frontend; đăng nhập bằng tài khoản `CUSTOMER` có địa chỉ nhận hàng.
2. Mở `/products`, vào trang chi tiết sản phẩm còn SKU đang hoạt động. Với sản phẩm có nhiều SKU, chọn biến thể và số lượng không vượt tồn hiển thị.
3. Bấm **Thêm vào giỏ**. Khi thành công, mở `/checkout` và xác nhận đúng SKU, tên biến thể, số lượng, giá hiện hành. Bấm thêm cùng SKU lần nữa để xác nhận số lượng được gộp.
4. Trở lại chi tiết, chọn một SKU còn hàng và bấm **Mua ngay**. Ứng dụng thêm SKU vào giỏ rồi chuyển tới checkout; checkout phải hiển thị cả các dòng đã có trong giỏ.
5. Bấm **So sánh với sản phẩm cùng loại**. Sản phẩm hiện tại được chọn trước; danh sách lựa chọn còn lại chỉ gồm sản phẩm cùng `category_id`. Chọn thêm một sản phẩm và xác nhận thông số lấy từ catalog.
6. Thử SKU hết hàng hoặc số lượng vượt tồn: API phải từ chối và giao diện hiện lỗi; không báo thêm thành công. Người chưa đăng nhập/sai vai trò không được ghi giỏ.
7. Trong Network, xác nhận POST `/cart/items` gửi `variantId`, `quantity`, `expectedCartVersion`, CSRF và `Idempotency-Key`; response trả `cartVersion` mới. Thêm giỏ không trừ tồn; tồn chỉ được xử lý ở checkout theo quy tắc của Task 3.
8. Thử retry cùng request sau lỗi mạng/5xx: cùng payload giữ nguyên idempotency key, không tạo thêm một lần cộng số lượng.
