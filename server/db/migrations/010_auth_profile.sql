-- CUS-01..05: áp dụng SAU database/schema_database.sql, chạy một lần trên database đã backup.
-- Không sửa baseline; chỉ thêm cột/ràng buộc cho đăng nhập email-mật khẩu, khóa tạm và hồ sơ.
-- Nếu dữ liệu cũ có số điện thoại trùng, unique phone sẽ lỗi: xử lý trùng trước khi chạy lại.
ALTER TABLE users
    ADD COLUMN birth_date DATE NULL AFTER phone,
    ADD COLUMN failed_login_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN locked_until DATETIME NULL,
    ADD CONSTRAINT uq_users_phone UNIQUE (phone);

ALTER TABLE addresses
    ADD INDEX idx_addresses_user_active (user_id, is_deleted);
