-- Apply after the reviewed 015 return lifecycle schema; one return request remains allowed per order.
-- Normalize selected order lines/quantities and customer evidence so approval and receipt can inspect exact returned units.
CREATE TABLE order_return_request_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    return_request_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    resalable_quantity INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_return_order_item (return_request_id, order_item_id),
    KEY idx_return_request_items_item (order_item_id),
    CONSTRAINT chk_return_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_return_resalable_quantity CHECK (resalable_quantity IS NULL OR resalable_quantity <= quantity),
    CONSTRAINT fk_return_request_item_request FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id),
    CONSTRAINT fk_return_request_item_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_return_photos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    return_request_id BIGINT UNSIGNED NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_return_photo (return_request_id, photo_url),
    KEY idx_return_photos_order (return_request_id, sort_order, id),
    CONSTRAINT fk_return_photo_request FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
