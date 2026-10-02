# Task 3 — Giao diện checkout và đơn hàng

Phạm vi giao diện: CHK-01, ORD-01/02/03/04, SAL-01/02/03; lựa chọn phương thức PAY-01/PAY-02. Task hiện tại chỉ dựng giao diện React và tương tác state phía frontend; không triển khai backend/API.

## Chạy và xem

Từ `client/`: `npm ci`, `npm run dev`. Các route: `/orders`, `/orders/:orderId`, `/checkout`, `/sales/orders`, `/login`. Root hiển thị đơn hàng. `/login` giữ giao diện từ commit `c233d29` của `UI/Login-form`; Task 3 dùng font Be Vietnam Pro, teal #0F5F73, hover #0B4E60, nền #F7F8FA, text #1F2937/#667085, border #E5E7EB. Tab là text có underline; card 8px, button 6px; trạng thái dùng màu semantic. Không bổ sung sửa chữa dù ảnh tham khảo có nút yêu cầu sửa chữa.

UI hỗ trợ lọc trạng thái, chi tiết/timeline, mua lại, kiểm tra form checkout, nhập mã ưu đãi, hủy có lý do trước giao hàng, tra cứu đơn nhân viên và chuyển trạng thái trên giao diện. Dữ liệu trang được khởi tạo để trình bày đầy đủ các trạng thái; thao tác hiện tại chưa được lưu vào hệ thống.

## Thiết kế dữ liệu đề xuất — chưa phải migration áp dụng

| Bảng | Trường và ràng buộc chính |
| --- | --- |
| orders | id, code UNIQUE, customer_id FK users, order_status, payment_status, payment_method, recipient_name/phone/address snapshot, subtotal/discount/shipping/total DECIMAL, voucher_code snapshot, note, created_at, updated_at, version |
| order_items | id, order_id FK orders, sku_id FK SKU Task 2, product_name/sku_code/variant snapshot, unit_price DECIMAL, quantity > 0, discount DECIMAL, warranty_months snapshot; UNIQUE(order_id, sku_id) |
| payments | id, order_id, attempt_reference UNIQUE, provider, amount DECIMAL, status, provider_transaction_id UNIQUE nullable, created_at, verified_at; nhiều lần thử, một kết quả thu tiền hợp lệ cho đơn |
| order_status_history | id, order_id, from_status, to_status, actor_id, actor_role, reason, created_at; chỉ thêm, không sửa lịch sử |
| inventory_movements | Task 2 sở hữu: sku_id, delta, before/after, order_id, event_key UNIQUE, actor_id, reason, created_at |

Trạng thái đơn: pending → confirmed → preparing → shipping → delivered → completed. Hủy chỉ từ pending/confirmed/preparing. Trạng thái thanh toán độc lập: unpaid/pending/paid/failed/refunded. Cần bổ sung quy trình trả hàng/hoàn tiền mô phỏng RET-01/02 trong giai đoạn backend; không coi task UI này hoàn thành toàn bộ Task 3 nghiệp vụ.

## Đề xuất phối hợp kho với người làm Task 2

Chưa trao đổi hoặc có xác nhận từ người làm Task 2. Không áp dụng thay đổi kho trước khi nhóm chốt các mục dưới.

1. SKU là đơn vị kho. Chốt tên bảng/khóa, kiểu quantity, giá, trạng thái bán và owner migration với Task 2.
2. Đề xuất MVP: giảm tồn có thể bán **một lần khi tạo đơn** trong transaction có khóa SKU/cập nhật điều kiện. Xác nhận/giao/hoàn thành không giảm lần nữa. Log movement cùng transaction.
3. COD: giữ lượng đã giảm đến khi hủy hoặc hoàn thành. VNPay: đơn pending-payment có hạn giữ kho do nhóm quyết định; thanh toán lỗi/hết hạn thì giải phóng một lần. Phải chốt cách xử lý callback thành công đến muộn sau khi hết hạn.
4. Hủy chỉ trả lượng đã giảm, event_key duy nhất (order_id + loại sự kiện). Trả hàng chỉ nhập lại phần được kho xác nhận có thể bán. Không cộng kho tự động cho mọi yêu cầu trả.
5. Transaction checkout cũng phải lưu snapshot, kiểm tra voucher, ghi usage nguyên tử; rollback toàn bộ nếu bất kỳ bước nào lỗi. Backend lấy customer_id/role từ phiên, không nhận quyền từ frontend.

Các contract cần nhóm chốt: users/address/cart/voucher từ Task 1; SKU/price/stock từ Task 2; thời hạn giữ kho; phí giao hàng; quy tắc hủy đơn đã thanh toán; schema và quyền truy cập. Mua lại phải dựng giỏ từ giá/tồn hiện tại trên backend.

## Tiêu chí kiểm tra khi tích hợp

Kiểm tra desktop/mobile, form sai/rỗng, lọc không có kết quả, đường dẫn đơn không tồn tại, chuyển trạng thái và hủy có lý do. Nghiệp vụ tồn kho, thanh toán, phân quyền và lưu trữ dữ liệu sẽ được kiểm tra khi triển khai backend.

Kiểm chứng lần cập nhật: `npm run build` và `git diff --check`.
