-- Schema chốt cho CUS-01..05. Chỉ áp dụng trên database mới chưa có users/addresses.
-- API hiện dùng mock; migration này chưa được chạy lên database chung.
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(20) NULL,
    password_hash VARCHAR(255) NULL,
    avatar_url VARCHAR(500) NULL,
    role ENUM('CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE') NOT NULL DEFAULT 'CUSTOMER',
    status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT ck_users_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
    CONSTRAINT ck_users_contact CHECK (
        (email IS NOT NULL AND CHAR_LENGTH(TRIM(email)) > 0) OR
        (phone IS NOT NULL AND CHAR_LENGTH(TRIM(phone)) > 0)
    ),
    CONSTRAINT ck_users_staff_password CHECK (role = 'CUSTOMER' OR password_hash IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE addresses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    recipient_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100) NULL,
    ward VARCHAR(100) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    default_owner_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN is_default = TRUE AND is_deleted = FALSE THEN user_id ELSE NULL END
    ) STORED,
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_addresses_default UNIQUE (default_owner_id),
    CONSTRAINT ck_addresses_recipient CHECK (CHAR_LENGTH(TRIM(recipient_name)) > 0),
    CONSTRAINT ck_addresses_line CHECK (CHAR_LENGTH(TRIM(address_line)) > 0),
    CONSTRAINT ck_addresses_province CHECK (CHAR_LENGTH(TRIM(province)) > 0),
    INDEX idx_addresses_user_active (user_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
