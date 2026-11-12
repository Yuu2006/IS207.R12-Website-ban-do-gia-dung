<?php
declare(strict_types=1);

// Reads public, active catalog SKUs with their current effective price and stock count.
final class ChatbotModel
{
    public function __construct(private PDO $pdo) {}

    // Validate that a category filter still refers to a public, active catalog category.
    public function activeCategoryExists(string $categoryId): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM categories WHERE id = ? AND is_active = 1 AND is_deleted = 0');
        $statement->execute([$categoryId]);
        return $statement->fetchColumn() !== false;
    }

    // Active category for a whitelisted slug; null means the catalog does not sell that group now.
    public function activeCategoryBySlug(string $slug): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, name, slug FROM categories WHERE slug = ? AND is_active = 1 AND is_deleted = 0');
        $statement->execute([$slug]);
        return $statement->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function activeBrands(): array
    {
        return $this->pdo->query('SELECT id, name FROM brands WHERE is_active = 1 AND is_deleted = 0 ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
    }

    // Active products of one category with every active SKU (effective price, stock) and whitelisted numeric/boolean specs.
    public function recommendCandidates(string $categoryId, array $specKeys): array
    {
        $statement = $this->pdo->prepare("SELECT p.id AS product_id, p.name AS product_name, p.warranty_months, b.id AS brand_id, b.name AS brand_name,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 AND pi.is_deleted = 0 ORDER BY pi.id DESC LIMIT 1) AS image_url,
                v.id AS variant_id, v.sku, v.variant_name, v.stock_quantity,
                CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                    AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) AND v.sale_price < v.price THEN v.sale_price ELSE v.price END AS current_price
            FROM products p
            JOIN categories c ON c.id = p.category_id AND c.is_active = 1 AND c.is_deleted = 0
            JOIN brands b ON b.id = p.brand_id AND b.is_active = 1 AND b.is_deleted = 0
            JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1 AND v.is_deleted = 0
            WHERE p.is_active = 1 AND p.is_deleted = 0 AND p.category_id = ?
            ORDER BY p.id, v.id");
        $statement->execute([$categoryId]);
        $products = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $id = (string) $row['product_id'];
            $products[$id] ??= ['productId' => $id, 'productName' => $row['product_name'], 'brandId' => (string) $row['brand_id'], 'brandName' => $row['brand_name'],
                'imageUrl' => $row['image_url'], 'warrantyMonths' => $row['warranty_months'] === null ? null : (int) $row['warranty_months'], 'variants' => [], 'specs' => []];
            // VND prices are whole numbers; keep the integer part without a float round-trip.
            $products[$id]['variants'][] = ['variantId' => (string) $row['variant_id'], 'sku' => $row['sku'], 'variantName' => $row['variant_name'],
                'price' => (int) explode('.', (string) $row['current_price'])[0], 'stock' => (int) $row['stock_quantity']];
        }
        if ($products === [] || $specKeys === []) return array_values($products);
        $ids = array_keys($products);
        $statement = $this->pdo->prepare('SELECT pav.product_id, pa.attribute_key, pa.data_type, pav.value_number, pav.value_boolean
            FROM product_attribute_values pav JOIN product_attributes pa ON pa.id = pav.attribute_id
            WHERE pa.category_id = ? AND pa.attribute_key IN (' . implode(',', array_fill(0, count($specKeys), '?')) . ')
                AND pav.product_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
        $statement->execute([$categoryId, ...$specKeys, ...$ids]);
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $value = $row['data_type'] === 'boolean' ? $row['value_boolean'] : $row['value_number'];
            if ($value !== null) $products[(string) $row['product_id']]['specs'][$row['attribute_key']] = $row['data_type'] === 'boolean' ? (int) $value : (string) $value;
        }
        return array_values($products);
    }

    public function activeFaqs(): array
    {
        return $this->pdo->query("SELECT id, question, answer, keywords, updated_at FROM chatbot_faqs WHERE status = 'ACTIVE' ORDER BY sort_order, id")->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listFaqs(): array
    {
        return $this->pdo->query('SELECT f.*, u.full_name AS updated_by_name FROM chatbot_faqs f JOIN users u ON u.id = f.updated_by ORDER BY f.sort_order, f.id')->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findFaq(int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT f.*, u.full_name AS updated_by_name FROM chatbot_faqs f JOIN users u ON u.id = f.updated_by WHERE f.id = ?');
        $statement->execute([$id]);
        return $statement->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function createFaq(array $values, int $actorId): array
    {
        $this->pdo->prepare('INSERT INTO chatbot_faqs (question, answer, keywords, status, sort_order, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$values['question'], $values['answer'], $values['keywords'], $values['status'], $values['sortOrder'], $actorId]);
        return $this->findFaq((int) $this->pdo->lastInsertId());
    }

    // Optimistic version check: a stale admin form cannot overwrite a newer approved answer.
    public function updateFaq(int $id, array $values, int $expectedVersion, int $actorId): ?array
    {
        $statement = $this->pdo->prepare('UPDATE chatbot_faqs SET question = ?, answer = ?, keywords = ?, status = ?, sort_order = ?, updated_by = ?, version = version + 1 WHERE id = ? AND version = ?');
        $statement->execute([$values['question'], $values['answer'], $values['keywords'], $values['status'], $values['sortOrder'], $actorId, $id, $expectedVersion]);
        return $statement->rowCount() === 1 ? $this->findFaq($id) : null;
    }

    public function searchCatalog(string $query, ?string $categoryId, int $limit): array
    {
        $sql = "SELECT p.id AS product_id, p.name AS product_name, p.product_code, p.slug, p.warranty_months,
                c.id AS category_id, c.name AS category_name, b.name AS brand_name,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 AND pi.is_deleted = 0 ORDER BY pi.id DESC LIMIT 1) AS image_url,
                v.id AS variant_id, v.sku, v.variant_name, v.stock_quantity,
                CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                    AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) AND v.sale_price < v.price THEN v.sale_price ELSE v.price END AS current_price,
                UTC_TIMESTAMP() AS checked_at
            FROM products p
            JOIN categories c ON c.id = p.category_id AND c.is_active = 1 AND c.is_deleted = 0
            JOIN brands b ON b.id = p.brand_id AND b.is_active = 1 AND b.is_deleted = 0
            JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1 AND v.is_deleted = 0
            WHERE p.is_active = 1 AND p.is_deleted = 0";
        $parameters = [];
        if ($query !== '') {
            $pattern = '%' . strtr($query, ['=' => '==', '%' => '=%', '_' => '=_']) . '%';
            $sql .= " AND (p.name LIKE ? ESCAPE '=' OR p.product_code LIKE ? ESCAPE '=' OR v.sku LIKE ? ESCAPE '=' OR b.name LIKE ? ESCAPE '=' OR c.name LIKE ? ESCAPE '=')";
            array_push($parameters, $pattern, $pattern, $pattern, $pattern, $pattern);
        }
        if ($categoryId !== null) {
            $sql .= ' AND p.category_id = ?';
            $parameters[] = $categoryId;
        }
        $sql .= ' ORDER BY (v.stock_quantity > 0) DESC, p.name, v.id LIMIT ?';
        $statement = $this->pdo->prepare($sql);
        foreach ($parameters as $index => $value) $statement->bindValue($index + 1, $value, PDO::PARAM_STR);
        $statement->bindValue(count($parameters) + 1, $limit, PDO::PARAM_INT);
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $checkedAt = $rows[0]['checked_at'] ?? $this->pdo->query('SELECT UTC_TIMESTAMP()')->fetchColumn();
        return [
            'checkedAt' => str_replace(' ', 'T', (string) $checkedAt) . 'Z',
            'items' => array_map(static fn (array $row): array => [
                'productId' => (string) $row['product_id'], 'productName' => $row['product_name'],
                'productCode' => $row['product_code'], 'slug' => $row['slug'],
                'categoryId' => (string) $row['category_id'], 'categoryName' => $row['category_name'],
                'brandName' => $row['brand_name'], 'warrantyMonths' => $row['warranty_months'] === null ? null : (int) $row['warranty_months'],
                'imageUrl' => $row['image_url'], 'variantId' => (string) $row['variant_id'],
                'sku' => $row['sku'], 'variantName' => $row['variant_name'],
                'currentPrice' => (string) $row['current_price'], 'stockQuantity' => (int) $row['stock_quantity'],
                'availability' => (int) $row['stock_quantity'] > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                'href' => '/catalog/products/' . rawurlencode((string) $row['product_id']) . '?variantId=' . rawurlencode((string) $row['variant_id']),
            ], $rows),
        ];
    }
}
