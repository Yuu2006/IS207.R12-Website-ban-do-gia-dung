-- HOME-01 / FIT-01 / TCO-01 / LIFE-01 / CARE-01.
-- Apply once after the baseline and catalog/order/auth migrations. Do not re-import the baseline.
-- Dimensions are millimetres; floor area remains square metres and money remains DECIMAL VND.

CREATE TABLE room_profiles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    placement_width_mm INT UNSIGNED NULL,
    placement_depth_mm INT UNSIGNED NULL,
    placement_height_mm INT UNSIGNED NULL,
    door_width_mm INT UNSIGNED NULL,
    floor_area_m2 DECIMAL(10, 2) NULL,
    occupant_count SMALLINT UNSIGNED NULL,
    power_available TINYINT(1) NULL,
    water_supply TINYINT(1) NULL,
    drainage TINYINT(1) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    active_default_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN is_default = 1 AND is_deleted = 0 THEN user_id ELSE NULL END
    ) STORED,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_room_default_user (active_default_user_id),
    KEY idx_room_user_active (user_id, is_deleted),
    CONSTRAINT fk_room_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_room_width CHECK (placement_width_mm IS NULL OR placement_width_mm > 0),
    CONSTRAINT chk_room_depth CHECK (placement_depth_mm IS NULL OR placement_depth_mm > 0),
    CONSTRAINT chk_room_height CHECK (placement_height_mm IS NULL OR placement_height_mm > 0),
    CONSTRAINT chk_room_door CHECK (door_width_mm IS NULL OR door_width_mm > 0),
    CONSTRAINT chk_room_area CHECK (floor_area_m2 IS NULL OR floor_area_m2 > 0),
    CONSTRAINT chk_room_people CHECK (occupant_count IS NULL OR occupant_count > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fit_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED NULL,
    product_id BIGINT UNSIGNED NULL,
    rule_key VARCHAR(80) NOT NULL,
    title VARCHAR(150) NOT NULL,
    left_source ENUM('ROOM_FIELD', 'PRODUCT_ATTRIBUTE') NOT NULL,
    left_key VARCHAR(100) NOT NULL,
    operator ENUM('LT', 'LTE', 'EQ', 'GTE', 'GT') NOT NULL,
    right_source ENUM('ROOM_FIELD', 'PRODUCT_ATTRIBUTE', 'CONSTANT') NOT NULL,
    right_key VARCHAR(100) NULL,
    right_value DECIMAL(15, 4) NULL,
    margin_value DECIMAL(15, 4) NOT NULL DEFAULT 0,
    unit ENUM('mm', 'm2', 'boolean', 'people') NOT NULL,
    severity ENUM('BLOCK', 'WARN') NOT NULL,
    pass_message VARCHAR(255) NOT NULL,
    fail_message VARCHAR(255) NOT NULL,
    missing_message VARCHAR(255) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fit_category_rule (category_id, rule_key),
    UNIQUE KEY uq_fit_product_rule (product_id, rule_key),
    KEY idx_fit_category_status (category_id, status),
    KEY idx_fit_product_status (product_id, status),
    CONSTRAINT fk_fit_category FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT fk_fit_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_fit_editor FOREIGN KEY (updated_by) REFERENCES users(id),
    CONSTRAINT chk_fit_scope CHECK ((category_id IS NULL) <> (product_id IS NULL)),
    CONSTRAINT chk_fit_right CHECK (
        (right_source = 'CONSTANT' AND right_key IS NULL AND right_value IS NOT NULL)
        OR (right_source <> 'CONSTANT' AND right_key IS NOT NULL AND right_value IS NULL)
    ),
    CONSTRAINT chk_fit_margin CHECK (margin_value >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE care_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED NULL,
    product_id BIGINT UNSIGNED NULL,
    rule_key VARCHAR(80) NOT NULL,
    title VARCHAR(150) NOT NULL,
    instructions TEXT NOT NULL,
    first_due_days SMALLINT UNSIGNED NOT NULL,
    interval_days SMALLINT UNSIGNED NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_care_category_rule (category_id, rule_key),
    UNIQUE KEY uq_care_product_rule (product_id, rule_key),
    CONSTRAINT fk_care_category FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT fk_care_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_care_editor FOREIGN KEY (updated_by) REFERENCES users(id),
    CONSTRAINT chk_care_scope CHECK ((category_id IS NULL) <> (product_id IS NULL)),
    CONSTRAINT chk_care_interval CHECK (interval_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE owned_devices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    unit_number INT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    variant_id BIGINT UNSIGNED NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    sku_snapshot VARCHAR(80) NOT NULL,
    purchased_at DATETIME NOT NULL,
    completed_at DATETIME NOT NULL,
    warranty_months_snapshot SMALLINT UNSIGNED NOT NULL,
    warranty_start_date DATE NULL,
    serial_number VARCHAR(100) NULL,
    manual_url VARCHAR(500) NULL,
    status ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_owned_order_unit (order_item_id, unit_number),
    KEY idx_owned_customer_status (customer_id, status),
    CONSTRAINT fk_owned_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_owned_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
    CONSTRAINT fk_owned_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_owned_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    CONSTRAINT chk_owned_unit CHECK (unit_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE care_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owned_device_id BIGINT UNSIGNED NOT NULL,
    care_rule_id BIGINT UNSIGNED NOT NULL,
    cycle_number INT UNSIGNED NOT NULL,
    original_due_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('DUE', 'COMPLETED', 'POSTPONED') NOT NULL DEFAULT 'DUE',
    completed_at DATETIME NULL,
    postpone_reason VARCHAR(255) NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_care_device_cycle (owned_device_id, care_rule_id, cycle_number),
    KEY idx_care_due (status, due_date),
    CONSTRAINT fk_task_device FOREIGN KEY (owned_device_id) REFERENCES owned_devices(id),
    CONSTRAINT fk_task_rule FOREIGN KEY (care_rule_id) REFERENCES care_rules(id),
    CONSTRAINT fk_task_actor FOREIGN KEY (updated_by) REFERENCES users(id),
    CONSTRAINT chk_task_cycle CHECK (cycle_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE decision_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_key CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    event_type ENUM('FIT_CHECK', 'TCO') NOT NULL,
    fit_result ENUM('FIT', 'NEEDS_CHECK', 'NOT_FIT') NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_decision_request (request_key),
    KEY idx_decision_type_date (event_type, created_at),
    CONSTRAINT fk_decision_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_decision_result CHECK (
        (event_type = 'FIT_CHECK' AND fit_result IS NOT NULL)
        OR (event_type = 'TCO' AND fit_result IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
