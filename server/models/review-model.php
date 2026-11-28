<?php
declare(strict_types=1);

class ReviewModel
{
    public function __construct(private PDO $pdo) {}

    // Public reads exclude hidden/deleted reviews and never return a buyer's account identifiers.
    public function listPublic(int $productId, array $filters, int $page, int $pageSize): array
    {
        $where = ['pv.product_id = ?', 'pr.is_visible = 1', 'pr.is_deleted = 0', 'oi.is_deleted = 0'];
        $values = [$productId];
        foreach (['rating' => 'pr.rating', 'usageFrequency' => 'pr.usage_frequency', 'noisePerception' => 'pr.noise_perception', 'consumptionPerception' => 'pr.consumption_perception', 'cleaningEase' => 'pr.cleaning_ease'] as $key => $column) {
            if (($filters[$key] ?? '') !== '') { $where[] = $column . ' = ?'; $values[] = $filters[$key]; }
        }
        if (($filters['minRoomAreaM2'] ?? '') !== '') { $where[] = 'pr.room_area_m2 >= ?'; $values[] = $filters['minRoomAreaM2']; }
        if (($filters['maxRoomAreaM2'] ?? '') !== '') { $where[] = 'pr.room_area_m2 <= ?'; $values[] = $filters['maxRoomAreaM2']; }
        if (($filters['householdSize'] ?? '') !== '') { $where[] = 'pr.household_size = ?'; $values[] = $filters['householdSize']; }
        $clause = implode(' AND ', $where);
        $count = $this->pdo->prepare("SELECT COUNT(*) FROM product_reviews pr JOIN order_items oi ON oi.id = pr.order_item_id JOIN product_variants pv ON pv.id = oi.variant_id WHERE {$clause}");
        $count->execute($values);
        $stmt = $this->pdo->prepare("SELECT pr.id, pr.rating, pr.content, pr.room_area_m2, pr.household_size, pr.usage_frequency, pr.noise_perception, pr.consumption_perception, pr.cleaning_ease, pr.created_at, oi.product_name
            FROM product_reviews pr JOIN order_items oi ON oi.id = pr.order_item_id JOIN product_variants pv ON pv.id = oi.variant_id WHERE {$clause}
            ORDER BY pr.created_at DESC, pr.id DESC LIMIT ? OFFSET ?");
        $stmt->execute([...$values, $pageSize, ($page - 1) * $pageSize]);
        $items = $stmt->fetchAll();
        $this->attachPhotos($items);
        $this->attachFollowups($items, false);
        return ['items' => $items, 'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'total' => (int) $count->fetchColumn()]];
    }

    // Only completed order lines belonging to the current customer can be reviewed or updated.
    public function eligibleItems(int $customerId, int $productId): array
    {
        $stmt = $this->pdo->prepare("SELECT oi.id AS order_item_id, oi.product_name, oi.sku, o.order_code, pr.id AS review_id,
                (SELECT MIN(h.changed_at) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'COMPLETED' AND h.is_deleted = 0) AS completed_at,
                (SELECT TIMESTAMPDIFF(DAY, MIN(h.changed_at), UTC_TIMESTAMP()) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'COMPLETED' AND h.is_deleted = 0) AS days_since_completed
            FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN product_variants pv ON pv.id = oi.variant_id
            LEFT JOIN product_reviews pr ON pr.order_item_id = oi.id AND pr.is_deleted = 0
            WHERE o.customer_id = ? AND o.order_status = 'COMPLETED' AND o.is_deleted = 0 AND oi.is_deleted = 0 AND pv.product_id = ?
            ORDER BY o.placed_at DESC, oi.id DESC");
        $stmt->execute([$customerId, $productId]);
        $items = $stmt->fetchAll();
        $reviewIds = array_values(array_filter(array_map(static fn(array $item): ?int => $item['review_id'] === null ? null : (int) $item['review_id'], $items)));
        if ($reviewIds) {
            $marks = implode(',', array_fill(0, count($reviewIds), '?'));
            $followups = $this->pdo->prepare("SELECT review_id, milestone_days FROM product_review_followups WHERE review_id IN ({$marks})");
            $followups->execute($reviewIds);
            $done = [];
            foreach ($followups->fetchAll() as $row) $done[(int) $row['review_id']][] = (int) $row['milestone_days'];
        } else $done = [];
        foreach ($items as &$item) {
            $item['orderItemId'] = (int) $item['order_item_id'];
            $item['reviewId'] = $item['review_id'] === null ? null : (int) $item['review_id'];
            $item['completedAt'] = $item['completed_at'];
            $item['followupDays'] = [];
            if ($item['reviewId'] !== null) {
                $age = $item['days_since_completed'] === null ? -1 : max(0, (int) $item['days_since_completed']);
                foreach ([30, 90] as $milestone) {
                    $windowOpen = $milestone === 30 ? $age >= 30 && $age < 90 : $age >= 90;
                    if ($windowOpen && !in_array($milestone, $done[$item['reviewId']] ?? [], true)) $item['followupDays'][] = $milestone;
                }
            }
            unset($item['order_item_id'], $item['review_id'], $item['completed_at'], $item['days_since_completed']);
        }
        return $items;
    }

    // The transaction locks the order line before checking eligibility and inserts the immutable first review.
    public function createReview(int $customerId, array $review, array $photos): array
    {
        $this->pdo->beginTransaction();
        try {
            $purchase = $this->purchaseRow($customerId, $review['orderItemId'], true);
            if (!$purchase) throw new ApiException('Chỉ có thể đánh giá sản phẩm trong đơn hàng đã hoàn thành của bạn.', 403);
            $exists = $this->pdo->prepare('SELECT id FROM product_reviews WHERE order_item_id = ? AND is_deleted = 0 FOR UPDATE');
            $exists->execute([$review['orderItemId']]);
            if ($exists->fetchColumn()) throw new ApiException('Sản phẩm trong đơn này đã được đánh giá.', 409);
            $insert = $this->pdo->prepare('INSERT INTO product_reviews (order_item_id, customer_id, rating, content, room_area_m2, household_size, usage_frequency, noise_perception, consumption_perception, cleaning_ease, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
            $insert->execute([$review['orderItemId'], $customerId, $review['rating'], $review['content'], $review['context']['roomAreaM2'], $review['context']['householdSize'], $review['context']['usageFrequency'], $review['context']['noisePerception'], $review['context']['consumptionPerception'], $review['context']['cleaningEase']]);
            $id = (int) $this->pdo->lastInsertId();
            $this->insertPhotos($id, $photos);
            $this->pdo->commit();
            return ['id' => $id, 'productName' => $purchase['product_name'], 'rating' => $review['rating'], 'createdAt' => gmdate('Y-m-d\TH:i:s\Z')];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            if ($error instanceof PDOException && $error->getCode() === '23000') throw new ApiException('Sản phẩm trong đơn này đã được đánh giá.', 409);
            throw $error;
        }
    }

    // The 30-day reflection is available from day 30 up to day 89; the 90-day reflection starts on day 90.
    public function createFollowup(int $customerId, int $reviewId, int $milestone, array $context): array
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("SELECT pr.id,
                    (SELECT MIN(h.changed_at) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'COMPLETED' AND h.is_deleted = 0) AS completed_at,
                    (SELECT TIMESTAMPDIFF(DAY, MIN(h.changed_at), UTC_TIMESTAMP()) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'COMPLETED' AND h.is_deleted = 0) AS days_since_completed
                FROM product_reviews pr JOIN order_items oi ON oi.id = pr.order_item_id JOIN orders o ON o.id = oi.order_id
                WHERE pr.id = ? AND pr.customer_id = ? AND pr.is_deleted = 0 AND o.order_status = 'COMPLETED' AND o.is_deleted = 0 AND oi.is_deleted = 0 FOR UPDATE");
            $stmt->execute([$reviewId, $customerId]);
            $row = $stmt->fetch();
            if (!$row) throw new ApiException('Không tìm thấy đánh giá của bạn.', 404);
            if ($row['completed_at'] === null || $row['days_since_completed'] === null) throw new ApiException('Đơn chưa có mốc hoàn thành để xác định thời điểm cập nhật.', 409);
            $age = max(0, (int) $row['days_since_completed']);
            $available = $milestone === 30 ? $age >= 30 && $age < 90 : $age >= 90;
            if (!$available) throw new ApiException('Chưa đến thời điểm cập nhật trải nghiệm này.', 409);
            $insert = $this->pdo->prepare('INSERT INTO product_review_followups (review_id, milestone_days, room_area_m2, household_size, usage_frequency, noise_perception, consumption_perception, cleaning_ease, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
            $insert->execute([$reviewId, $milestone, $context['roomAreaM2'], $context['householdSize'], $context['usageFrequency'], $context['noisePerception'], $context['consumptionPerception'], $context['cleaningEase']]);
            $this->pdo->commit();
            return ['reviewId' => $reviewId, 'milestoneDays' => $milestone, 'createdAt' => gmdate('Y-m-d\TH:i:s\Z')];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            if ($error instanceof PDOException && $error->getCode() === '23000') throw new ApiException('Cập nhật trải nghiệm ở mốc này đã được gửi.', 409);
            throw $error;
        }
    }

    // ADMIN may change visibility only; the original content is never exposed to a write query.
    public function setVisibility(int $reviewId, int $actorId, bool $visible, string $reason): array
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('SELECT is_visible FROM product_reviews WHERE id = ? AND is_deleted = 0 FOR UPDATE');
            $stmt->execute([$reviewId]);
            $before = $stmt->fetchColumn();
            if ($before === false) throw new ApiException('Không tìm thấy đánh giá.', 404);
            $this->pdo->prepare('UPDATE product_reviews SET is_visible = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$visible ? 1 : 0, $reviewId]);
            $audit = $this->pdo->prepare("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, 'product_review', ?, ?, UTC_TIMESTAMP())");
            $audit->execute([$actorId, $visible ? 'REVIEW_RESTORE' : 'REVIEW_HIDE', $reviewId, json_encode(['fromVisible' => (bool) $before, 'toVisible' => $visible, 'reason' => $reason], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
            $this->pdo->commit();
            return ['id' => $reviewId, 'isVisible' => $visible];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    // Moderation listing includes hidden content but exposes no customer name, email, or phone.
    public function listAdmin(array $filters, int $page, int $pageSize): array
    {
        $where = ['pr.is_deleted = 0']; $values = [];
        if (($filters['visibility'] ?? '') === 'visible') $where[] = 'pr.is_visible = 1';
        if (($filters['visibility'] ?? '') === 'hidden') $where[] = 'pr.is_visible = 0';
        if (($filters['rating'] ?? '') !== '') { $where[] = 'pr.rating = ?'; $values[] = $filters['rating']; }
        $clause = implode(' AND ', $where);
        $count = $this->pdo->prepare("SELECT COUNT(*) FROM product_reviews pr WHERE {$clause}"); $count->execute($values);
        $stmt = $this->pdo->prepare("SELECT pr.id, pr.rating, pr.content, pr.is_visible, pr.created_at, pr.room_area_m2, pr.household_size, pr.usage_frequency, pr.noise_perception, pr.consumption_perception, pr.cleaning_ease, oi.product_name, oi.sku
            FROM product_reviews pr JOIN order_items oi ON oi.id = pr.order_item_id WHERE {$clause} ORDER BY pr.created_at DESC, pr.id DESC LIMIT ? OFFSET ?");
        $stmt->execute([...$values, $pageSize, ($page - 1) * $pageSize]); $items = $stmt->fetchAll();
        $this->attachPhotos($items);
        $this->attachFollowups($items, true);
        return ['items' => $items, 'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'total' => (int) $count->fetchColumn()]];
    }

    private function purchaseRow(int $customerId, int $orderItemId, bool $lock): ?array
    {
        $suffix = $lock ? ' FOR UPDATE' : '';
        $stmt = $this->pdo->prepare("SELECT oi.id, oi.product_name FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? AND o.customer_id = ? AND o.order_status = 'COMPLETED' AND o.is_deleted = 0 AND oi.is_deleted = 0{$suffix}");
        $stmt->execute([$orderItemId, $customerId]);
        return $stmt->fetch() ?: null;
    }

    private function insertPhotos(int $reviewId, array $photos): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO product_review_photos (review_id, photo_url, sort_order, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())');
        foreach ($photos as $index => $url) $stmt->execute([$reviewId, $url, $index]);
    }

    private function attachPhotos(array &$items): void
    {
        if (!$items) return;
        $ids = array_map(static fn(array $item): int => (int) $item['id'], $items);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("SELECT review_id, photo_url FROM product_review_photos WHERE review_id IN ({$marks}) ORDER BY sort_order, id");
        $stmt->execute($ids); $photos = [];
        foreach ($stmt->fetchAll() as $row) $photos[(int) $row['review_id']][] = $row['photo_url'];
        foreach ($items as &$item) $item['photos'] = $photos[(int) $item['id']] ?? [];
    }

    private function attachFollowups(array &$items, bool $moderation): void
    {
        if (!$items) return;
        $ids = array_map(static fn(array $item): int => (int) $item['id'], $items);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("SELECT review_id, milestone_days, room_area_m2, household_size, usage_frequency, noise_perception, consumption_perception, cleaning_ease, created_at FROM product_review_followups WHERE review_id IN ({$marks}) ORDER BY milestone_days");
        $stmt->execute($ids); $entries = [];
        foreach ($stmt->fetchAll() as $row) {
            $item = ['milestoneDays' => (int) $row['milestone_days'], 'context' => ['roomAreaM2' => $row['room_area_m2'], 'householdSize' => $row['household_size'] === null ? null : (int) $row['household_size'], 'usageFrequency' => $row['usage_frequency'], 'noisePerception' => $row['noise_perception'], 'consumptionPerception' => $row['consumption_perception'], 'cleaningEase' => $row['cleaning_ease']], 'createdAt' => $row['created_at']];
            $entries[(int) $row['review_id']][] = $item;
        }
        foreach ($items as &$item) {
            $item['followups'] = $entries[(int) $item['id']] ?? [];
            $item['isVisible'] = (bool) ($item['is_visible'] ?? true);
            unset($item['is_visible']);
        }
    }
}
