-- STT 18: persistent recipient-scoped notifications and searchable administrator audit.
-- Apply after 021_installation_checklists.sql. Existing audit rows remain readable with a null actor_role.
ALTER TABLE audit_logs
    ADD COLUMN actor_role VARCHAR(20) NULL AFTER actor_id,
    ADD INDEX idx_audit_action_time (action, created_at),
    ADD INDEX idx_audit_actor_time (actor_id, created_at);

CREATE TABLE notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    recipient_id BIGINT UNSIGNED NOT NULL,
    event_key VARCHAR(160) NOT NULL,
    notification_type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(500) NOT NULL,
    target_url VARCHAR(500) NOT NULL,
    read_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_notification_recipient_event (recipient_id, event_key),
    KEY idx_notification_inbox (recipient_id, is_deleted, created_at, id),
    KEY idx_notification_unread (recipient_id, read_at, created_at),
    CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
