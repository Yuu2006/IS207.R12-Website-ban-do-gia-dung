-- Apply after 021_installation_checklists.sql and any intervening reviewed migrations.
-- Review text/rating stay immutable after submission; photos, context reflections and moderation history are separate records.
ALTER TABLE product_reviews
    ADD COLUMN room_area_m2 DECIMAL(8,2) NULL,
    ADD COLUMN household_size SMALLINT UNSIGNED NULL,
    ADD COLUMN usage_frequency VARCHAR(24) NULL,
    ADD COLUMN noise_perception VARCHAR(24) NULL,
    ADD COLUMN consumption_perception VARCHAR(32) NULL,
    ADD COLUMN cleaning_ease VARCHAR(24) NULL,
    ADD INDEX idx_reviews_context_rating (is_visible, is_deleted, rating, usage_frequency, cleaning_ease);

CREATE TABLE product_review_photos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    review_id BIGINT UNSIGNED NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_review_photo (review_id, photo_url),
    KEY idx_review_photos_order (review_id, sort_order, id),
    CONSTRAINT fk_review_photo_review FOREIGN KEY (review_id) REFERENCES product_reviews(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_review_followups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    review_id BIGINT UNSIGNED NOT NULL,
    milestone_days SMALLINT UNSIGNED NOT NULL,
    room_area_m2 DECIMAL(8,2) NOT NULL,
    household_size SMALLINT UNSIGNED NOT NULL,
    usage_frequency VARCHAR(24) NOT NULL,
    noise_perception VARCHAR(24) NOT NULL,
    consumption_perception VARCHAR(32) NOT NULL,
    cleaning_ease VARCHAR(24) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_review_followup_milestone (review_id, milestone_days),
    KEY idx_review_followup_timeline (review_id, created_at),
    CONSTRAINT chk_review_followup_milestone CHECK (milestone_days IN (30, 90)),
    CONSTRAINT fk_review_followup_review FOREIGN KEY (review_id) REFERENCES product_reviews(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
