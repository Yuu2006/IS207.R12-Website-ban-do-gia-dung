-- Apply once after baseline + 008_order_runtime.sql; independent of optional 012/013.
ALTER TABLE carts ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN merchant_snapshot JSON NULL;
ALTER TABLE vouchers ADD COLUMN per_customer_limit INT UNSIGNED NULL;
ALTER TABLE payments ADD COLUMN expires_at DATETIME NULL, ADD COLUMN metadata_json JSON NULL;

CREATE TABLE payment_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    actor_role VARCHAR(20) NOT NULL,
    reference_code VARCHAR(100) NULL UNIQUE,
    reason VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    document_type ENUM('CUSTOMER','INTERNAL') NOT NULL,
    document_code VARCHAR(80) NOT NULL UNIQUE,
    snapshot_json JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_order_document (order_id, document_type),
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE voucher_usages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    voucher_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL UNIQUE,
    released_at DATETIME NULL,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    KEY idx_voucher_customer (voucher_id, customer_id, released_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
