<?php
declare(strict_types=1);

/** Reads the active product, selected SKU, and approved appliance attributes used by TCO. */
final class TcoModel
{
    public function __construct(private PDO $pdo)
    {
    }

    /** Returns one public product/SKU pair, or null when either is inactive or does not belong to the product. */
    public function findActiveProductVariant(int $productId, int $variantId): ?array
    {
        $statement = $this->pdo->prepare(
            "SELECT
                p.id AS product_id,
                p.category_id,
                p.name AS product_name,
                p.slug AS product_slug,
                p.power_watts AS product_power_watts,
                c.name AS category_name,
                c.slug AS category_slug,
                v.id AS variant_id,
                v.sku,
                v.variant_name,
                CASE
                    WHEN v.sale_price IS NOT NULL
                     AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                     AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP())
                     AND v.sale_price < v.price
                    THEN v.sale_price
                    ELSE v.price
                END AS purchase_price
            FROM products p
            INNER JOIN categories c ON c.id = p.category_id
            INNER JOIN product_variants v ON v.product_id = p.id
            WHERE p.id = :product_id
              AND v.id = :variant_id
              AND p.is_active = 1
              AND COALESCE(p.is_deleted, 0) = 0
              AND c.is_active = 1
              AND COALESCE(c.is_deleted, 0) = 0
              AND v.is_active = 1
              AND COALESCE(v.is_deleted, 0) = 0
            LIMIT 1"
        );
        $statement->execute(['product_id' => $productId, 'variant_id' => $variantId]);
        $product = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            return null;
        }

        $attributeStatement = $this->pdo->prepare(
            "SELECT pa.attribute_key, pav.value_number
            FROM product_attributes pa
            LEFT JOIN product_attribute_values pav
                ON pav.attribute_id = pa.id AND pav.product_id = :product_id
            WHERE pa.category_id = :category_id
              AND pa.attribute_key IN ('energy_kwh_year', 'power_watts', 'water_liters_cycle')"
        );
        $attributeStatement->execute([
            'product_id' => $productId,
            'category_id' => (int) $product['category_id'],
        ]);

        $product['attributes'] = [];
        $product['defined_attributes'] = [];
        foreach ($attributeStatement->fetchAll(PDO::FETCH_ASSOC) as $attribute) {
            $key = $attribute['attribute_key'];
            $product['defined_attributes'][$key] = true;
            $product['attributes'][$key] = $attribute['value_number'];
        }

        return $product;
    }

    /** Records one successful TCO calculation; the request key prevents duplicate dashboard events. */
    public function recordCalculation(string $requestKey, ?int $userId): void
    {
        $this->pdo->beginTransaction();

        try {
            $insert = $this->pdo->prepare(
                "INSERT INTO decision_events (request_key, user_id, event_type, fit_result)
                VALUES (:request_key, :user_id, 'TCO', NULL)
                ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)"
            );
            $insert->execute(['request_key' => $requestKey, 'user_id' => $userId]);

            $lookup = $this->pdo->prepare(
                'SELECT user_id, event_type FROM decision_events WHERE request_key = :request_key LIMIT 1'
            );
            $lookup->execute(['request_key' => $requestKey]);
            $existing = $lookup->fetch(PDO::FETCH_ASSOC);

            $existingUserId = $existing && $existing['user_id'] !== null ? (int) $existing['user_id'] : null;
            if (!$existing || $existing['event_type'] !== 'TCO' || $existingUserId !== $userId) {
                throw new ApiException('requestKey đã được dùng cho một yêu cầu khác.', 409, ['requestKey' => 'Hãy tạo requestKey mới.']);
            }

            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }
}
