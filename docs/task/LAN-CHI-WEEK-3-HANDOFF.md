# Bàn giao review — Task Tuần 3 của Lan Chi (STT17, STT22)

## STT17 — Đánh giá và kiểm duyệt

Đã nối đánh giá với đơn hàng hoàn thành của đúng khách; hỗ trợ nội dung, 1–5 sao, ảnh và bộ lọc theo bối cảnh; REV-03 lưu riêng mốc 30/90 ngày, không ghi đè bài gốc; ADMIN chỉ ẩn/khôi phục kèm lý do/audit. Danh sách công khai không trả thông tin định danh và chỉ tính đánh giá đang hiển thị.

## STT22 — Trả hàng, hoàn tiền mô phỏng và FIT-02

- Khách chọn dòng/số lượng trả, đính kèm ảnh bằng chứng và theo dõi trạng thái; SALES phân loại MINOR/MAJOR/CRITICAL; ADMIN duyệt MAJOR/CRITICAL; WAREHOUSE kiểm checklist và số lượng còn bán lại.
- Kho chỉ nhập lại số lượng được đánh giá là bán lại được; tồn, `inventory_movements`, checklist, lịch sử và ledger mô phỏng nằm trong cùng transaction. CSV giữ các dòng SALE/REFUND/NET_TOTAL.
- Trên trang quản lý trả hàng, CSS đã bỏ BOM và được format; mobile tự cuộn tới chi tiết; lỗi 409 có nút **Tải lại yêu cầu**.
- FIT-02 lưu ảnh tham khảo tùy chọn, không phân tích ảnh. POST `save()` trả `history`, nên lịch sử không biến mất sau khi lưu.

## Kiểm chứng đã chạy

- `node client/node_modules/vite/bin/vite.js build` — đạt; còn cảnh báo bundle JS lớn hơn 500 kB.
- `server/tests/order-api.test.php` — 23/23.
- `server/tests/review-service.test.php` — đạt kiểm tra validation/dispatch.
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
- Các return E2E trên chỉ dùng DB và tài khoản demo. `RETURN_WINDOW_DAYS=14` được dùng cho đơn demo gần ngày; `60` chỉ dùng tạm trong container E2E để kiểm tra đơn demo cũ trên desktop. Đây là cấu hình test, không phải quyết định chính sách của nhóm. Container MySQL kiểm thử chưa có migrations 022/023 của STT18 nên E2E này không nghiệm thu tích hợp STT18.

## Cần xử lý trước khi nghiệm thu cuối

1. Nhóm chốt thời hạn nhận trả `RETURN_WINDOW_DAYS` (7/14/30 ngày) và quy tắc số tiền hoàn khi khách chỉ trả một phần hàng. Hiện code giữ quy tắc cũ hoàn toàn bộ tổng đơn, vì vậy không được coi một phần hàng/tiền hoàn đã nghiệm thu cho tới khi chốt và cập nhật rule tương ứng. `.env.example` để trống thời hạn; API từ chối tạo yêu cầu bằng 503 khi chưa cấu hình.
2. Ghép audit log/thông báo và cập nhật `owned_devices.status` từ nhánh STT18 sau khi nhánh đó merge; đồng bộ thứ tự migration 022/023 vào `server/db/setup.php` trước khi merge các migration 024–026.
3. Nhóm Trưởng review/merge code; sau review/backup mới áp migration 024–026 trên DB dev. Browser E2E giao diện đã chạy ở 1280×800 và 390×844 như ghi phía trên; DB dev/dùng chung chưa được cập nhật.
4. `careCompletionRate` trên reports vẫn chờ nhóm chốt mẫu số; đây là phụ thuộc riêng, không được tính là lỗi đã xử lý bởi STT17/22.

Người làm trong bảng công việc vẫn là **Lan Chi**. Trạng thái đề nghị để bàn giao là **Chờ Nhóm Trưởng review/merge**, chưa đánh dấu hoàn tất nghiệm thu cuối.
