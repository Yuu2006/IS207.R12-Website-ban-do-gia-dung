-- Apply after 014_vnpay_runtime.sql on a reviewed database; never rewrite the baseline.
-- Return approval is staff-controlled; refunds are ledger-only simulations, not bank transactions.
ALTER TABLE order_return_requests
    ADD COLUMN issue_category VARCHAR(40) NOT NULL DEFAULT 'OTHER',
    ADD COLUMN severity VARCHAR(16) NULL,
    ADD COLUMN triage_note VARCHAR(500) NULL,
    ADD COLUMN triaged_by BIGINT UNSIGNED NULL,
    ADD COLUMN triaged_at DATETIME NULL,
    ADD COLUMN manager_decided_by BIGINT UNSIGNED NULL,
    ADD COLUMN manager_decided_at DATETIME NULL,
    ADD COLUMN decision_reason VARCHAR(500) NULL,
    ADD COLUMN received_by BIGINT UNSIGNED NULL,
    ADD COLUMN received_at DATETIME NULL,
    ADD COLUMN inspection_checklist JSON NULL,
    ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD INDEX idx_return_status_created (status, created_at, id),
    ADD INDEX idx_return_severity_status (severity, status, id),
    ADD CONSTRAINT fk_return_triaged_by FOREIGN KEY (triaged_by) REFERENCES users(id),
    ADD CONSTRAINT fk_return_manager_decided_by FOREIGN KEY (manager_decided_by) REFERENCES users(id),
    ADD CONSTRAINT fk_return_received_by FOREIGN KEY (received_by) REFERENCES users(id);

CREATE TABLE order_simulated_refunds (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL UNIQUE,
    return_request_id BIGINT UNSIGNED NOT NULL UNIQUE,
    payment_id BIGINT UNSIGNED NOT NULL UNIQUE,
    amount DECIMAL(14,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SIMULATED',
    recorded_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (recorded_by) REFERENCES users(id),
    INDEX idx_simulated_refund_created (status, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_return_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    return_request_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(20) NULL,
    to_status VARCHAR(20) NOT NULL,
    action VARCHAR(40) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    note VARCHAR(500) NULL,
    details JSON NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id),
    FOREIGN KEY (actor_id) REFERENCES users(id),
    INDEX idx_return_history_request (return_request_id, changed_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
