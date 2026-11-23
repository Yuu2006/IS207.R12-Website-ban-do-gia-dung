-- FIT-02: new tables only. Requires baseline + 012; do not rewrite existing migration history.
CREATE TABLE installation_checklists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    room_profile_id BIGINT UNSIGNED NULL,
    room_scope BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(room_profile_id, 0)) STORED,
    template_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    checks_json JSON NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    first_completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_installation_context (customer_id, product_id, room_scope),
    KEY idx_installation_completed (first_completed_at, id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (room_profile_id) REFERENCES room_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE installation_checklist_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    checklist_id BIGINT UNSIGNED NULL,
    request_key CHAR(36) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_installation_request (customer_id, request_key),
    KEY idx_installation_history (checklist_id, id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (checklist_id) REFERENCES installation_checklists(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
