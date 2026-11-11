-- Fixture in the isolated fit_rule_isolated database before migration 013.
INSERT INTO users (full_name, email, password_hash, role)
VALUES ('Existing Admin', 'existing-admin@example.test', 'test', 'ADMIN');
INSERT INTO categories (name, slug) VALUES ('Existing category', 'existing-category');
INSERT INTO fit_rules (
    category_id, rule_key, title, left_source, left_key, operator,
    right_source, right_key, unit, severity,
    pass_message, fail_message, missing_message, updated_by
) VALUES (
    1, 'existing_width', 'Existing width rule', 'ROOM_FIELD', 'placement_width_mm', 'LTE',
    'ROOM_FIELD', 'door_width_mm', 'mm', 'WARN',
    'Pass', 'Fail', 'Missing', 1
);
