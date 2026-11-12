-- USR-01: metadata for administrator-managed account suspension and indexed user listing.
-- Apply once after 011_auth_catalog_completion.sql; review and back up the target database first.
ALTER TABLE users
    ADD COLUMN admin_locked_at DATETIME NULL AFTER locked_until,
    ADD COLUMN admin_locked_by BIGINT UNSIGNED NULL AFTER admin_locked_at,
    ADD COLUMN admin_lock_reason VARCHAR(255) NULL AFTER admin_locked_by,
    ADD INDEX idx_users_role_status_deleted (role, status, is_deleted),
    ADD CONSTRAINT fk_users_admin_locked_by FOREIGN KEY (admin_locked_by) REFERENCES users(id);

ALTER TABLE auth_login_attempts
    ADD INDEX idx_login_attempts_user_success_time (user_id, succeeded, created_at);
