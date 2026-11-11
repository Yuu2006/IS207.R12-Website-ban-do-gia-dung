-- Migration 016: giới hạn số lần sử dụng voucher theo khách hàng

ALTER TABLE vouchers
ADD COLUMN per_customer_limit INT UNSIGNED NULL
AFTER usage_limit;
