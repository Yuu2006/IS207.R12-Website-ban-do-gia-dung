-- Apply once after 012_decision_tools.sql. Never rewrite the original fit_rules migration.
-- Every committed rule revision has an immutable full snapshot and the actor/time of the change.
CREATE TABLE fit_rule_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rule_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    action ENUM('BASELINE', 'CREATE', 'UPDATE', 'DEACTIVATE') NOT NULL,
    snapshot JSON NOT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_fit_rule_version (rule_id, version),
    KEY idx_fit_rule_actor_time (changed_by, changed_at),
    CONSTRAINT fk_fit_version_rule FOREIGN KEY (rule_id) REFERENCES fit_rules(id),
    CONSTRAINT fk_fit_version_actor FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing rules keep a snapshot of the state visible when audit is introduced.
-- Earlier revisions cannot be reconstructed and must not be invented.
INSERT INTO fit_rule_versions (rule_id, version, action, snapshot, changed_by, changed_at)
SELECT id, version, 'BASELINE', JSON_OBJECT(
    'id', id, 'category_id', category_id, 'product_id', product_id,
    'rule_key', rule_key, 'title', title, 'left_source', left_source,
    'left_key', left_key, 'operator', operator, 'right_source', right_source,
    'right_key', right_key, 'right_value', right_value, 'margin_value', margin_value,
    'unit', unit, 'severity', severity, 'pass_message', pass_message,
    'fail_message', fail_message, 'missing_message', missing_message,
    'status', status, 'version', version, 'updated_by', updated_by,
    'created_at', created_at, 'updated_at', updated_at
), updated_by, updated_at
FROM fit_rules;
