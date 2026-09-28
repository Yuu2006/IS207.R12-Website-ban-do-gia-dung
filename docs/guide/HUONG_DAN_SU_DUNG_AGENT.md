# Hướng dẫn sử dụng Agent cho project website bán đồ gia dụng

Tài liệu dành cho nhóm phát triển IS207.R12, sử dụng cùng `AGENTS.md` đã biên soạn cho stack ReactJS + Vite, PHP REST API và MySQL. Hướng dẫn cách giao việc theo phạm vi hiện tại, bổ sung chức năng mới và tiếp tục phát triển mà vẫn giữ cấu trúc project nhất quán.

## 1. Hiểu đúng vai trò của rule

**AGENTS.md quy định cách làm việc; đặc tả quy định sản phẩm cần có gì; yêu cầu của bạn xác định công việc Agent cần làm trong lượt đó.**

Rule không khóa dự án ở danh sách tính năng ban đầu. Câu “không tự thêm chức năng ngoài MVP” ngăn Agent tự mở rộng phạm vi khi chưa được giao. Khi bạn yêu cầu rõ một chức năng mới, Agent có thể triển khai và cập nhật các tài liệu bị ảnh hưởng.

Bạn không cần dùng một câu xác nhận cố định. “Thêm chức năng thông báo có hàng lại vào project” đã là yêu cầu triển khai; “Chức năng này có nên thêm không?” là yêu cầu phân tích, chưa phải yêu cầu code.

Yêu cầu mới chỉ thay đổi phần phạm vi được nêu. Nó không mặc nhiên cho phép bỏ phân quyền, làm sai dữ liệu tồn kho, thay framework hoặc xóa dữ liệu. Agent vẫn phải làm việc trong khả năng và quyền truy cập thực tế của môi trường.

| Thành phần | Nội dung cần lưu |
| --- | --- |
| `AGENTS.md` | Kiến trúc, code style, workflow, bảo mật, cách kiểm chứng và giới hạn chung. |
| Đặc tả trong `docs/requirements/` | Vai trò, luồng nghiệp vụ, quy tắc và tiêu chí nghiệm thu của chức năng. |
| `docs/api/`, `docs/database/` | API contract, dữ liệu và thay đổi schema. |
| `task/` | Công việc, tiến độ và phần chưa hoàn thành. |
| Prompt giao việc | Chức năng cần làm ngay, kết quả mong muốn và giới hạn của nhiệm vụ. |

## 2. Chuẩn bị một lần

1. Đặt `AGENTS.md` ở gốc repository, ngang hàng với `client/`, `server/`, `docs/` và `README.md`.
2. Có thể đặt hướng dẫn này tại `docs/guide/HUONG_DAN_SU_DUNG_AGENT.md`. Đây là tài liệu cho người giao việc, không thay thế AGENTS.md.
3. Đưa đặc tả MVP mới nhất vào `docs/requirements/` hoặc cung cấp trực tiếp cho Agent trong phiên làm việc. Chỉ ghi tên file trong rule không làm nội dung file tự xuất hiện trong môi trường Agent.
4. Mở đúng repository/checkout và cho Agent truy cập những file cần sửa. Khi làm việc theo nhánh, dùng workflow `feature/...` hoặc `fix/...` → `develop` → `main` của nhóm.
5. Lần giao việc đầu, yêu cầu Agent đọc rule và kiểm tra code thực tế. Không giả định công cụ nào cũng tự nạp cùng một loại file chỉ dẫn.

Mẫu mở đầu:

```text
Đọc AGENTS.md ở gốc repo, README và tài liệu liên quan đến nhiệm vụ.
Kiểm tra code, branch và thay đổi chưa commit trước khi sửa.
Áp dụng quy ước của project ReactJS + PHP + MySQL.
Dựa trên code thực tế để xác định phần đã có, phần còn thiếu; không coi scaffold là chức năng hoàn chỉnh.
```

## 3. Trường hợp A — Làm chức năng đã có trong phạm vi

Dùng khi triển khai chức năng trong đặc tả, sửa lỗi, hoàn thiện giao diện hoặc tối ưu hành vi hiện có. Thường không cần sửa AGENTS.md vì kiến trúc và phạm vi chung không đổi.

### Mẫu giao việc đầy đủ

Thay các phần trong dấu ngoặc vuông trước khi gửi:

```text
Tuân thủ AGENTS.md và đặc tả hiện tại của project.

Nhiệm vụ: [tên chức năng hoặc lỗi cần sửa].
Mã yêu cầu: [mã trong đặc tả nếu có].
Người sử dụng: [CUSTOMER / ADMIN / SALES / WAREHOUSE].

Hành vi mong muốn:
- [Hành vi 1].
- [Hành vi 2].

Tiêu chí nghiệm thu:
- [Điều kiện có thể kiểm tra được].
- [Một trường hợp dữ liệu sai hoặc không đủ quyền].

Hãy kiểm tra phần đã có, tái sử dụng code phù hợp và triển khai phần còn thiếu.
Thực hiện frontend, backend và database trong mức cần thiết cho nhiệm vụ.
Cập nhật tài liệu API/schema liên quan; kiểm chứng luồng chính và lỗi quan trọng.
Báo cáo thay đổi, cách chạy thử, kiểm tra đã chạy và phần chưa kiểm chứng.
```

### Ví dụ: triển khai giỏ hàng

```text
Triển khai CART-01 và CART-02 theo AGENTS.md và đặc tả MVP.

Khách hàng có thể thêm đúng SKU vào giỏ, đổi số lượng và xóa dòng hàng.
Thêm lại cùng SKU phải cộng số lượng, không tạo dòng trùng.
Backend kiểm tra SKU đang hoạt động, số lượng hợp lệ và tồn kho.
Nếu giá hoặc tồn thay đổi, giao diện thông báo rõ và cập nhật dữ liệu.

Hoàn thành giao diện React, API PHP và phần MySQL cần thiết.
Tái sử dụng module hiện có; cập nhật tài liệu API và kiểm tra các trường hợp:
SKU không tồn tại, số lượng âm, vượt tồn và truy cập giỏ của tài khoản khác.
Chỉ báo hoàn thành khi đã nối luồng thật; chỉ rõ bước nào chưa chạy được.
```

### Ví dụ: sửa lỗi mà không mở rộng phạm vi

```text
Tuân thủ AGENTS.md. Sửa lỗi thêm cùng SKU hai lần tạo hai dòng trong giỏ.

Cách tái hiện: đăng nhập, thêm SKU A số lượng 1, rồi thêm SKU A số lượng 2.
Hiện tại: có hai dòng riêng.
Mong muốn: một dòng SKU A số lượng 3, nếu tồn kho cho phép.

Tìm nguyên nhân ở cả API và giao diện, sửa trong phạm vi liên quan,
và kiểm tra hồi quy để lỗi không tái diễn. Không đổi nghiệp vụ voucher hoặc checkout.
```

## 4. Trường hợp B — Thêm chức năng mới hoặc mở rộng chức năng

Dùng khi đặc tả chưa có chức năng, muốn mở rộng hành vi, hoặc muốn đưa một phần trước đây bị hoãn vào phiên bản mới. Bạn cần nói rõ muốn phân tích ý tưởng hay triển khai.

### B1. Mới có ý tưởng, muốn đánh giá trước

```text
Tôi đang cân nhắc thêm [ý tưởng] vào project. Lượt này chỉ phân tích, chưa sửa code.
Đọc AGENTS.md và kiểm tra module liên quan.

Hãy đề xuất phạm vi nhỏ nhất hữu ích, người dùng, luồng chính và tiêu chí nghiệm thu.
Chỉ ra tác động đến frontend, API, database, phân quyền và chức năng hiện có.
Nêu điểm xung đột với đặc tả/rule nếu có, cùng chi phí dịch vụ ngoài nếu cần.
Đề xuất phương án phù hợp với ReactJS + PHP + MySQL của nhóm.
```

Ở bước này, kết quả mong đợi là phương án cụ thể để lựa chọn, không phải code được thêm ngoài ý muốn. Khi đã chọn, dùng mẫu B2 để triển khai.

### B2. Đã quyết định, yêu cầu triển khai luôn

```text
Bổ sung [tên chức năng] vào phạm vi project và triển khai ngay.
Đây là yêu cầu mở rộng so với đặc tả hiện tại.

Mục tiêu: [vấn đề cần giải quyết].
Người dùng: [vai trò].
Phạm vi lần này:
- [Hành vi cần có].
- [Hành vi cần có].

Chưa làm trong lần này: [phần mở rộng chưa cần, nếu có].
Tiêu chí nghiệm thu:
- [Điều kiện cụ thể 1].
- [Điều kiện cụ thể 2].

Tuân thủ kiến trúc, code style, bảo mật và Git workflow trong AGENTS.md.
Yêu cầu mới này thay thế giới hạn phạm vi cũ chỉ ở phần chức năng vừa nêu.
Cập nhật đặc tả, mapping và tài liệu API/database liên quan.
Chỉ sửa AGENTS.md nếu phạm vi ghi trong đó bị mâu thuẫn hoặc quy tắc chung thay đổi.

Tự xử lý lựa chọn kỹ thuật thông thường, nêu giả định và tiếp tục triển khai.
Chỉ hỏi khi thiếu quyết định nghiệp vụ quan trọng không thể suy ra an toàn.
Kiểm chứng chức năng mới và phần cũ bị ảnh hưởng, rồi báo cáo kết quả thực tế.
```

Không cần bắt Agent xin duyệt lại chỉ vì chức năng từng nằm ngoài MVP: yêu cầu triển khai rõ ràng của bạn đã cho phép mở rộng phần đó. Nếu còn thiếu tài khoản dịch vụ, quyền truy cập hoặc quyết định nghiệp vụ quan trọng, Agent cần nêu đúng điểm còn thiếu.

### Ví dụ đầy đủ: thông báo khi có hàng trở lại

```text
Thêm chức năng “Thông báo khi có hàng trở lại” vào project và triển khai.
Chức năng này được bổ sung vào phạm vi hiện tại.

Phạm vi:
1. CUSTOMER đã đăng nhập được đăng ký theo dõi một SKU đang hết hàng.
2. Mỗi khách chỉ có một đăng ký đang hoạt động cho cùng SKU.
3. Khách có thể hủy đăng ký và chỉ quản lý đăng ký của mình.
4. Khi tồn có thể bán chuyển từ 0 sang lớn hơn 0, tạo một thông báo trong web
   cho mỗi đăng ký đang chờ, rồi đánh dấu đăng ký đã được thông báo.
5. Xử lý lại cùng sự kiện không tạo thông báo trùng. Nếu SKU hết hàng lần nữa,
   khách được đăng ký một đợt mới.
6. Thông báo dẫn đến đúng sản phẩm/SKU; việc nhận thông báo không giữ hàng cho khách.

Lần này chỉ làm thông báo trong web, chưa gửi email/SMS.
Tuân thủ AGENTS.md, tái sử dụng module Inventory và Notification nếu có.
Cập nhật yêu cầu mới với mã không trùng, API, migration và mapping cần thiết.
Không tự xây cron/queue riêng nếu có thể xử lý tại luồng cập nhật tồn hiện có.

Nghiệm thu: đăng ký trùng không tạo thêm bản ghi hoạt động; hủy thì không nhận tin;
khách không xem/sửa đăng ký người khác; sự kiện lặp không sinh tin trùng;
luồng đặt hàng và điều chỉnh tồn cũ vẫn hoạt động.
```

### Ví dụ: phát triển thêm chức năng đã có

```text
Mở rộng TCO-01: cho phép khách lưu kết quả tính TCO để mở lại sau.
Đây là phần bổ sung vào phạm vi TCO hiện tại; giữ các kỳ 1, 3 và 5 năm.

Lưu sản phẩm, đầu vào, giả định, thời điểm tính và kết quả tại thời điểm lưu.
Khách chỉ xem/xóa kết quả của mình. Khi mở lại, phân biệt số liệu đã lưu
với giá/thông số hiện tại; chỉ tính lại khi khách chọn hành động đó.

Tuân thủ AGENTS.md; cập nhật đặc tả và các tầng liên quan.
Kiểm chứng rằng việc lưu không làm thay đổi kết quả của bộ tính hiện tại.
```

### Ví dụ: đưa một phần từng bị loại khỏi MVP trở lại

```text
Tôi quyết định mở rộng phạm vi để thêm chức năng tiếp nhận yêu cầu sửa chữa.
Triển khai phiên bản nhỏ: khách gửi yêu cầu cho thiết bị của mình và xem trạng thái;
ADMIN xem danh sách và cập nhật trạng thái tiếp nhận/đang xử lý/đã đóng.
Chưa làm vai trò kỹ thuật viên, lịch hẹn, linh kiện hoặc tính phí sửa chữa.

Cập nhật đúng phần giới hạn repair trong AGENTS.md và đặc tả để phản ánh quyết định này.
Giữ nguyên các quy tắc kiến trúc, phân quyền và dữ liệu khác.
Triển khai, kiểm chứng và cập nhật tài liệu liên quan; không tự mở rộng cả module sửa chữa.
```

## 5. Khi nào phải sửa rule?

| Thay đổi | Tài liệu nên cập nhật |
| --- | --- |
| Code một chức năng đã có trong MVP | Task và tài liệu API/schema/module có thay đổi; thường không sửa AGENTS.md. |
| Sửa bug, đổi màu, điều chỉnh bố cục | Ghi nhận thay đổi và cách kiểm tra; không cần mở rộng đặc tả nếu hành vi không đổi. |
| Thêm chức năng chưa có | Đặc tả, mã yêu cầu, mapping, API/schema tương ứng. |
| Cho phép một chức năng đang bị ghi là ngoài phạm vi trong AGENTS.md | Sửa đúng giới hạn đó trong AGENTS.md và cập nhật đặc tả. |
| Đổi role, stack, kiến trúc hoặc Git workflow | Cập nhật AGENTS.md và tài liệu kỹ thuật bị ảnh hưởng theo quyết định mới. |
| Có quy tắc riêng cho một khu vực code | Có thể bổ sung chỉ dẫn tại khu vực đó nếu công cụ Agent hỗ trợ; giữ nhất quán với quy tắc chung. |

Không dồn toàn bộ mô tả màn hình, endpoint và từng trường dữ liệu vào AGENTS.md. Rule nên đủ gọn để dùng cho mọi nhiệm vụ; chi tiết tính năng đặt trong tài liệu chức năng.

## 6. Giao việc theo từng phần và tiếp tục ở phiên sau

Với chức năng lớn, chia thành các mốc có kết quả kiểm tra được: chốt nghiệp vụ/API/data → triển khai luồng chính → xử lý lỗi và phân quyền → kiểm chứng và cập nhật tài liệu. Nếu bạn yêu cầu trọn chức năng, Agent nên tiếp tục qua các mốc đã được giao, không dừng chỉ để xin phép mỗi bước.

Nếu bạn chỉ cần frontend, hãy nói rõ:

```text
Lần này chỉ triển khai frontend trang [tên trang] theo AGENTS.md.
Dùng API contract hiện có; nếu API chưa sẵn sàng, cô lập mock và ghi rõ là dữ liệu demo.
Liệt kê phần backend còn thiếu, không báo đây là chức năng hoàn chỉnh end-to-end.
```

Để tiếp tục ở phiên mới:

```text
Đọc AGENTS.md, tài liệu chức năng [đường dẫn] và task liên quan.
Kiểm tra code/commit hiện tại để tiếp tục phần còn thiếu của [chức năng].
Không làm lại phần đã hoàn thành và không ghi đè thay đổi của đồng đội.
Nếu task ghi hoàn thành nhưng code mới có scaffold/mock, hãy nêu rõ và xử lý phần thiếu.
```

Với nhiều người cùng làm, mỗi nhiệm vụ nên có branch riêng và nêu rõ phạm vi file/module. Thống nhất API contract trước khi frontend và backend cùng triển khai; kiểm tra tích hợp trước khi merge vào develop.

## 7. Đưa kết quả lên GitHub

Phân biệt viết code trong môi trường làm việc với đưa thay đổi lên repository và phát hành. Nêu rõ kết quả bạn muốn để Agent thực hiện đúng bước.

Mẫu yêu cầu tạo PR khi bạn đã muốn đưa code lên GitHub:

```text
Sau khi hoàn thành và kiểm chứng nhiệm vụ, commit các thay đổi liên quan,
push lên branch công việc và tạo draft PR vào develop theo AGENTS.md.
PR ghi rõ chức năng, tài liệu/migration cần dùng và kiểm tra đã chạy.
Chưa merge hoặc deploy. Nếu thiếu quyền GitHub hoặc nhánh develop chưa tồn tại,
hãy báo đúng vướng mắc thay vì đổi mục tiêu PR sang main.
```

Quy tắc review của nhóm vẫn áp dụng. Không coi việc build pass là đã đủ điều kiện phát hành hoặc là bằng chứng mọi chức năng đều chạy đúng.

## 8. Cách kiểm tra Agent đã làm xong chưa

Yêu cầu bản bàn giao trả lời được các câu sau:

1. Người dùng vào trang nào, thao tác gì để chạy thử chức năng?
2. Frontend đã gọi API thật chưa? Có phần nào còn mock hoặc placeholder?
3. Có migration/config mới không, áp dụng thế nào trong môi trường phát triển?
4. API có kiểm tra vai trò, quyền sở hữu và dữ liệu đầu vào không?
5. Các trường hợp lỗi quan trọng đã được kiểm tra với kết quả nào?
6. Tài liệu nào đã cập nhật và phần nào chưa được kiểm chứng?

Mẫu yêu cầu rà soát:

```text
Rà soát phần vừa làm theo AGENTS.md và tiêu chí nghiệm thu của nhiệm vụ.
Kiểm tra luồng thật từ giao diện đến database, quyền truy cập và các lỗi chính.
Sửa lỗi thuộc phạm vi nhiệm vụ nếu phát hiện.
Báo rõ kiểm tra đã chạy, kết quả, phần chưa chạy và cách tôi tự kiểm tra lại.
Không kết luận hoàn thành chỉ dựa trên build thành công.
```

## 9. Hai mẫu ngắn để dùng thường xuyên

**Làm theo rule và phạm vi hiện tại:**

```text
Đọc AGENTS.md và triển khai [chức năng/mã yêu cầu] theo đặc tả hiện tại.
Kiểm tra code đã có, hoàn thiện các tầng cần thiết, kiểm chứng và cập nhật docs liên quan.
Tự xử lý lựa chọn kỹ thuật thông thường; báo rõ kết quả và phần chưa kiểm chứng.
```

**Thêm hoặc phát triển chức năng:**

```text
Bổ sung [chức năng + hành vi mong muốn] vào phạm vi project và triển khai.
Tuân thủ AGENTS.md về kiến trúc, bảo mật và workflow.
Cập nhật đặc tả/mapping/API/database cần thiết; sửa đúng phần rule nếu phạm vi mới gây mâu thuẫn.
Tiêu chí nghiệm thu: [các điều kiện cụ thể].
Kiểm chứng chức năng mới cùng phần cũ bị ảnh hưởng và báo cáo kết quả thực tế.
```

Tài liệu này hướng dẫn sử dụng bộ AGENTS.md đã tạo ngày 28/09/2026. Khi nhóm đổi quy ước project, cập nhật rule và hướng dẫn liên quan để các lần giao việc sau tiếp tục nhất quán.
