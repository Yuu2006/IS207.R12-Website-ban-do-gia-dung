# Functional requirement → module mapping

| Nhóm yêu cầu | Frontend | Backend domain |
|---|---|---|
| CUS-01..05 | auth/profile/address: shell bốn role, đăng ký/đăng nhập email-mật khẩu, quên/đổi mật khẩu (mã demo), hồ sơ và CRUD địa chỉ | Auth, User: MySQL qua PDO, PHP session + CSRF, role guard, khóa tạm sau 5 lần sai, validation và quyền sở hữu |
| CUS-06..12 | home/catalog/product/wishlist/review | Product, Category, Brand, Review |
| HOME-01 / FIT-01 / ADM-FIT-01 | `customer/DecisionToolsPage.jsx`, `admin/FitRulesPreviewPage.jsx` (màn hình mẫu) | Đề xuất `room_profiles`, `fit_rules`, FitCheck evaluator; API chưa triển khai |
| TCO-01 | `customer/DecisionToolsPage.jsx` (màn hình mẫu) | Contract tính stateless và `decision_events`; API chưa triển khai |
| LIFE-01 / CARE-01 / ADM-CARE-01 | `customer/DecisionToolsPage.jsx` (màn hình mẫu) | Đề xuất `owned_devices`, `care_rules`, `care_tasks`; completion bridge/API chưa triển khai |
| BOT-01..06 | chatbot | Chatbot, Product |
| CART / PROMO / CHK / PAY | cart/checkout/payment | Cart, Voucher, Checkout, Payment |
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
| DASH-01 / RPT-03 | `admin/DashboardPreviewPage.jsx` (màn hình mẫu, không có số liệu) | Định nghĩa KPI tại `docs/api/DASHBOARD-METRICS.md`, chờ TV2/TV3 xác nhận |
