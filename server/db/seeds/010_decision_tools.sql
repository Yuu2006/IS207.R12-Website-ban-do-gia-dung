-- Seed 010 — HOME-01 / FIT-01 / CARE-01 / LIFE-01: phòng, quy tắc FitCheck, quy tắc bảo trì, thiết bị + lịch bảo trì, lượt dùng công cụ.
-- CẦN migration 012_decision_tools.sql đã áp dụng, và seeds 001, 003, 004, 008 (đơn COMPLETED). Viết tay; chạy lại an toàn (khóa UNIQUE / NOT EXISTS).
-- Dữ liệu MÔ PHỎNG. Khóa quy tắc (rule_key, left_key, right_key) là GIẢ ĐỊNH: ROOM_FIELD dùng tên cột room_profiles,
-- PRODUCT_ATTRIBUTE dùng attribute_key của seed 003/004. whitelist chính thức còn chờ nhóm chốt (docs/api/DECISION-TOOLS.md).
USE household_ecommerce;

-- ===== HOME-01: hồ sơ không gian (NULL = chưa biết, khác 0/false) =====
INSERT INTO room_profiles (user_id, name, placement_width_mm, placement_depth_mm, placement_height_mm, door_width_mm, floor_area_m2, occupant_count, power_available, water_supply, drainage, is_default)
SELECT u.id, r.name, r.w, r.d, r.h, r.door, r.area, r.people, r.pw, r.water, r.drain, r.is_default
FROM users u JOIN (
    SELECT 'customer@example.test' AS email, 'Bếp chung cư (chỗ đặt tủ lạnh/máy giặt)' AS name, 700 AS w, 720 AS d, 1900 AS h, 800 AS door, 12.00 AS area, 4 AS people, 1 AS pw, 1 AS water, 1 AS drain, 1 AS is_default
    UNION ALL SELECT 'customer@example.test', 'Phòng ngủ chính (máy lạnh)', NULL, NULL, NULL, 800, 18.00, 2, 1, NULL, NULL, 0
    UNION ALL SELECT 'lan.tran@example.test', 'Căn hộ nhỏ', 600, 650, 1700, 700, 9.00, 2, 1, 1, 0, 1
    UNION ALL SELECT 'hung.le@example.test', 'Nhà phố', 950, 800, 2100, 900, 30.00, 5, 1, 1, 1, 1
    UNION ALL SELECT 'hung.le@example.test', 'Phòng chưa đo đạc', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0
) r ON r.email = u.email
WHERE NOT EXISTS (SELECT 1 FROM room_profiles p WHERE p.user_id = u.id AND p.name = r.name AND p.is_deleted = 0);

-- ===== FIT-01 / ADM-FIT-01: quy tắc theo danh mục (margin_value = khoảng hở cần chừa, cộng vào vế sản phẩm) =====
INSERT INTO fit_rules (category_id, rule_key, title, left_source, left_key, operator, right_source, right_key, right_value, margin_value, unit, severity, pass_message, fail_message, missing_message, updated_by)
SELECT c.id, r.rule_key, r.title, r.left_source, r.left_key, r.operator, r.right_source, r.right_key, r.right_value, r.margin_value, r.unit, r.severity, r.pass_message, r.fail_message, r.missing_message, u.id
FROM categories c JOIN users u ON u.email = 'admin@example.test' JOIN (
    SELECT 'tu-lanh' AS slug, 'fit_width' AS rule_key, 'Chiều rộng so với chỗ đặt' AS title, 'PRODUCT_ATTRIBUTE' AS left_source, 'width_mm' AS left_key, 'LTE' AS operator, 'ROOM_FIELD' AS right_source, 'placement_width_mm' AS right_key, NULL AS right_value, 50 AS margin_value, 'mm' AS unit, 'BLOCK' AS severity, 'Chiều rộng vừa chỗ đặt (đã chừa 50 mm hở).' AS pass_message, 'Chiều rộng tủ cộng khoảng hở vượt chỗ đặt.' AS fail_message, 'Thiếu chiều rộng chỗ đặt hoặc của sản phẩm.' AS missing_message
    UNION ALL SELECT 'tu-lanh', 'fit_depth', 'Chiều sâu so với chỗ đặt', 'PRODUCT_ATTRIBUTE', 'depth_mm', 'LTE', 'ROOM_FIELD', 'placement_depth_mm', NULL, 50, 'mm', 'BLOCK', 'Chiều sâu vừa chỗ đặt (đã chừa 50 mm cho tản nhiệt).', 'Chiều sâu tủ cộng khoảng hở vượt chỗ đặt.', 'Thiếu chiều sâu chỗ đặt hoặc của sản phẩm.'
    UNION ALL SELECT 'tu-lanh', 'fit_height', 'Chiều cao so với chỗ đặt', 'PRODUCT_ATTRIBUTE', 'height_mm', 'LTE', 'ROOM_FIELD', 'placement_height_mm', NULL, 20, 'mm', 'BLOCK', 'Chiều cao vừa chỗ đặt.', 'Chiều cao tủ vượt chiều cao chỗ đặt.', 'Thiếu chiều cao chỗ đặt hoặc của sản phẩm.'
    UNION ALL SELECT 'tu-lanh', 'fit_door', 'Qua được cửa vào nhà', 'PRODUCT_ATTRIBUTE', 'width_mm', 'LTE', 'ROOM_FIELD', 'door_width_mm', NULL, 20, 'mm', 'WARN', 'Thân tủ đi qua được cửa.', 'Thân tủ gần/vượt bề rộng cửa; cần kiểm tra đường vận chuyển.', 'Chưa biết bề rộng cửa; cần kiểm tra thêm.'
    UNION ALL SELECT 'may-giat', 'fit_width', 'Chiều rộng so với chỗ đặt', 'PRODUCT_ATTRIBUTE', 'width_mm', 'LTE', 'ROOM_FIELD', 'placement_width_mm', NULL, 20, 'mm', 'BLOCK', 'Chiều rộng vừa chỗ đặt.', 'Chiều rộng máy cộng khoảng hở vượt chỗ đặt.', 'Thiếu chiều rộng chỗ đặt hoặc của sản phẩm.'
    UNION ALL SELECT 'may-giat', 'fit_depth', 'Chiều sâu so với chỗ đặt', 'PRODUCT_ATTRIBUTE', 'depth_mm', 'LTE', 'ROOM_FIELD', 'placement_depth_mm', NULL, 50, 'mm', 'BLOCK', 'Chiều sâu vừa chỗ đặt (đã chừa chỗ ống nước).', 'Chiều sâu máy cộng khoảng hở vượt chỗ đặt.', 'Thiếu chiều sâu chỗ đặt hoặc của sản phẩm.'
    UNION ALL SELECT 'may-giat', 'fit_height', 'Chiều cao so với chỗ đặt', 'PRODUCT_ATTRIBUTE', 'height_mm', 'LTE', 'ROOM_FIELD', 'placement_height_mm', NULL, 10, 'mm', 'BLOCK', 'Chiều cao vừa chỗ đặt.', 'Chiều cao máy vượt chiều cao chỗ đặt.', 'Thiếu chiều cao chỗ đặt hoặc của sản phẩm.'
    UNION ALL SELECT 'may-giat', 'need_water', 'Có nguồn cấp nước', 'ROOM_FIELD', 'water_supply', 'EQ', 'CONSTANT', NULL, 1, 0, 'boolean', 'BLOCK', 'Có nguồn cấp nước.', 'Không có nguồn cấp nước tại chỗ đặt.', 'Chưa biết có nguồn cấp nước hay không.'
    UNION ALL SELECT 'may-giat', 'need_drainage', 'Có thoát nước', 'ROOM_FIELD', 'drainage', 'EQ', 'CONSTANT', NULL, 1, 0, 'boolean', 'BLOCK', 'Có thoát nước.', 'Không có đường thoát nước tại chỗ đặt.', 'Chưa biết có thoát nước hay không.'
    UNION ALL SELECT 'may-giat', 'need_power', 'Có nguồn điện', 'ROOM_FIELD', 'power_available', 'EQ', 'CONSTANT', NULL, 1, 0, 'boolean', 'BLOCK', 'Có ổ điện gần chỗ đặt.', 'Không có nguồn điện tại chỗ đặt.', 'Chưa biết có nguồn điện hay không.'
    UNION ALL SELECT 'may-lanh', 'fit_room_area', 'Diện tích phòng so với công suất', 'ROOM_FIELD', 'floor_area_m2', 'LTE', 'PRODUCT_ATTRIBUTE', 'room_area_max_m2', NULL, 0, 'm2', 'BLOCK', 'Diện tích phòng nằm trong khả năng làm lạnh.', 'Phòng lớn hơn diện tích tối đa máy phục vụ được.', 'Thiếu diện tích phòng hoặc diện tích tối đa của máy.'
    UNION ALL SELECT 'may-lanh', 'need_power', 'Có nguồn điện', 'ROOM_FIELD', 'power_available', 'EQ', 'CONSTANT', NULL, 1, 0, 'boolean', 'BLOCK', 'Có nguồn điện cho máy lạnh.', 'Không có nguồn điện tại vị trí lắp.', 'Chưa biết có nguồn điện hay không.'
) r ON r.slug = c.slug
ON DUPLICATE KEY UPDATE title = VALUES(title), left_source = VALUES(left_source), left_key = VALUES(left_key), operator = VALUES(operator), right_source = VALUES(right_source), right_key = VALUES(right_key), right_value = VALUES(right_value), margin_value = VALUES(margin_value), unit = VALUES(unit), severity = VALUES(severity), pass_message = VALUES(pass_message), fail_message = VALUES(fail_message), missing_message = VALUES(missing_message);

-- Quy tắc cấp sản phẩm ghi đè cấp danh mục (cùng rule_key): tủ Side by Side cần chừa hở rộng hơn.
INSERT INTO fit_rules (product_id, rule_key, title, left_source, left_key, operator, right_source, right_key, right_value, margin_value, unit, severity, pass_message, fail_message, missing_message, updated_by)
SELECT p.id, 'fit_width', 'Chiều rộng so với chỗ đặt (Side by Side)', 'PRODUCT_ATTRIBUTE', 'width_mm', 'LTE', 'ROOM_FIELD', 'placement_width_mm', NULL, 100, 'mm', 'BLOCK', 'Chiều rộng vừa chỗ đặt (đã chừa 100 mm mở cánh cửa).', 'Cần chừa 100 mm mở cánh cửa nhưng chỗ đặt không đủ.', 'Thiếu chiều rộng chỗ đặt hoặc của sản phẩm.', u.id
FROM products p JOIN users u ON u.email = 'admin@example.test' WHERE p.product_code = 'TL-012'
ON DUPLICATE KEY UPDATE margin_value = VALUES(margin_value), title = VALUES(title), pass_message = VALUES(pass_message), fail_message = VALUES(fail_message);

-- ===== ADM-CARE-01: quy tắc bảo trì =====
INSERT INTO care_rules (category_id, rule_key, title, instructions, first_due_days, interval_days, updated_by)
SELECT c.id, r.rule_key, r.title, r.instructions, r.first_due_days, r.interval_days, u.id
FROM categories c JOIN users u ON u.email = 'admin@example.test' JOIN (
    SELECT 'tu-lanh' AS slug, 'fridge_clean' AS rule_key, 'Vệ sinh khoang tủ và gioăng cửa' AS title, 'Rút điện, lấy thực phẩm ra, lau khoang bằng khăn ẩm và dung dịch nhẹ, lau gioăng cửa, để khô rồi cắm lại.' AS instructions, 90 AS first_due_days, 90 AS interval_days
    UNION ALL SELECT 'may-giat', 'drum_clean', 'Vệ sinh lồng giặt', 'Chạy chu trình vệ sinh lồng giặt (hoặc giặt nước nóng không đồ), lau gioăng cửa và khay xả nước giặt.', 30, 60
    UNION ALL SELECT 'may-lanh', 'filter_clean', 'Vệ sinh lưới lọc dàn lạnh', 'Tắt máy, tháo lưới lọc, rửa nước sạch, để khô hoàn toàn rồi lắp lại.', 60, 90
    UNION ALL SELECT 'may-lanh', 'service_deep', 'Bảo dưỡng tổng thể', 'Liên hệ kỹ thuật viên kiểm tra gas, vệ sinh dàn nóng/dàn lạnh và đường thoát nước ngưng.', 365, 365
) r ON r.slug = c.slug
ON DUPLICATE KEY UPDATE title = VALUES(title), instructions = VALUES(instructions), first_due_days = VALUES(first_due_days), interval_days = VALUES(interval_days);

-- ===== LIFE-01: thiết bị của tôi = mỗi đơn vị số lượng của đơn COMPLETED (giống bridge hoàn tất đơn). Đơn đã hoàn tiền không tạo thiết bị. =====
INSERT INTO owned_devices (customer_id, order_item_id, unit_number, product_id, variant_id, product_name_snapshot, sku_snapshot, purchased_at, completed_at, warranty_months_snapshot, status)
SELECT o.customer_id, oi.id, n.n, v.product_id, oi.variant_id, oi.product_name, oi.sku, o.placed_at, h.changed_at, oi.warranty_months, 'ACTIVE'
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN product_variants v ON v.id = oi.variant_id
JOIN order_status_history h ON h.order_id = o.id AND h.status = 'COMPLETED'
JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3) n ON n.n <= oi.quantity
WHERE o.order_code LIKE 'HC2026110%' AND o.order_status = 'COMPLETED' AND o.payment_status <> 'REFUNDED'
ON DUPLICATE KEY UPDATE status = owned_devices.status;

-- ===== CARE-01: chu kỳ 1 của mỗi quy tắc đang hoạt động; trạng thái chia theo id thiết bị để có đủ DUE / COMPLETED / POSTPONED =====
INSERT INTO care_tasks (owned_device_id, care_rule_id, cycle_number, original_due_date, due_date, status, completed_at, postpone_reason, updated_by)
SELECT x.device_id, x.rule_id, 1, x.due,
    CASE WHEN x.b = 2 THEN DATE_ADD(x.due, INTERVAL 14 DAY) ELSE x.due END,
    CASE WHEN x.b = 0 AND x.due <= UTC_DATE() THEN 'COMPLETED' WHEN x.b = 2 THEN 'POSTPONED' ELSE 'DUE' END,
    CASE WHEN x.b = 0 AND x.due <= UTC_DATE() THEN TIMESTAMP(x.due, '09:00:00') END,
    CASE WHEN x.b = 2 THEN 'Khách xin dời lịch do vắng nhà' END,
    CASE WHEN (x.b = 0 AND x.due <= UTC_DATE()) OR x.b = 2 THEN x.customer_id END
FROM (
    SELECT d.id AS device_id, d.customer_id, r.id AS rule_id, MOD(d.id, 3) AS b, DATE_ADD(DATE(d.completed_at), INTERVAL r.first_due_days DAY) AS due
    FROM owned_devices d
    JOIN order_items oi ON oi.id = d.order_item_id
    JOIN orders o ON o.id = oi.order_id AND o.order_code LIKE 'HC2026110%'
    JOIN products p ON p.id = d.product_id
    JOIN care_rules r ON r.category_id = p.category_id AND r.status = 'ACTIVE'
) x
ON DUPLICATE KEY UPDATE cycle_number = care_tasks.cycle_number;

-- ===== Lượt FitCheck / TCO (nguồn cho dashboard). request_key cố định để chạy lại không nhân đôi. =====
INSERT IGNORE INTO decision_events (request_key, user_id, event_type, fit_result, created_at) VALUES
    ('a0000000-0000-4000-8000-000000000001', (SELECT id FROM users WHERE email = 'customer@example.test'), 'FIT_CHECK', 'FIT', UTC_TIMESTAMP() - INTERVAL 20 DAY),
    ('a0000000-0000-4000-8000-000000000002', (SELECT id FROM users WHERE email = 'customer@example.test'), 'FIT_CHECK', 'NOT_FIT', UTC_TIMESTAMP() - INTERVAL 19 DAY),
    ('a0000000-0000-4000-8000-000000000003', (SELECT id FROM users WHERE email = 'customer@example.test'), 'FIT_CHECK', 'NEEDS_CHECK', UTC_TIMESTAMP() - INTERVAL 12 DAY),
    ('a0000000-0000-4000-8000-000000000004', (SELECT id FROM users WHERE email = 'lan.tran@example.test'), 'FIT_CHECK', 'NOT_FIT', UTC_TIMESTAMP() - INTERVAL 9 DAY),
    ('a0000000-0000-4000-8000-000000000005', (SELECT id FROM users WHERE email = 'lan.tran@example.test'), 'FIT_CHECK', 'NEEDS_CHECK', UTC_TIMESTAMP() - INTERVAL 8 DAY),
    ('a0000000-0000-4000-8000-000000000006', (SELECT id FROM users WHERE email = 'hung.le@example.test'), 'FIT_CHECK', 'FIT', UTC_TIMESTAMP() - INTERVAL 6 DAY),
    ('a0000000-0000-4000-8000-000000000007', (SELECT id FROM users WHERE email = 'hung.le@example.test'), 'FIT_CHECK', 'FIT', UTC_TIMESTAMP() - INTERVAL 5 DAY),
    ('a0000000-0000-4000-8000-000000000008', (SELECT id FROM users WHERE email = 'hung.le@example.test'), 'FIT_CHECK', 'NEEDS_CHECK', UTC_TIMESTAMP() - INTERVAL 2 DAY),
    ('a0000000-0000-4000-8000-000000000009', (SELECT id FROM users WHERE email = 'customer@example.test'), 'TCO', NULL, UTC_TIMESTAMP() - INTERVAL 18 DAY),
    ('a0000000-0000-4000-8000-00000000000a', (SELECT id FROM users WHERE email = 'lan.tran@example.test'), 'TCO', NULL, UTC_TIMESTAMP() - INTERVAL 7 DAY),
    ('a0000000-0000-4000-8000-00000000000b', (SELECT id FROM users WHERE email = 'mai.dang@example.test'), 'TCO', NULL, UTC_TIMESTAMP() - INTERVAL 3 DAY),
    ('a0000000-0000-4000-8000-00000000000c', NULL, 'TCO', NULL, UTC_TIMESTAMP() - INTERVAL 1 DAY);
