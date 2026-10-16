
CREATE TABLE IF NOT EXISTS product_attribute_values (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    attribute_id BIGINT UNSIGNED NOT NULL,

    value_text TEXT DEFAULT NULL,
    value_number DECIMAL(15, 4) DEFAULT NULL,
    value_boolean TINYINT(1) DEFAULT NULL,

    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_product_attribute (
        product_id,
        attribute_id
    ),

    KEY idx_attribute_values_attribute (attribute_id),

    CONSTRAINT fk_attribute_values_product
        FOREIGN KEY (product_id)
        REFERENCES products (id),

    CONSTRAINT fk_attribute_values_attribute
        FOREIGN KEY (attribute_id)
        REFERENCES product_attributes (id),

    CONSTRAINT chk_attribute_value_single_type
        CHECK (
            (value_text IS NOT NULL)
            + (value_number IS NOT NULL)
            + (value_boolean IS NOT NULL) = 1
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
