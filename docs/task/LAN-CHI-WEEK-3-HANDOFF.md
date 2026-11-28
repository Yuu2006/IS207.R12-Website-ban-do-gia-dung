# Bàn giao review — Task Tuần 3 của Lan Chi (STT17, STT22)

## STT17 — Đánh giá và kiểm duyệt

Đã nối đánh giá với đơn hàng hoàn thành của đúng khách; hỗ trợ nội dung, 1–5 sao, ảnh và bộ lọc theo bối cảnh; REV-03 lưu riêng mốc 30/90 ngày, không ghi đè bài gốc; ADMIN chỉ ẩn/khôi phục kèm lý do/audit. Danh sách công khai không trả thông tin định danh và chỉ tính đánh giá đang hiển thị.

## STT22 — Trả hàng, hoàn tiền mô phỏng và FIT-02

- Khách chọn dòng/số lượng trả, đính kèm ảnh bằng chứng và theo dõi trạng thái; SALES phân loại MINOR/MAJOR/CRITICAL; ADMIN duyệt MAJOR/CRITICAL; WAREHOUSE kiểm checklist và số lượng còn bán lại.
- Kho chỉ nhập lại số lượng được đánh giá là bán lại được; tồn, `inventory_movements`, checklist, lịch sử và ledger mô phỏng nằm trong cùng transaction. CSV giữ các dòng SALE/REFUND/NET_TOTAL.
- Trên trang quản lý trả hàng, CSS đã bỏ BOM và được format; mobile tự cuộn tới chi tiết; lỗi 409 có nút **Tải lại yêu cầu**.
- FIT-02 lưu ảnh tham khảo tùy chọn, không phân tích ảnh. POST `save()` trả `history`, nên lịch sử không biến mất sau khi lưu.

## Kiểm chứng đã chạy

- `cd client && npm test` — 83/83. Đã đồng bộ OpenAPI examples và assertion client với contract trả hàng hiện tại (dòng hàng/ảnh và detail `returnItems`/`photos`).
- `node client/node_modules/vite/bin/vite.js build` — đạt; còn cảnh báo bundle JS lớn hơn 500 kB.
- `server/tests/order-api.test.php` — 23/23; `server/tests/review-service.test.php` — đạt validation/dispatch. Chạy trong PHP container kiểm thử với `ORDER_STORAGE_MODE=disabled` cho test API skeleton.
- `server/tests/run-order-mysql-tests.mjs --docker` — chạy trên MySQL/PHP cô lập; 49 kiểm tra đơn hàng/thanh toán/trả hàng, test race/idempotency, checklist 021/026, dashboard/CSV và kiểm thử MySQL mới cho review 30/90 ngày/ảnh/ẩn-khôi phục/audit đều qua.
- OpenAPI JSON parse và `git diff --check` — đạt.
- Không áp migration hay sửa dữ liệu DB dev/dùng chung. Migration 024/025/026 chỉ được áp trong các DB kiểm thử cô lập; container Browser E2E và volume kiểm thử riêng vẫn còn để phục vụ kiểm tra, không thuộc DB dev.

## Browser E2E đã chạy (2026-11-28)

- Dựng Vite + API + một MySQL Docker mới, cô lập khỏi MySQL cổng 3306, `homecare_local` và DB dev dùng chung. Áp schema/migrations của nhánh PR #24 và seed demo; không áp migration lên DB cá nhân/dev.
- Đo viewport CSS thực tế `1280×800` và `390×844`. Ở mobile, chọn yêu cầu khác tự cuộn tới phần chi tiết và trang không tràn ngang; ở desktop, trang quản lý trả hàng hiển thị danh sách và chi tiết cạnh nhau, không tràn ngang.
- Mobile: CUSTOMER gửi yêu cầu mức nhẹ, SALES phân loại MINOR và hệ thống từ chối; với yêu cầu khác, CUSTOMER gửi, SALES phân loại MAJOR, ADMIN duyệt, WAREHOUSE tích đủ checklist, ghi số lượng bán lại và hoàn tiền mô phỏng. Kết quả `refunded`, khoản hoàn 39.680.000₫, không gọi ngân hàng.
- Desktop: chạy lại luồng CUSTOMER → SALES MAJOR → ADMIN duyệt → WAREHOUSE nhận/kiểm → hoàn tiền mô phỏng trên đơn demo khác. Kết quả `refunded`, khoản hoàn 6.490.000₫, không gọi ngân hàng.
- FIT-02 trên mobile: lưu đủ 4/4 mục, nhận trạng thái hoàn tất lần đầu và phiên bản 1; mở “Lịch sử checklist (20 bản gần nhất)” thấy bản ghi 4/4. Sau đó `/admin/reports` hiển thị checklist hoàn tất lần đầu từ 0 lên 1.
- Tải CSV báo cáo thành công; file có header và các dòng `SALE`, `REFUND`, `NET_TOTAL`. CSV được kiểm tra sau luồng trả hàng mobile.
- Đối chiếu số liệu CSV kỳ 01–28/11/2026: 4 giao dịch `SALE` cộng 72.430.000₫, `REFUND` -39.680.000₫, `NET_TOTAL` 32.750.000₫; phép tính khớp. MySQL test xác nhận checklist nhận hàng thiếu trả 409 mà không đổi kho/ledger; khi đủ checklist chỉ nhập lại số lượng được đánh giá bán lại, ghi một `RETURN_RESTOCK`, một refund mô phỏng và replay cùng idempotency key không phát sinh lần hai.
- Kiểm tra xung đột từ hai tab: tab thứ hai gửi thao tác trên chi tiết cũ, nhận HTTP 409, hiển thị nút **Tải lại yêu cầu**; bấm nút thì trạng thái chi tiết cập nhật theo dữ liệu hiện tại.
- Các return E2E trên chỉ dùng DB và tài khoản demo. `RETURN_WINDOW_DAYS=14` được dùng cho đơn demo gần ngày; `60` chỉ dùng tạm trong container E2E để kiểm tra đơn demo cũ trên desktop. Đây là cấu hình test, không phải quyết định chính sách của nhóm. Container MySQL kiểm thử chưa có migrations 022/023 của STT18 nên E2E này không nghiệm thu tích hợp STT18.

## Browser E2E — STT17 (2026-11-28)

- Dựng frontend/API bằng nhánh PR #24 và một MySQL mới, cô lập trong Compose project `stt17-review-e2e`; migration 024 cùng seed demo được áp trên volume kiểm thử riêng. Không dùng `homecare_local` hoặc DB dev/dùng chung.
- CUSTOMER đăng nhập, mở sản phẩm có dòng hàng thuộc đơn `COMPLETED`, gửi đánh giá 5 sao. Trang sản phẩm hiện đánh giá mới và vẫn giữ liên kết với giao dịch đã hoàn tất.
- ADMIN mở `/admin/reviews`, thấy đánh giá mới ở đầu danh sách, ẩn bằng lý do hợp lệ rồi khôi phục bằng lý do riêng. UI báo thành công ở cả hai bước; sau khôi phục, đánh giá xuất hiện lại trên trang sản phẩm.
- E2E này kiểm chứng composer, danh sách kiểm duyệt và vòng đời ẩn/khôi phục trên browser. Ảnh, quyền riêng tư, eligibility, REV-03 và audit vẫn được bao phủ bởi service/MySQL tests ở trên.

## Cần xử lý trước khi nghiệm thu cuối

1. Nhóm chốt thời hạn nhận trả `RETURN_WINDOW_DAYS` (7/14/30 ngày) và quy tắc số tiền hoàn khi khách chỉ trả một phần hàng. Hiện code giữ quy tắc cũ hoàn toàn bộ tổng đơn, vì vậy không được coi một phần hàng/tiền hoàn đã nghiệm thu cho tới khi chốt và cập nhật rule tương ứng. `.env.example` để trống thời hạn; API từ chối tạo yêu cầu bằng 503 khi chưa cấu hình.
2. Ghép audit log/thông báo và cập nhật `owned_devices.status` từ nhánh STT18 sau khi nhánh đó merge; đồng bộ thứ tự migration 022/023 vào `server/db/setup.php` trước khi merge các migration 024–026.
3. Nhóm Trưởng review/merge code; sau review/backup mới áp migration 024–026 trên DB dev. Browser E2E giao diện đã chạy ở 1280×800 và 390×844 như ghi phía trên; DB dev/dùng chung chưa được cập nhật.
4. `careCompletionRate` trên reports vẫn chờ nhóm chốt mẫu số; đây là phụ thuộc riêng, không được tính là lỗi đã xử lý bởi STT17/22.
5. Thành viên khác cần kiểm tra chéo tiêu chí #5 và #9 trong tab `Test`; E2E và test cô lập có bằng chứng phía trên nhưng chưa có review chéo trên GitHub.
6. STT17 đã có browser E2E CUSTOMER gửi đánh giá → ADMIN ẩn/khôi phục → kiểm tra đánh giá hiển thị lại. Thành viên khác vẫn cần review chéo tiêu chí #5/#9; không thay thế review độc lập bằng E2E do người triển khai tự chạy.

Người làm trong bảng công việc vẫn là **Lan Chi**. Trạng thái đề nghị để bàn giao là **Chờ Nhóm Trưởng review/merge**, chưa đánh dấu hoàn tất nghiệm thu cuối.
