-- Apply AFTER database/schema_database.sql to a reviewed database; never rewrite the baseline.
-- DDL is NOT transactional in MySQL. Apply once, with backup, before enabling ORDER_STORAGE_MODE=mysql.
-- Existing inventory is explicitly UNTRACKED: migration must not invent reservations or release stock.
ALTER TABLE orders
    ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    ADD COLUMN inventory_state VARCHAR(20) NOT NULL DEFAULT 'UNTRACKED',
    ADD COLUMN refund_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE order_items
    ADD COLUMN image_url VARCHAR(500) NULL;

ALTER TABLE order_status_history
    ADD COLUMN from_status VARCHAR(30) NULL,
    ADD COLUMN actor_role VARCHAR(20) NULL;
-- Do not backfill actor_role from users.role: a person's role today is not their historical role.

CREATE TABLE order_idempotency (
    actor_id BIGINT UNSIGNED NOT NULL,
    operation VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    response_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id, operation, request_key),
    FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Request only: no automatic refund, restock, return window, or approval policy.
CREATE TABLE order_return_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL UNIQUE,
    customer_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    reason VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
