-- Apply after 008_order_runtime.sql and 013_checkout_runtime.sql, before enabling VNPAY checkout.
-- Existing payment rows remain unchanged; only VNPay attempts receive an expiry.
ALTER TABLE payments
    ADD COLUMN expires_at DATETIME NULL,
    ADD COLUMN provider_response_code VARCHAR(10) NULL,
    ADD COLUMN callback_received_at DATETIME NULL,
    ADD INDEX idx_vnpay_expiry (payment_method, status, expires_at, is_deleted);
