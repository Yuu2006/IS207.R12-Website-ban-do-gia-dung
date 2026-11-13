-- STT 28: index cho các truy vấn báo cáo/dashboard đã kiểm tra bằng EXPLAIN trên dữ liệu seed (12/11/2026).
-- Áp một lần sau 015 (và 012 cho decision_events). Chỉ thêm index, không đổi dữ liệu.
-- Dashboard/CSV lọc đơn theo placed_at (trước: quét toàn bảng orders).
ALTER TABLE orders ADD INDEX idx_orders_placed_at (placed_at);
-- Mốc ghi nhận doanh thu = lần đầu đơn chuyển COMPLETED (trước: quét toàn index order_id).
ALTER TABLE order_status_history ADD INDEX idx_status_history_status_order (status, order_id, changed_at);
-- Đếm lượt FitCheck/TCO theo kỳ không lọc event_type (trước: quét toàn bảng).
ALTER TABLE decision_events ADD INDEX idx_decision_created (created_at);
