-- Preserve the ownership history while removing fully returned products from active care reminders.
-- Apply after 022_notifications_audit.sql on a reviewed database.
ALTER TABLE owned_devices
    MODIFY COLUMN status ENUM('ACTIVE', 'ARCHIVED', 'RETURNED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN return_request_id BIGINT UNSIGNED NULL AFTER status,
    ADD COLUMN returned_at DATETIME NULL AFTER return_request_id,
    ADD COLUMN returned_by BIGINT UNSIGNED NULL AFTER returned_at,
    ADD INDEX idx_owned_return_request (return_request_id),
    ADD CONSTRAINT fk_owned_return_request FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id),
    ADD CONSTRAINT fk_owned_returned_by FOREIGN KEY (returned_by) REFERENCES users(id),
    ADD CONSTRAINT chk_owned_return_metadata CHECK (
        (status = 'RETURNED' AND return_request_id IS NOT NULL AND returned_at IS NOT NULL AND returned_by IS NOT NULL)
        OR (status <> 'RETURNED' AND return_request_id IS NULL AND returned_at IS NULL AND returned_by IS NULL)
    );
