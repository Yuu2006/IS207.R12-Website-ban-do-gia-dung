USE household_ecommerce;

-- Danh muc
INSERT INTO categories (name, slug)
VALUES
('Gia dung nha bep', 'gia-dung-nha-bep'),
('Thiet bi lam sach', 'thiet-bi-lam-sach'),
('Thiet bi loc nuoc', 'thiet-bi-loc-nuoc')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Thuong hieu
INSERT INTO brands (name)
VALUES
('HomeCare'),
('Sunhouse'),
('Philips')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- San pham
INSERT INTO products (
    category_id, brand_id, product_code, name, slug,
    description, specifications, warranty_months
)
SELECT
    c.id, b.id, 'HC-001', 'Noi chien khong dau HomeCare',
    'noi-chien-khong-dau-homecare',
    'Noi chien khong dau dung cho gia dinh',
    JSON_OBJECT('power_watts', 1500, 'capacity_liters', 5),
    12
FROM categories c
JOIN brands b ON b.name = 'HomeCare'
WHERE c.slug = 'gia-dung-nha-bep'
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- SKU / bien the
INSERT INTO product_variants (
    product_id, sku, variant_name, price, stock_quantity
)
SELECT
    p.id, 'HC-001-01', 'Dung tich 5 lit', 1290000, 20
FROM products p
WHERE p.product_code = 'HC-001'
ON DUPLICATE KEY UPDATE
    variant_name = VALUES(variant_name),
    price = VALUES(price);

-- Thuoc tinh dong theo danh muc
INSERT INTO product_attributes (
    category_id, name, attribute_key, data_type, unit, is_required
)
SELECT c.id, 'Cong suat', 'cong_suat', 'number', 'W', 1
FROM categories c
WHERE c.slug = 'gia-dung-nha-bep'
ON DUPLICATE KEY UPDATE name = VALUES(name);
-- Gia tri thong so dong cho san pham demo
INSERT INTO product_attribute_values (
    product_id,
    attribute_id,
    value_number
)
SELECT
    p.id,
    a.id,
    1500
FROM products p
JOIN product_attributes a
    ON a.category_id = p.category_id
   AND a.attribute_key = 'cong_suat'
WHERE p.product_code = 'HC-001'
ON DUPLICATE KEY UPDATE
    value_text = NULL,
    value_number = VALUES(value_number),
    value_boolean = NULL;