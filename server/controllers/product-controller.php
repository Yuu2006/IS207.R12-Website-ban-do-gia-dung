<?php

require_once __DIR__ . '/../models/product-model.php';

function listProducts(): void
{
    try {
        $filters = [
            'keyword' => trim($_GET['keyword'] ?? ''),
            'category_id' => $_GET['category_id'] ?? '',
            'brand_id' => $_GET['brand_id'] ?? '',
            'is_active' => $_GET['is_active'] ?? '',
        ];

        $products = getProducts($filters);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $products,
            'total' => count($products),
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy danh sách sản phẩm.',
        ], JSON_UNESCAPED_UNICODE);
    }
}

function showProduct(int $id): void
{
    try {
        $product = getProductById($id);

        if ($product === null) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy sản phẩm.',
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $product,
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy thông tin sản phẩm.',
        ], JSON_UNESCAPED_UNICODE);
    }
}
function createProduct(): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Dữ liệu JSON không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $required = [
        'category_id',
        'brand_id',
        'product_code',
        'name',
        'slug',
        'sku',
        'variant_name',
        'price'
    ];

    foreach ($required as $field) {
        if (!isset($input[$field]) || trim((string) $input[$field]) === '') {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'message' => "Thiếu trường bắt buộc: {$field}"
            ], JSON_UNESCAPED_UNICODE);
            return;
        }
    }

    if (!is_numeric($input['price']) || (float) $input['price'] < 0) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Giá sản phẩm phải là số không âm.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    try {
        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            INSERT INTO products (
                category_id, brand_id, product_code, name, slug,
                description, specifications, warranty_months
            ) VALUES (
                :category_id, :brand_id, :product_code, :name, :slug,
                :description, :specifications, :warranty_months
            )
        ");

        $stmt->execute([
            'category_id' => (int) $input['category_id'],
            'brand_id' => (int) $input['brand_id'],
            'product_code' => trim($input['product_code']),
            'name' => trim($input['name']),
            'slug' => trim($input['slug']),
            'description' => $input['description'] ?? null,
            'specifications' => isset($input['specifications'])
                ? json_encode($input['specifications'], JSON_UNESCAPED_UNICODE)
                : null,
            'warranty_months' => (int) ($input['warranty_months'] ?? 0),
        ]);

        $productId = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare("
            INSERT INTO product_variants (
                product_id, sku, variant_name, price
            ) VALUES (
                :product_id, :sku, :variant_name, :price
            )
        ");

        $stmt->execute([
            'product_id' => $productId,
            'sku' => trim($input['sku']),
            'variant_name' => trim($input['variant_name']),
            'price' => (string) $input['price'],
            // Tồn ban đầu luôn 0; nhập kho qua /api/inventory/movements để có log (WH-03).
        ]);

        $pdo->commit();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Tạo sản phẩm thành công.',
            'data' => getProductById($productId),
        ], JSON_UNESCAPED_UNICODE);

    } catch (PDOException $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log($e->getMessage());

        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Mã sản phẩm, slug hoặc SKU đã tồn tại; hoặc danh mục/thương hiệu không hợp lệ.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo sản phẩm.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Lỗi máy chủ.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
function updateProductRequest(int $id): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input) || empty($input)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Vui lòng gửi dữ liệu JSON cần cập nhật.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    try {
        $updated = updateProduct($id, $input);
        $product = getProductById($id);

        if ($product === null) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy sản phẩm.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Cập nhật sản phẩm thành công.',
            'data' => $product
        ], JSON_UNESCAPED_UNICODE);

    } catch (PDOException $e) {
        error_log($e->getMessage());

        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Mã sản phẩm hoặc slug đã tồn tại, hoặc danh mục/thương hiệu không hợp lệ.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật sản phẩm.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Lỗi máy chủ.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
function deleteProductRequest(int $id): void
{
    try {
        $deleted = deleteProduct($id);

        if (!$deleted) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Xóa mềm sản phẩm thành công.'
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể xóa sản phẩm.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
