# Functional requirement → module mapping

| Nhóm yêu cầu | Frontend | Backend domain |
|---|---|---|
| CUS-01..05 | auth/profile/address: shell bốn role, đăng ký/đăng nhập email-mật khẩu, quên/đổi mật khẩu (mã demo), hồ sơ và CRUD địa chỉ | Auth, User: MySQL qua PDO, PHP session + CSRF, role guard, khóa tạm sau 5 lần sai, validation và quyền sở hữu |
| CUS-06..12 | home/catalog/product/wishlist/review | Product, Category, Brand, Review |
| HOME-01 / FIT-01 / ADM-FIT-01 | `customer/RoomFitPanel.jsx` (tab trong `DecisionToolsPage.jsx`); `admin/FitRulesPreviewPage.jsx` quản trị rule bằng API thật | `room-fit-*` (CRUD hồ sơ phòng, evaluator `POST /api/fit-checks`); `fit_rules` + `fit_rule_versions` CRUD/version/audit ADMIN |
| FIT-02 (STT 31) | `components/decision/InstallationChecklist.jsx` trong `RoomFitPanel.jsx`, liên kết ảnh/thông số catalog | `installation-checklist-*`; migration 021, owner/CSRF/version/history/replay, lượt hoàn tất đầu tiên vào dashboard |
| TCO-01 | `components/decision/TcoComparison.jsx` dùng chung cho compare và `DecisionToolsPage.jsx` | `POST /api/tco/calculate`, catalog SKU/specs, làm tròn tiền cuối, fixture Decimal độc lập và `decision_events`; cần migration 012 |
| LIFE-01 / CARE-01 / ADM-CARE-01 (STT 24) | `customer/MyDevicesPage.jsx`, `admin/CareRulesPage.jsx`, `public/LiveCatalogProductPage.jsx` | `care-service.php`/`care-model.php`; completion bridge cùng transaction đơn hàng; migrations 012 + 016 cần review/áp dụng trước khi dùng DB |
| BOT-01..06 | `components/chatbot/ChatbotWidget.jsx`, `services/chatbot-service.js` | `POST /api/chatbot/messages`, catalog-search, FAQ ACTIVE do ADMIN duyệt; rule-based không LLM, metadata unit/type được kiểm; xem `docs/api/CHATBOT-DESIGN-CONTRACT.md` |
| CART / PROMO / CHK / PAY | `/cart`, checkout HTTP, QR chuyển khoản chờ đối soát, kết quả VNPay, bill khách và chứng từ nhân viên | Giỏ/version, snapshot giá/voucher/kho, COD, BANK_TRANSFER xác nhận thủ công có audit, VNPay Sandbox ký/IPN, expiry CLI, chứng từ bất biến, ADMIN hoàn toàn bộ mô phỏng cho đơn đã hủy + đã thu tiền; cần migration 014/cấu hình và test merchant thật |
| ORD / RET | orders/returns | Order, ReturnRefund |
| NOTI | notifications | Notification |
| SER / WAR | warranty | Serial, Warranty |
| REP | repair | Repair |
| TEC | technician | Technician, Repair |
| SAL | sales | Order, ReturnRefund |
| WH | warehouse | Inventory |
| SUP | suppliers | Supplier |
| PRD | admin catalog | Product, Category, Brand, Inventory |
| ADM-PRO | promotion | Voucher, Product |
| USR | users/RBAC | User, Auth |
| REV | moderation | Review |
| DASH / RPT / AUD | dashboard/reports/logs | Report, Audit |
| DASH-01 / RPT-03 | `admin/ReportAdminPage.jsx` có API, bộ lọc và CSV; giữ nguyên overview `/admin` | `GET /admin/dashboard`, CSV doanh thu, nguồn đếm FitCheck/TCO/care/FIT-02; tỷ lệ bảo trì giữ null chờ TV2/TV3 chốt |
