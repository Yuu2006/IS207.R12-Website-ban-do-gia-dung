-- STT 24: link maintenance guidance to real, currently managed catalog SKUs.
-- Apply after 012_decision_tools.sql; MySQL DDL commits implicitly. Review and apply once.
CREATE TABLE care_rule_supplies (
    care_rule_id BIGINT UNSIGNED NOT NULL,
    variant_id BIGINT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (care_rule_id, variant_id),
    KEY idx_care_rule_supply_variant (variant_id),
    CONSTRAINT fk_care_supply_rule FOREIGN KEY (care_rule_id) REFERENCES care_rules(id),
    CONSTRAINT fk_care_supply_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    CONSTRAINT chk_care_supply_sort CHECK (sort_order >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
