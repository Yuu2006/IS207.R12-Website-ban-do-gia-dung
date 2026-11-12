-- BOT-05 / ADM-BOT: FAQ and policy answers approved by ADMIN for the rule-based chatbot.
-- Apply once after 011_auth_catalog_completion.sql; review and back up the target database first.
-- Only ACTIVE rows are answered publicly. No policy content is seeded: the admin team must enter approved text.
CREATE TABLE chatbot_faqs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    question VARCHAR(200) NOT NULL,
    answer VARCHAR(2000) NOT NULL,
    keywords VARCHAR(500) NOT NULL,
    status ENUM('DRAFT', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'DRAFT',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_chatbot_faqs_status_order (status, sort_order, id),
    CONSTRAINT fk_chatbot_faqs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
