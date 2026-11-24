# Tuần 4 — Hồi quy, tích hợp và bàn giao (STT 31–32)

## Phạm vi và kết quả cục bộ

Nhánh `feature/week4-regression-handoff`, nền `develop` tại `90247e5`. Phạm vi: chatbot/rule và specs thiếu, compare 2–4/TCO, đơn hoàn tất → thiết bị/bảo trì, hoàn thành/hoãn lịch, checklist **giao/lắp FIT-02** (đã chốt), dashboard/CSV, menu bốn vai trò và tài liệu chạy. Không dùng LLM, không thay stack.

| Phần | Thay đổi / bằng chứng |
| --- | --- |
| Compare/TCO | Hai trang dùng chung `TcoComparison.jsx` và API `/api/tco/calculate`; chọn SKU thật, chi phí chưa biết giữ null. Chặn phản hồi cũ khi sửa kịch bản. |
| TCO độc lập | Python Decimal đối chiếu cùng fixture với PHP cho 1/3/5 năm, W/kW, L/m³, kWh/năm. Sửa làm tròn năng lượng trung gian: chỉ làm tròn tiền cuối; ví dụ 1 W × 0,01 giờ × 52 × 3.000 ₫ = 1,56 ₫. |
| Chatbot/specs | Kiểm kiểu/đơn vị theo bảng chuẩn, đổi kW → W và m³ → L; sai unit giữ thiếu. Nói rõ công suất định mức chưa chứng minh tiết kiệm điện. Docker cài mbstring. |
| Thiết bị/bảo trì | Hoàn tất đơn/retry không tạo thiết bị/lịch trùng; hoàn thành lịch đồng thời chỉ sinh một chu kỳ sau. Ngày hoãn phải sau hạn hiện tại và ở tương lai. |
| FIT-02 | Lưu tiến độ theo khách/sản phẩm/phòng; version, history, replay; đếm mốc hoàn tất đầu tiên. Xem [contract](../api/INSTALLATION-CHECKLIST.md). |
| Dashboard/CSV | Đối chiếu NET_TOTAL; đếm FitCheck/TCO/hoàn bảo trì/lịch đang hoãn/checklist từ bảng và mốc cụ thể. Hiện nguồn/thiếu nguồn rõ. Tỷ lệ bảo trì chưa chốt vẫn null. |
| UI/RBAC | SSR kiểm menu bốn vai trò; HTTP kiểm quyền/CSRF; browser kiểm compare + TCO thiếu dữ liệu, lưu tiến độ checklist, dashboard và menu ADMIN trên viewport điện thoại. |

Kết quả kiểm thử cục bộ: frontend **83/83**, build đạt; oracle Decimal **4/4**; PHP TCO/rules/FitCheck/setup đạt; MySQL cô lập đạt 49 kiểm tra đơn/kho, TCO/care/payment/chatbot/dashboard, tuần 4 và các race hai process, gồm checklist cùng/khác key; HTTP demo chạy qua từ cookie/login tới checkout COD → completed → device/care → dashboard/CSV. Không suy ra nghiệm thu nhóm hoặc giao dịch ngân hàng thật từ các test này.

## Chạy demo an toàn trên Windows

Yêu cầu Node 22+, Docker Desktop (engine đang chạy); Python 3 để chạy phép đối chiếu Decimal. Chạy PowerShell tại **gốc checkout tuần 4**. Dùng `npm.cmd` nếu PowerShell chặn `npm.ps1`.

```powershell
npm.cmd ci --prefix client
docker compose -f compose.week4-demo.yml up -d --build
docker compose -f compose.week4-demo.yml exec -T api php db/setup.php migrate --database=homecare_week4_demo
docker compose -f compose.week4-demo.yml exec -T api php db/setup.php seed --database=homecare_week4_demo
$env:VITE_API_URL = 'http://localhost:18080'
$env:VITE_ORDER_API_MODE = 'http'
npm.cmd run dev --prefix client -- --host 127.0.0.1 --port 15173 --strictPort
```

Mở **http://localhost:15173**; API **http://localhost:18080**. Dùng cùng hostname `localhost` ở hai đầu để cookie SameSite hoạt động. Không Go Live `client/index.html`. Compose demo dùng volume/project/database riêng, DB không mở cổng host, API chỉ bind loopback; mật khẩu MySQL trong file chỉ dùng cho demo riêng. Không dùng file này khi triển khai public. Không đổi `.env` đồ án để trỏ nhầm DB demo hoặc ngược lại.

Nếu đã có database demo với dữ liệu, `setup.php` yêu cầu sao lưu và `--backup-confirmed` khi áp phần còn thiếu. Không thêm cờ một cách máy móc, không import lại baseline, không xóa volume. `setup.php status --database=homecare_week4_demo` để xem schema. Sau migrate, chạy seed một lần; seed có sản phẩm/thông số mô phỏng, không chứng minh specs model ngoài đời đã được xác minh.

Tài khoản giả và mật khẩu chung **Demo@1234567890!**:

| Role | Email | Nơi vào / luồng |
| --- | --- | --- |
| CUSTOMER | customer@example.test | `/login` → `/compare`, `/customer/decision-tools`, `/customer/devices`, `/orders` |
| ADMIN | admin@example.test | `/internal/login` → `/admin/reports`, `/admin/fit-rules`, `/admin/care-rules`, `/admin/chatbot-faqs` |
| SALES | sales@example.test | `/internal/login` → `/sales/orders`, `/sales/returns` |
| WAREHOUSE | warehouse@example.test | `/internal/login` → `/warehouse/inventory`, `/warehouse/returns` |

Đóng demo bằng `docker compose -f compose.week4-demo.yml stop`. Giữ volume để đối chiếu; không dùng `down -v`. Vite dừng bằng Ctrl+C. Đồ án chạy trên môi trường cũ xem [database](../../server/db/README.md) và [thanh toán](../api/PAYMENT-LEDGER.md); chỉ áp migration còn thiếu sau backup/review. Bước tuần 4 thêm **021_installation_checklists.sql** vào setup, không sửa migration cũ.

## Chạy bộ hồi quy

Mở terminal thứ hai ở gốc checkout:

```powershell
python scripts/check-tco-reference.py
npm.cmd test --prefix client
npm.cmd run build --prefix client
node server/tests/run-order-mysql-tests.mjs --docker
node scripts/test-week4-http.mjs
```

Hoặc `powershell -NoProfile -File .\scripts\test-week4.ps1 -HttpDemo`. Bỏ `-HttpDemo` nếu chưa dựng Compose demo. Runner MySQL tự tạo hai container riêng, không publish cổng, dùng DB/port ngẫu nhiên rồi chỉ xóa đúng tài nguyên thử nghiệm nó tạo. HTTP smoke **chỉ ghi khi API cổng 18080 có marker week4**, tạo khách/địa chỉ/phòng/đơn thử mới, không xóa giỏ seed; các đơn mô phỏng vẫn lưu để đối chiếu. Không chạy script này với URL hay tài khoản thật.

## Kịch bản demo 10–15 phút

1. Khách mở So sánh, chọn 2 rồi 4 sản phẩm cùng danh mục. Kiểm giá/bảo hành/review, thông số thiếu hiển thị dấu “—”. TCO chọn SKU, kỳ 1/3/5, giá điện/nước; bỏ trống vật tư/bảo trì phải ra “Chưa đủ dữ liệu”. Nhập 0 chỉ khi muốn giả định không phát sinh, mở công thức/giả định để giải thích.
2. Chatbot: “máy giặt dưới 20 triệu tiết kiệm điện”; mỗi thẻ có lý do/đánh đổi, câu hỏi mở, SKU/giá/tồn thật từ DB demo. Hỏi ngoài FAQ thì xin làm rõ, không bịa chính sách. Lưu ý W không phải kWh thực tế.
3. Khách vào Không gian & thiết bị. Chọn hồ sơ chưa đo → FitCheck Cần kiểm tra thêm. Chọn hồ sơ chật → Không phù hợp; hồ sơ đủ dữ liệu theo rule demo → Phù hợp. Mở checklist giao/lắp, lưu một phần, tải lại/chọn lại cùng ngữ cảnh; lịch sử và tiến độ phải còn. Hoàn tất rồi lưu lại không tăng số checklist hoàn tất lần đầu.
4. Khách tạo đơn COD trên giỏ/SKU thật. SALES lần lượt confirmed → preparing → shipping → delivered (xác nhận COD mô phỏng) → completed. Khách kiểm thiết bị theo từng chiếc và lịch bảo trì. Gửi lại cùng thao tác hoàn tất không có thiết bị/lịch thứ hai (bằng chứng tự động trong runner).
5. Khách hoãn một lịch sang sau hạn hiện tại, nhập lý do; hoàn thành rồi gọi lại không tạo hai lịch sau. Khách khác không xem/sửa thiết bị, phòng, checklist này.
6. ADMIN mở Báo cáo cùng kỳ: xem nguồn/mốc của FitCheck/TCO/care/checklist, đổi kỳ nhanh không giữ KPI kỳ trước, xuất CSV. `NET_TOTAL = sales.netRevenueVnd`; dữ liệu rỗng là 0 khi nguồn có thật, tỷ lệ không đủ mẫu hoặc chưa chốt là null/“—”. SALES/WAREHOUSE không gọi được dashboard/CSV ADMIN.
7. Thu màn hình điện thoại: so sánh/TCO chỉ cuộn ngang bên trong bảng; toàn trang không tràn ngang. Menu nhân viên mở/đóng được, đường dẫn đúng role. Ảnh cục bộ tại `docs/testing/screenshots/` chỉ là dữ liệu demo.

## Checklist nghiệm thu nhóm và giới hạn

- [x] TCO đối chiếu độc lập, null khác 0, đơn vị có kiểm tra và giải thích.
- [x] Lặp/đồng thời không tạo trùng order/device/care/checklist.
- [x] Checklist FIT-02 có lưu thật và nguồn đếm lần đầu; không nhầm checklist nhận hàng trả.
- [x] CSV và dashboard cùng nguồn doanh thu/kỳ; số đếm care dùng completed_at, lịch đang hoãn dùng status hiện tại + updated_at; nguồn KPI được công khai cho ADMIN.
- [x] UI desktop/viewport hẹp đã kiểm các màn liên quan; menu bốn role kiểm SSR và quyền API thực.
- [ ] TV2/TV3 ký chốt **tỷ lệ** bảo trì (mẫu số, task hoãn/hoàn thành muộn) và chính sách doanh thu/hoàn đang dùng. Chưa có xác nhận nên tỷ lệ vẫn UNAVAILABLE, không tính ngầm.
- [ ] Nhóm chạy lại trên môi trường bàn giao, xác nhận migration/seed, reviewed branch và tài khoản demo; không tự đánh dấu nghiệm thu thay nhóm.
- [ ] VNPay merchant Sandbox/IPN public thực tế; demo này không có khóa merchant, chưa có giao dịch Sandbox bên ngoài. COD/hoàn tiền trong demo chỉ là mô phỏng.

Giới hạn MVP còn ghi rõ: không LLM/phân tích ảnh, không SMS/email/nhắc lịch tự động; FIT-02 chưa có upload ảnh riêng; chưa có hóa đơn thuế; chưa hoàn tiền ngân hàng; PDF báo cáo chưa triển khai; tài khoản/địa chỉ/đơn và chi phí điện nước đều là dữ liệu demo/giả định. Build còn cảnh báo bundle >500 kB; không tự xem build đạt là hoàn thành toàn bộ MVP. Không có test trên điện thoại vật lý.
