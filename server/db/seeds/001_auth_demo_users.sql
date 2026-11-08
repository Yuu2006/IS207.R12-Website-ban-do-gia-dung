-- Bốn tài khoản demo (thông tin giả). Mật khẩu chung: Demo@1234567890!
-- Chạy sau 010_auth_profile.sql; chạy lại chỉ cập nhật tên/role/trạng thái, không đổi mật khẩu đã đổi.
INSERT INTO users (full_name, email, phone, password_hash, role, status)
VALUES
    ('Nguyễn Minh', 'customer@example.test', '0901234567', '$2y$10$KkT8yurULCYRqY29j/rVcugGKg57g8LIftRaQId.pugTgOyQ779yq', 'CUSTOMER', 'ACTIVE'),
    ('Quản trị viên demo', 'admin@example.test', NULL, '$2y$10$KkT8yurULCYRqY29j/rVcugGKg57g8LIftRaQId.pugTgOyQ779yq', 'ADMIN', 'ACTIVE'),
    ('Nhân viên bán hàng demo', 'sales@example.test', NULL, '$2y$10$KkT8yurULCYRqY29j/rVcugGKg57g8LIftRaQId.pugTgOyQ779yq', 'SALES', 'ACTIVE'),
    ('Nhân viên kho demo', 'warehouse@example.test', NULL, '$2y$10$KkT8yurULCYRqY29j/rVcugGKg57g8LIftRaQId.pugTgOyQ779yq', 'WAREHOUSE', 'ACTIVE')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), status = VALUES(status), is_deleted = 0;
