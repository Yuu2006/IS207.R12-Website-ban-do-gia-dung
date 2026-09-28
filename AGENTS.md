# AGENTS.md — IS207.R12 Website bán đồ gia dụng

## 1. Mục tiêu và cách áp dụng

Đặt file này tại thư mục gốc repository `Yuu2006/IS207.R12-Website-ban-do-gia-dung`, ngang hàng với `client/`, `server/`, `docs/` và `README.md`. Quy tắc áp dụng cho toàn bộ repository. Agent giao tiếp và giải thích bằng tiếng Việt; tên định danh trong code và commit dùng tiếng Anh.

Phát triển website thương mại điện tử bằng **ReactJS + Vite, PHP REST API và MySQL**, theo đặc tả MVP hoàn chỉnh người dùng cung cấp. Mỗi nhiệm vụ phải tạo ra thay đổi chạy được, có thể giải thích và kiểm chứng trong phạm vi đồ án.

Đây là bộ quy tắc biên soạn cho dự án, kế thừa quy ước Git, commit, phân lớp và tài liệu của repo mẫu; không phải file AGENTS.md nguyên bản từ repo mẫu.

## 2. Nguồn chuẩn và xử lý khác biệt

- Yêu cầu hiện tại của người dùng quyết định nhiệm vụ đang làm.
- Đặc tả `Dac_ta_chuc_nang_Website_Thuong_mai_dien_tu_Do_gia_dung_MVP_hoan_chinh.docx` là chuẩn phạm vi nghiệp vụ của bản này. Nếu nhóm đưa bản Markdown vào `docs/requirements/`, ghi rõ phiên bản và giữ đồng bộ với đặc tả.
- Dùng cấu trúc, dependency, cấu hình và Git workflow của repository đích. Repo mẫu chỉ cung cấp quy ước tham khảo, không thay thế stack hiện tại.
- Trước khi sửa, đọc `README.md`, `docs/guide/GIT-WORKFLOW.md`, tài liệu module và AGENTS.md gần file đang sửa nếu có. Không coi việc thư mục tồn tại là bằng chứng chức năng đã hoàn thành.
- Snapshot kiểm tra ngày 28/09/2026: repo đích `51075ec94f4c44311b8b1e00259fb2def85b49d9`; repo mẫu `3fdabe9c478528c832764989ea5756b627f682a3`. Luôn kiểm tra code thực tế khi bắt đầu nhiệm vụ mới.

### Các khác biệt đã giải quyết

| Nội dung | Quy tắc áp dụng cho dự án này |
| --- | --- |
| Repo mẫu dùng `dev`, repo đích dùng `develop` | Dùng `develop` để tích hợp; `main` là bản ổn định. |
| Repo mẫu có `feat/...`, repo đích có `feature/...` | Dùng `feature/<module>-<task>` và `fix/<name>` theo repo đích. |
| Repo mẫu dùng PHP pages và JavaScript thuần | Giữ React trong `client/src`, PHP chỉ cung cấp API cho ứng dụng này. |
| Repo đích còn mô tả repair, technician, supplier, RBAC động | Đây là phạm vi cũ, không triển khai trong MVP hiện tại. Không tự xóa code hoặc thư mục của đồng đội. |
| FUNCTION-MAPPING còn BOT-01..07 và module cũ | Đặc tả hiện tại có BOT-01..06; bổ sung HOME/FIT/TCO/LIFE/CARE khi làm module tương ứng. |
| Repo mẫu có cấu hình format mâu thuẫn về quote | Dùng formatter của repo đích nếu có; nếu chưa có, giữ style file hiện tại. Không format hàng loạt. |

## 3. Phạm vi sản phẩm

### P0 — Hoàn chỉnh luồng mua hàng

Tài khoản, hồ sơ, địa chỉ; danh mục, thương hiệu, sản phẩm, SKU và thông số động; tìm kiếm, lọc, wishlist, đánh giá; giỏ hàng, một voucher mỗi đơn, checkout, COD; đơn hàng, hủy, trả hàng và hoàn tiền mô phỏng; tồn kho cơ bản, quản trị, thông báo trong web, dashboard, CSV và audit log.

VNPay Sandbox thuộc phạm vi và tiêu chí nghiệm thu dù bảng ưu tiên chỉ nêu COD trong P0. Không bỏ qua VNPay khi đánh giá toàn bộ MVP hoàn thành.

### P1 — Chức năng khác biệt và hỗ trợ lựa chọn

- HOME-01: hồ sơ không gian sử dụng, không bắt buộc để mua hàng thông thường.
- FIT-01 / ADM-FIT-01: FitCheck Lite theo quy tắc cấu hình, có giải thích.
- TCO-01: chi phí sở hữu trong 1, 3 hoặc 5 năm.
- LIFE-01 / CARE-01 / ADM-CARE-01: Thiết bị của tôi và chu kỳ bảo trì.
- FIT-02: checklist giao lắp, ảnh tham khảo; không phân tích ảnh.
- BOT-01..06: chatbot theo ý định, bộ lọc, quy tắc và FAQ; so sánh 2–4 sản phẩm cùng danh mục.
- REV-03: đánh giá theo bối cảnh và cập nhật sau 30/90 ngày.

### Ngoài MVP

Không tự thêm sửa chữa, kỹ thuật viên, linh kiện sửa chữa, quản lý nhà cung cấp/phiếu nhập đầy đủ, RBAC động, AR/3D, chẩn đoán bằng ảnh/video, thu cũ đổi mới, mua sắm chung, tối ưu bộ thiết bị, OTP SMS hoặc hoàn tiền ngân hàng tự động. Email/SMS, nhắc việc tự động, vận chuyển tích hợp và báo cáo nâng cao là mở rộng. Không thêm LLM, vector database, Elasticsearch hoặc dịch vụ trả phí để giải quyết yêu cầu có thể làm bằng quy tắc và MySQL.

Bốn vai trò cố định: `CUSTOMER`, `ADMIN`, `SALES`, `WAREHOUSE`. Bảo hành và bảo trì trong hồ sơ thiết bị không đồng nghĩa với triển khai trung tâm sửa chữa. Không bắt buộc serial cho mọi SKU.

## 4. Quy trình làm việc của Agent

1. Kiểm tra branch, `git status`, file liên quan, package scripts và cấu hình thực tế. Bảo toàn thay đổi chưa commit của người dùng.
2. Xác định mã yêu cầu, vai trò, đầu vào, đầu ra và điều kiện nghiệm thu. Nêu ngắn gọn kế hoạch nếu thay đổi chạm nhiều tầng.
3. Tìm code/helper hiện có trước khi tạo mới. Triển khai phần nhỏ nhưng đầy đủ từ giao diện đến dữ liệu khi nhiệm vụ yêu cầu một chức năng hoàn chỉnh.
4. Không thay stack, nâng dependency hàng loạt hoặc tạo framework nội bộ ngoài nhu cầu nhiệm vụ. Không nhân tiện sửa module không liên quan.
5. Nếu yêu cầu nghiệp vụ thiếu nhưng có thể dùng lựa chọn cục bộ an toàn, nêu giả định và tiếp tục. Với quyết định ảnh hưởng tiền, quyền truy cập hoặc mất dữ liệu mà chưa có quy tắc, làm rõ trước khi áp dụng.
6. Kiểm chứng phần thay đổi, cập nhật tài liệu tương ứng và báo cáo kết quả thực tế. Phân biệt rõ đã chạy, chưa chạy và bị chặn bởi môi trường.

## 5. Kiến trúc và vị trí code

| Vị trí | Trách nhiệm |
| --- | --- |
| `client/src/pages/{customer,admin,sales,warehouse,auth}/` | Trang theo vai trò; ghép component và điều phối giao diện. |
| `client/src/components/` | Thành phần dùng lại theo domain; `common/` cho thành phần chung. |
| `client/src/layouts/`, `routes/` | Bố cục, router và route guard phía giao diện. |
| `client/src/services/` | HTTP client và hàm gọi API theo domain. |
| `client/src/hooks/`, `context/` | Hook tái sử dụng và trạng thái chia sẻ khi thật sự cần. |
| `client/src/utils/`, `assets/`, `styles.css` | Hàm thuần, tài nguyên và style hiện có. |
| `server/routes/` | Ánh xạ method/path và chuỗi middleware. |
| `server/controllers/` | Nhận request, gọi service, trả response; không chứa nghiệp vụ dài. |
| `server/services/` | Quy tắc nghiệp vụ, transaction, điều phối model. |
| `server/models/` | Truy vấn MySQL qua PDO, không xử lý HTTP hoặc render HTML. |
| `server/middleware/` | Xác thực, phân quyền, validation và kiểm tra liên quan. |
| `server/config/`, `utils/` | Cấu hình và helper dùng chung. |
| `server/db/migrations/`, `seeds/` | Thay đổi schema có thứ tự và dữ liệu demo. |
| `docs/`, `task/` | API, ERD, nghiệp vụ, hướng dẫn và tiến độ thực tế. |

Luồng chuẩn: React page/component → frontend service → route/middleware → controller → backend service → model/PDO → MySQL. Service có thể gọi nhiều model trong một transaction.

Không đặt SQL trong controller; không đặt nghiệp vụ tồn kho/thanh toán trong JSX. `App.jsx` chỉ giữ trách nhiệm lắp ghép ứng dụng. Chỉ tạo thêm thư mục domain khi có chức năng cần thực hiện, không sinh hàng loạt file rỗng.

## 6. Quy tắc frontend

- Dùng React function component, hooks và React Router đã khai báo trong package; không chuyển sang Next.js, TypeScript hoặc framework khác nếu chưa có yêu cầu.
- Component/page dùng PascalCase (`ProductCard.jsx`); hook bắt đầu bằng `use`; biến/hàm dùng camelCase. File service mới dùng dạng `product-service.js`, trừ khi module đã thống nhất cách khác.
- Tập trung cấu hình Axios/API base URL và xử lý lỗi trong lớp services. Không hardcode host/port vào từng component. Không đưa secret vào biến `VITE_*`.
- Quản lý form bằng state phù hợp, validation frontend để hỗ trợ người dùng; backend luôn kiểm tra lại. Không sửa DOM trực tiếp để thay thế state React.
- Phân biệt state cục bộ và chia sẻ; không thêm Redux hoặc thư viện state chỉ vì dự án có nhiều trang.
- Danh sách dùng key ổn định; tìm kiếm có debounce và xử lý phản hồi cũ. Có loading, empty, error, success và chống gửi lặp trên giao diện.
- Có label cho input, nút có tên rõ, điều hướng bàn phím và responsive trên điện thoại/máy tính. Duy trì thiết kế hiện có.
- Route guard và ẩn nút chỉ hỗ trợ UX; không coi đó là cơ chế bảo vệ API.
- Mock phải được ghi rõ và cô lập khỏi dữ liệu thật. Không hiển thị thành công giả khi API lỗi hoặc chưa được triển khai.

## 7. Quy tắc PHP, API và bảo mật

- Giữ PHP thuần và PDO hiện có. Tên file theo scaffold: `product-controller.php`, `product-service.php`, `product-model.php`, `product-routes.php`.
- Dùng prepared statements cho giá trị đầu vào; whitelist tên cột/sort direction vì placeholder không bảo vệ identifier SQL.
- Kiểm tra role và quyền sở hữu đối tượng trên backend. Không nhận user ID/role do client gửi làm căn cứ phân quyền.
- Băm mật khẩu bằng `password_hash`, xác minh bằng `password_verify`; không ghi mật khẩu, token hoặc secret vào log.
- Chọn một cơ chế session/token nhất quán với code thực tế, có hết hạn và đăng xuất vô hiệu hóa. Nếu dùng cookie xác thực, cấu hình HttpOnly/SameSite/Secure phù hợp và chống CSRF cho thao tác ghi.
- Response JSON dùng helper chung; nếu chưa có contract, định nghĩa và ghi tài liệu trước khi nối UI. Có `success`, `message`, `data` hoặc `errors` tùy trường hợp, không lộ exception/SQL/stack trace cho client.
- Dùng HTTP status đúng: 400/422 dữ liệu sai, 401 chưa xác thực, 403 thiếu quyền, 404 không tồn tại, 409 xung đột khi phù hợp. Không trả mọi lỗi dưới HTTP 200.
- CORS theo origin cấu hình; wildcard trong scaffold không phải chuẩn cho API dùng credential. Chỉ sửa khi nhiệm vụ chạm cấu hình/xác thực.
- Upload kiểm tra MIME thực, phần mở rộng, dung lượng/số lượng; sinh tên an toàn, chống path traversal và chặn thực thi trong thư mục upload.
- Không tin HTML đầu vào; tránh `dangerouslySetInnerHTML` với nội dung chưa được xử lý an toàn. Thêm rate limit cho endpoint xác thực khi triển khai module đó.

## 8. Bất biến nghiệp vụ bắt buộc

### SKU, giỏ hàng, đơn hàng và tồn kho

- SKU là đơn vị mua và quản lý tồn, có mã duy nhất. Cùng SKU trong giỏ phải gộp số lượng.
- Backend tính lại giá, voucher, phí giao hàng mô phỏng và tồn kho tại checkout; không tin tổng tiền từ frontend.
- Lưu snapshot tên, SKU, đơn giá, số lượng, giảm giá và địa chỉ tại thời điểm mua. Mua lại dùng giá/tồn hiện tại.
- Tách trạng thái đơn và thanh toán. Kiểm tra bước chuyển hợp lệ ở backend và lưu người xử lý, thời gian, lý do.
- Chốt và ghi tài liệu thời điểm giữ/trừ tồn của module trước khi triển khai; không trừ lại ở mỗi bước xác nhận/giao hàng. Dùng transaction cùng khóa hàng hoặc cập nhật có điều kiện để chống bán vượt tồn khi đồng thời.
- Hủy chỉ trước giai đoạn đang giao; chỉ hoàn lượng tồn đã giữ/trừ và chỉ một lần. Trả hàng chỉ hoàn kho khi thỏa điều kiện nghiệp vụ, không mặc định mọi hàng trả đều nhập lại bán được.
- Điều chỉnh tồn phải có lịch sử tồn trước/sau, lượng thay đổi, người thực hiện và lý do. Không cập nhật âm trong thao tác thông thường.
- Dữ liệu đã phát sinh giao dịch dùng soft delete hoặc trạng thái vô hiệu hóa.

### Voucher và thanh toán

- Một voucher cho toàn đơn. Kiểm tra thời hạn, đơn tối thiểu, mức giảm tối đa, tổng lượt và giới hạn theo khách ở backend; chống vượt lượt khi request đồng thời.
- COD chỉ đánh dấu đã thanh toán khi có xác nhận đã giao và thu tiền.
- VNPay chỉ dùng Sandbox trong MVP. Kiểm tra chữ ký, mã giao dịch, số tiền và kết quả từ luồng xác minh phía máy chủ theo tài liệu tích hợp; không tin query trên trang quay về làm bằng chứng thanh toán.
- Callback, hủy, hoàn kho và ghi nhận giao dịch phải idempotent, có khóa duy nhất/điều kiện cập nhật phù hợp trong transaction. Không tạo lần thanh toán hoặc hoàn tồn thứ hai khi nhận lại cùng sự kiện.
- Hoàn tiền MVP là ghi nhận mô phỏng, không gọi API hoàn tiền ngân hàng. Báo cáo loại trừ đơn hủy và phản ánh khoản hoàn theo định nghĩa doanh thu đã ghi tài liệu.

### FitCheck, TCO và chăm sóc thiết bị

- FitCheck trả đúng ba mức: Phù hợp / Cần kiểm tra thêm / Không phù hợp; giải thích điều kiện đạt/vi phạm. Thiếu dữ liệu không được tự kết luận phù hợp.
- Quy tắc FitCheck có toán tử, giá trị, đơn vị, mức cảnh báo, trạng thái và người/thời gian cập nhật. Không dùng `eval` để chạy quy tắc nhập từ quản trị.
- TCO = giá mua + điện + nước + vật tư + bảo trì trong kỳ. Chuẩn hóa W/kW, lít/m³ và thời gian trước khi tính; hiển thị giả định, công thức, dữ liệu thiếu. Không coi thông số thiếu là bằng 0 mà không giải thích.
- Chatbot chỉ đề xuất từ dữ liệu sản phẩm đang hoạt động, giải thích tiêu chí và đánh đổi. Không bịa thông số, tồn kho hoặc chính sách.
- Đơn hoàn thành tạo hồ sơ thiết bị và lịch bảo trì một cách idempotent; chuyển trạng thái lặp không tạo hồ sơ trùng. Serial tùy chọn.
- Chỉ người mua từ đơn hoàn thành được đánh giá. Quản trị viên được ẩn/khôi phục, không sửa nội dung khách. Điểm trung bình chỉ lấy đánh giá đang hiển thị.
- Hồ sơ phòng, thông báo, thiết bị và đánh giá theo bối cảnh phải bảo vệ quyền riêng tư và quyền sở hữu.

## 9. Database và dữ liệu demo

- Dùng MySQL, PDO và charset `utf8mb4`. Tiền dùng kiểu chính xác như DECIMAL hoặc số nguyên theo đơn vị tiền đã thống nhất; tránh float cho phép tính thanh toán.
- Tạo migration có thứ tự trong thư mục hiện có; không sửa migration đã được dùng chung để viết lại lịch sử. Ghi cách áp dụng và tác động dữ liệu.
- Tạo foreign key, unique constraint và index theo truy vấn; phân trang/lọc phía server cho danh sách lớn. Không thêm index vô tội vạ.
- Dữ liệu demo dùng thông tin giả và dữ liệu sản phẩm có nguồn hoặc nhãn mô phỏng; khuyến nghị 10–20 sản phẩm cho mỗi nhóm tủ lạnh, máy giặt, máy lạnh.
- Không tự chạy DROP/TRUNCATE, reset database chung, xóa Docker volume hoặc ghi đè dữ liệu thật. Không commit dump chứa thông tin nhạy cảm.

## 10. Code style và tài liệu

- Ưu tiên cấu hình formatter của repo đích. Khi chưa có, giữ style file đang sửa: scaffold JSX hiện dùng 2 spaces, PHP dùng 4 spaces. Không sao chép cấu hình repo mẫu gây đổi format toàn dự án.
- Nếu nhóm chọn đồng bộ Prettier với mẫu trong nhiệm vụ riêng: `printWidth: 120`, `useTabs: true`, `tabWidth: 4`, `semi: true`, `singleQuote: false`, `trailingComma: "all"`. Đây là cấu hình tham khảo, chưa được cài trong repo đích tại snapshot trên.
- Viết code dễ giải thích; tránh hàm quá nhiều trách nhiệm. Thêm mô tả ngắn phía trên hàm được tạo/sửa theo tinh thần quy tắc docs của mẫu; nêu mục đích, điều kiện hoặc tác dụng phụ thay vì diễn giải từng dòng.
- Khi thay đổi API, cập nhật `docs/api/`: endpoint, method, quyền, request, response, lỗi và ví dụ. Schema thay đổi thì cập nhật tài liệu database/ERD liên quan.
- Tài liệu module trình bày: đường dẫn source → mục đích → hàm/luồng chính → đầu vào/đầu ra → ví dụ → lỗi/giới hạn. Đây là cách áp dụng TEMPLATE của mẫu, không sao chép nội dung ví dụ Twitter.
- Khi cập nhật mapping/README, sửa đúng phần phạm vi đã lỗi thời. Cập nhật task theo mức thực sự hoàn thành; scaffold/mock không tính là chức năng hoàn chỉnh.

## 11. Git, commit và pull request

- `main` giữ ổn định, `develop` tích hợp. Tạo nhánh công việc theo workflow repo đích; không tự đổi thành `dev` hoặc thêm upstream trỏ repo mẫu.
- Kiểm tra remote/branch thật trước khi fetch hoặc tạo branch. Nếu `develop` chưa tồn tại, báo rõ và thống nhất nhánh nền khi cần; không tự đổi mục tiêu PR sang main.
- Không push trực tiếp main/develop; khi được giao đưa thay đổi lên GitHub, dùng branch và PR vào develop. Merge cần ít nhất một người khác review/approve theo quy tắc kế thừa từ mẫu.
- Không force-push nhánh chia sẻ, reset --hard hoặc hủy thay đổi của người khác. Không tự cấu hình bảo vệ branch, merge hay deploy chỉ vì đã viết code xong.
- Mỗi commit là một thay đổi logic. Commit tiếng Anh theo `type(scope): description`.

| Type | Dùng khi | Ví dụ |
| --- | --- | --- |
| feat | Thêm tính năng | `feat(cart): validate SKU quantity` |
| fix | Sửa lỗi | `fix(payment): ignore duplicate callbacks` |
| chore | Việc bảo trì phụ trợ | `chore(config): update environment example` |
| style | Điều chỉnh giao diện | `style(product): improve mobile spacing` |
| docs | Tài liệu | `docs(api): document checkout responses` |
| enhance | Tối ưu | `enhance(catalog): reduce duplicate queries` |
| refactor | Đổi cấu trúc, giữ hành vi | `refactor(order): extract inventory service` |

PR nêu vấn đề, thay đổi, mã yêu cầu, cách kiểm tra và migration/config cần dùng. Chỉ giữ mục có nội dung; không tạo phần Fix rỗng. Review từng PR và xử lý conflict trước khi merge; chuyển develop sang main là bước phát hành của nhóm.

## 12. Kiểm chứng và tiêu chí hoàn thành

Đọc `client/package.json` và môi trường trước khi chạy. Tại snapshot có `dev`, `build`, `preview`; chưa có script lint/test và chưa có test runner trong cây repo đích. Không báo lint/test đã pass nếu chưa tồn tại hoặc chưa chạy.

Lệnh frontend từ thư mục client:

```bash
npm install
npm run dev
npm run build
```

Chỉ cài dependency nếu môi trường chưa sẵn sàng; nếu sau này có package-lock hợp lệ, dùng `npm ci` cho cài đặt tái lập. Không tạo lockfile của package manager thứ hai. Đọc Compose trước khi dùng `docker compose up -d --build`. Kiểm tra cú pháp mỗi file PHP thay đổi bằng `php -l <path>` nếu PHP khả dụng.

Kiểm tra tập trung vào rủi ro phần đã sửa:

- UI: luồng chính, mobile, loading/empty/error, submit lặp.
- Auth/quyền: chưa đăng nhập, sai role, truy cập ID của người khác.
- Đơn/kho/voucher: hết hàng, mua đồng thời, dữ liệu giá bị giả, voucher quá hạn/vượt lượt, rollback khi một bước lỗi.
- Thanh toán: chữ ký sai, số tiền sai, callback lặp và thứ tự sự kiện khác nhau.
- FitCheck/TCO: thiếu dữ liệu, biên kích thước, đổi đơn vị và kết quả tính kiểm chứng được.
- Thiết bị/bảo trì: hoàn thành đơn lặp không sinh dữ liệu trùng.

Chọn test phù hợp với thay đổi, ưu tiên test hồi quy cho logic tiền, tồn kho, quyền và idempotency. Không dựng bộ test hình thức cho chỉnh sửa nhỏ. Nếu chưa có hạ tầng test, ghi kịch bản tái hiện và kết quả kiểm tra thật; thêm runner chỉ khi nhiệm vụ cần.

Trước khi bàn giao: kiểm tra diff, file ngoài phạm vi, secret và lỗi whitespace; cập nhật docs liên quan. Báo ngắn gọn thay đổi gì, kiểm chứng gì, phần nào chưa chạy và giới hạn còn lại. Build thành công không đồng nghĩa toàn bộ MVP đã hoàn thành.

## 13. Nguồn quy ước tham khảo

- Repo đích: https://github.com/Yuu2006/IS207.R12-Website-ban-do-gia-dung
- Workflow đích: `docs/guide/GIT-WORKFLOW.md`.
- Repo mẫu: https://github.com/versenilvis/IS207-UIT
- Quy tắc mẫu đã đọc: `docs/guide/commit.md`, `workflow.md`, `pull-request.md`, `docs.md`, `db.md`; `docs/code/folder-structure.md`, `TEMPLATE.md`; `.editorconfig`, `client/.prettierrc`.
- Không tìm thấy AGENTS.md trong cây main của hai repo tại thời điểm đối chiếu. Phần bảo mật, React và bất biến thương mại điện tử trong file này là quy tắc bổ sung cho stack và đặc tả của dự án, không gán là nguyên văn repo mẫu.
