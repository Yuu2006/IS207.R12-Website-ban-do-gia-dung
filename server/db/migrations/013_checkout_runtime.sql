-- Checkout dependency schema. Apply once after the reviewed baseline and migration 008_order_runtime.sql.
-- This migration adds cart versioning and idempotent voucher reservations without rewriting shared history.
ALTER TABLE carts
    ADD COLUMN cart_version BIGINT UNSIGNED NOT NULL DEFAULT 1;

ALTER TABLE vouchers
    ADD COLUMN per_customer_limit INT UNSIGNED NULL;

CREATE TABLE voucher_redemptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    voucher_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at DATETIME NULL,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_voucher_customer_status (voucher_id, customer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
