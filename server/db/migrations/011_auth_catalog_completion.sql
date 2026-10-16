-- Hoàn thiện task 9/12 (16/10/2026). Áp SAU 010_auth_profile.sql, một lần, có backup. Chỉ thêm cột/bảng.
-- PRD-01 thứ tự danh mục, PRD-02 mô tả thương hiệu, ADM-PRO-02 thứ tự banner.
ALTER TABLE categories ADD COLUMN sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER slug;
ALTER TABLE brands ADD COLUMN description VARCHAR(1000) NULL AFTER logo_url;
ALTER TABLE banners ADD COLUMN sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER target_url;

-- Lịch sử đăng nhập: giới hạn sai theo IP (chống dò mật khẩu nhiều tài khoản) và làm nguồn audit login (task 18).
CREATE TABLE auth_login_attempts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    succeeded BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_attempts_ip_time (ip_address, created_at),
    CONSTRAINT fk_login_attempts_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
