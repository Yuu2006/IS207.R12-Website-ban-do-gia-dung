# Schema auth/profile/address — CUS-01..05

Schema chốt trong `server/db/migrations/001_auth_profile.sql`, MySQL 8.4, InnoDB, utf8mb4. Bốn role cố định CUSTOMER/ADMIN/SALES/WAREHOUSE. API hiện dùng mock và chưa chạy migration trên database chung.

| Bảng | Trường / ràng buộc |
| --- | --- |
| users | id BIGINT UNSIGNED; full_name VARCHAR(150); email VARCHAR(255) nullable unique; phone VARCHAR(20) nullable unique; password_hash VARCHAR(255) nullable; avatar_url nullable; role ENUM bốn role; status ACTIVE/DISABLED; is_deleted; timestamps |
| addresses | id BIGINT UNSIGNED; user_id FK users; recipient_name VARCHAR(150); phone VARCHAR(20); address_line VARCHAR(255); province VARCHAR(100); district/ward nullable VARCHAR(100); is_default; is_deleted; timestamps |

Email/phone cần ít nhất một giá trị. Model PDO tương lai chuyển chuỗi rỗng của contract thành NULL để unique constraint không xung đột các tài khoản thiếu một cách liên hệ. CUSTOMER dùng OTP nên password_hash nullable; tài khoản nội bộ bắt buộc hash. Principal do backend tạo từ user ACTIVE, không lấy role từ client. Session dùng native PHP session; chưa cần bảng sessions riêng.

Địa chỉ truy vấn theo user_id + is_deleted; có index cho truy vấn này. Generated column default_owner_id chỉ có user_id khi địa chỉ hoạt động và mặc định, unique bảo đảm tối đa một mặc định/người dùng. Quy tắc ít nhất một mặc định nếu còn địa chỉ do service thực hiện. Khi nối MySQL, khóa hàng user trong transaction trước đổi/xóa mặc định: bỏ cờ cũ, cập nhật địa chỉ mới và commit cùng nhau, tránh tranh chấp unique.

ERD tối thiểu: `users (1) → addresses (n)`, FK không xóa dây chuyền. Địa chỉ đã phát sinh giao dịch xóa mềm; order vẫn dùng snapshot địa chỉ tại checkout, không tham chiếu địa chỉ để thay đổi lịch sử đơn.

Migration 001 chỉ dùng cho **database mới chưa có users/addresses**. Không import đồng thời với `database/schema_database.sql`: file đó là baseline cũ có hai bảng cùng tên, role cũ và email/password bắt buộc. Không chạy migration này lên DB đã import baseline. Khi nhóm xác nhận trạng thái DB đang dùng, cần migration ALTER riêng với kiểm tra dữ liệu trước; không tự xóa user/role cũ hoặc viết lại lịch sử schema.

Áp dụng trên DB mới do người phụ trách database chọn: `mysql --default-character-set=utf8mb4 -u <user> -p <database> < server/db/migrations/001_auth_profile.sql`. Migration không có DROP/TRUNCATE; thao tác này tạo bảng và cần được phối hợp trước khi áp dụng lên DB chung. Chưa có seed SQL; demo accounts hiện nằm trong mock service/model.
