<?php

require_once __DIR__ . '/../config/database.php';

/**
 * GET /api/categories/{id}/attributes
 * Lấy thuộc tính của một danh mục sản phẩm.
 */
function listProductAttributes(int $categoryId): void
{
    try {
        $pdo = db();

        // Kiểm tra danh mục có tồn tại và chưa bị xóa.
        $categoryStmt = $pdo->prepare("
            SELECT id, name
            FROM categories
            WHERE id = :id
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ");
        $categoryStmt->execute(['id' => $categoryId]);
        $category = $categoryStmt->fetch(PDO::FETCH_ASSOC);

        if (!$category) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy danh mục.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $stmt = $pdo->prepare("
            SELECT
                id,
                category_id,
                name,
                attribute_key,
                data_type,
                unit,
                is_required,
                created_at
            FROM product_attributes
            WHERE category_id = :category_id
            ORDER BY id ASC
        ");

        $stmt->execute(['category_id' => $categoryId]);
        $attributes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'category' => $category,
            'data' => $attributes,
            'total' => count($attributes)
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy thuộc tính sản phẩm.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * GET /api/products/{id}/attributes
 * Lấy giá trị thông số động của một sản phẩm.
 */
function getProductAttributeValues(int $productId): void
{
    try {
        $pdo = db();

        $stmt = $pdo->prepare("
            SELECT
                pa.id AS attribute_id,
                pa.name,
                pa.attribute_key,
                pa.data_type,
                pa.unit,
                pa.is_required,
                pav.value_text,
                pav.value_number,
                pav.value_boolean
            FROM products p
            INNER JOIN product_attributes pa
                ON pa.category_id = p.category_id
            LEFT JOIN product_attribute_values pav
                ON pav.product_id = p.id
                AND pav.attribute_id = pa.id
            WHERE p.id = :product_id
              AND COALESCE(p.is_deleted, 0) = 0
            ORDER BY pa.id ASC
        ");

        $stmt->execute(['product_id' => $productId]);
        $attributes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!$attributes) {
            $check = $pdo->prepare("
                SELECT id FROM products
                WHERE id = :id
                  AND COALESCE(is_deleted, 0) = 0
            ");
            $check->execute(['id' => $productId]);

            if (!$check->fetch()) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Không tìm thấy sản phẩm.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'product_id' => $productId,
            'data' => $attributes,
            'total' => count($attributes)
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy giá trị thuộc tính.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * PUT /api/products/{id}/attributes
 * Cập nhật giá trị thuộc tính cho sản phẩm.
 *
 * Body JSON:
 * {
 *   "attributes": [
 *     {"attribute_id": 1, "value": 1200}
 *   ]
 * }
 */
function updateProductAttributeValues(int $productId): void
{
    try {
        $input = json_decode(file_get_contents('php://input'), true);

        if (
            !is_array($input)
            || !isset($input['attributes'])
            || !is_array($input['attributes'])
        ) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Dữ liệu attributes không hợp lệ.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $pdo = db();

        $productStmt = $pdo->prepare("
            SELECT id, category_id
            FROM products
            WHERE id = :id
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ");
        $productStmt->execute(['id' => $productId]);
        $product = $productStmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy sản phẩm.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $attributeStmt = $pdo->prepare("
            SELECT id, attribute_key, data_type
            FROM product_attributes
            WHERE id = :id
              AND category_id = :category_id
        ");

        $upsert = $pdo->prepare("
            INSERT INTO product_attribute_values
                (product_id, attribute_id,
                 value_text, value_number, value_boolean)
            VALUES
                (:product_id, :attribute_id,
                 :value_text, :value_number, :value_boolean)
            ON DUPLICATE KEY UPDATE
                value_text = VALUES(value_text),
                value_number = VALUES(value_number),
                value_boolean = VALUES(value_boolean)
        ");

        $pdo->beginTransaction();

        foreach ($input['attributes'] as $item) {
            if (
                !is_array($item)
                || !isset($item['attribute_id'])
                || !array_key_exists('value', $item)
            ) {
                throw new InvalidArgumentException(
                    'Mỗi thuộc tính cần có attribute_id và value.'
                );
            }

            $attributeStmt->execute([
                'id' => (int) $item['attribute_id'],
                'category_id' => (int) $product['category_id']
            ]);
            $attribute = $attributeStmt->fetch(PDO::FETCH_ASSOC);

            if (!$attribute) {
                throw new InvalidArgumentException(
                    'Thuộc tính không thuộc danh mục của sản phẩm.'
                );
            }

            $valueText = null;
            $valueNumber = null;
            $valueBoolean = null;
            $value = $item['value'];

            if ($attribute['data_type'] === 'number') {
                if (!is_numeric($value)) {
                    throw new InvalidArgumentException(
                        'Giá trị phải là số cho thuộc tính '
                        . $attribute['attribute_key']
                    );
                }
                $valueNumber = $value;
            } elseif ($attribute['data_type'] === 'boolean') {
                if (!is_bool($value) && !in_array($value, [0, 1], true)) {
                    throw new InvalidArgumentException(
                        'Giá trị phải là true hoặc false cho thuộc tính '
                        . $attribute['attribute_key']
                    );
                }
                $valueBoolean = (int) $value;
            } else {
                if (!is_string($value)) {
                    throw new InvalidArgumentException(
                        'Giá trị phải là chuỗi cho thuộc tính '
                        . $attribute['attribute_key']
                    );
                }
                $valueText = $value;
            }

            $upsert->execute([
                'product_id' => $productId,
                'attribute_id' => (int) $attribute['id'],
                'value_text' => $valueText,
                'value_number' => $valueNumber,
                'value_boolean' => $valueBoolean
            ]);
        }

        $pdo->commit();

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Cập nhật thông số sản phẩm thành công.'
        ], JSON_UNESCAPED_UNICODE);

    } catch (InvalidArgumentException $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật thông số sản phẩm.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
