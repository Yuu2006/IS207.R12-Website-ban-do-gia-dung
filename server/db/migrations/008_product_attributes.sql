CREATE TABLE IF NOT EXISTS product_attributes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    attribute_key VARCHAR(100) NOT NULL,
    data_type ENUM('text', 'number', 'boolean') NOT NULL DEFAULT 'text',
    unit VARCHAR(30) DEFAULT NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_category_attribute (category_id, attribute_key),
    CONSTRAINT fk_product_attributes_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;