<?php
declare(strict_types=1);

require_once __DIR__ . '/chatbot-rules.php';

// BOT-01..06 rule-based assistant over the live catalog and ADMIN-approved FAQ; no client-supplied price or stock is trusted.
final class ChatbotService
{
    private const FAQ_FIELDS = ['question', 'answer', 'keywords', 'status', 'sortOrder', 'expectedVersion'];

    public function __construct(private ChatbotModel $model) {}

    public function searchCatalog(array $query): array
    {
        foreach (array_keys($query) as $key) if (!in_array($key, ['q', 'categoryId', 'limit'], true)) throw new ApiException('Request chứa tham số không được hỗ trợ.', 422);
        $rawSearch = $query['q'] ?? '';
        if (!is_string($rawSearch)) throw new ApiException('Từ khóa tìm kiếm không hợp lệ.', 422);
        $search = trim($rawSearch);
        $searchLength = preg_match_all('/./us', $search);
        if ($searchLength === false || $searchLength > 100) throw new ApiException('Từ khóa tối đa 100 ký tự UTF-8 hợp lệ.', 422);
        $search = preg_replace('/điều\s+h(?:òa|hoà|hoa)/iu', 'máy lạnh', $search) ?? $search;
        $categoryId = null;
        if (isset($query['categoryId']) && $query['categoryId'] !== '') {
            if (!is_string($query['categoryId']) && !is_int($query['categoryId'])) throw new ApiException('Danh mục không hợp lệ.', 422);
            if (preg_match('/^[1-9][0-9]{0,19}$/D', (string) $query['categoryId']) !== 1) throw new ApiException('Danh mục không hợp lệ.', 422);
            $categoryId = (string) $query['categoryId'];
            if (!$this->model->activeCategoryExists($categoryId)) throw new ApiException('Danh mục không tồn tại hoặc đã ngừng hoạt động.', 422);
        }
        if ($search === '' && $categoryId === null) throw new ApiException('Nhập tên sản phẩm, SKU hoặc chọn danh mục để tìm.', 422);
        $rawLimit = $query['limit'] ?? 8;
        if (!is_string($rawLimit) && !is_int($rawLimit)) throw new ApiException('Số kết quả không hợp lệ.', 422);
        $limit = filter_var($rawLimit, FILTER_VALIDATE_INT);
        if ($limit === false || $limit < 1 || $limit > 12) throw new ApiException('Số kết quả cần nằm trong khoảng 1 đến 12.', 422);
        return $this->model->searchCatalog($search, $categoryId, $limit);
    }

    // Answer one message. Context is the slot state the previous reply returned, so follow-ups like "dưới 15 triệu" keep the category.
    public function reply(array $input): array
    {
        foreach (array_keys($input) as $key) if (!in_array($key, ['message', 'context'], true)) throw new ApiException('Request chứa trường không được hỗ trợ.', 422);
        $message = $input['message'] ?? null;
        if (!is_string($message) || trim($message) === '' || preg_match_all('/./us', $message) > 500) throw new ApiException('Câu hỏi cần từ 1 đến 500 ký tự.', 422, ['message' => 'Câu hỏi cần từ 1 đến 500 ký tự.']);
        $context = $this->validContext($input['context'] ?? null);
        $parsed = chatbotParse($message, $this->model->activeBrands());

        $hasProductSlots = $parsed['categories'] !== [] || $parsed['budgetMax'] !== null || $parsed['budgetMin'] !== null || $parsed['criteria'] !== [] || $parsed['roomAreaM2'] !== null || $parsed['brandIds'] !== [];
        if (!$hasProductSlots && !$parsed['compare']) {
            $faq = chatbotMatchFaq($message, $this->model->activeFaqs());
            if ($faq) return $this->answer('FAQ', 'ANSWERED', $faq['answer'], 'Bạn muốn hỏi thêm về chính sách nào, hay cần gợi ý sản phẩm?', $context, [
                'faq' => ['id' => (string) $faq['id'], 'question' => $faq['question'], 'updatedAt' => str_replace(' ', 'T', (string) $faq['updated_at']) . 'Z'],
            ]);
        }
        if (count($parsed['categories']) > 1) return $this->answer('RECOMMEND', 'NEEDS_CLARIFICATION', 'Bạn đang nhắc tới nhiều nhóm hàng cùng lúc.', 'Bạn muốn xem tủ lạnh, máy giặt hay máy lạnh trước?', $context);

        $slots = [
            'category' => $parsed['categories'][0] ?? $context['category'],
            'budgetMin' => $parsed['budgetMin'] ?? ($parsed['budgetMax'] === null ? $context['budgetMin'] : null),
            'budgetMax' => $parsed['budgetMax'] ?? ($parsed['budgetMin'] === null ? $context['budgetMax'] : null),
            'brandIds' => $parsed['brandIds'] ?: $context['brandIds'],
            'criteria' => array_values(array_unique([...$context['criteria'], ...$parsed['criteria']])),
            'roomAreaM2' => $parsed['roomAreaM2'] ?? $context['roomAreaM2'],
        ];
        if ($parsed['categories'] !== [] && $parsed['categories'][0] !== $context['category']) {
            // Switching product group drops budget/criteria/brands that belonged to the previous group.
            $slots['budgetMin'] = $parsed['budgetMin'];
            $slots['budgetMax'] = $parsed['budgetMax'];
            $slots['criteria'] = $parsed['criteria'];
            $slots['brandIds'] = $parsed['brandIds'];
            $slots['roomAreaM2'] = $parsed['roomAreaM2'];
        }
        $nextContext = $slots;

        if ($parsed['compare']) {
            if ($slots['category'] === null) return $this->answer('COMPARE', 'NEEDS_CLARIFICATION', 'Mình so sánh 2–4 sản phẩm cùng danh mục.', 'Bạn muốn so sánh tủ lạnh, máy giặt hay máy lạnh?', $nextContext);
            return $this->answer('COMPARE', 'ANSWERED', 'Hãy bấm “So sánh” trên 2–4 thẻ sản phẩm cùng danh mục, rồi mở bảng so sánh. Bảng lấy giá và thông số trực tiếp từ catalog.', 'Bạn muốn mình gợi ý vài mẫu ' . chatbotCategoryRules()[$slots['category']]['label'] . ' để chọn so sánh không?', $nextContext);
        }
        // No product slot and no approved FAQ: say so instead of repeating the previous recommendation.
        if (!$hasProductSlots) return $this->answer('UNKNOWN', 'NEEDS_CLARIFICATION', 'Mình chưa có câu trả lời đã được duyệt cho câu hỏi này. Mình có thể gợi ý tủ lạnh, máy giặt, máy lạnh theo ngân sách, thương hiệu, nhu cầu, hoặc trả lời câu hỏi thường gặp.', $context['category'] === null ? 'Bạn đang tìm loại thiết bị nào?' : 'Bạn muốn đổi ngân sách, thương hiệu hay tiêu chí để mình lọc lại?', $context);
        if ($slots['category'] === null) {
            return $this->answer('RECOMMEND', 'NEEDS_CLARIFICATION', 'Mình đã ghi nhận yêu cầu, nhưng cần biết nhóm hàng trước khi lọc.', 'Bạn muốn xem tủ lạnh, máy giặt hay máy lạnh?', $nextContext);
        }

        $rules = chatbotCategoryRules()[$slots['category']];
        $category = $this->model->activeCategoryBySlug($slots['category']);
        if (!$category) return $this->answer('RECOMMEND', 'NO_DATA', "Hiện cửa hàng chưa bán {$rules['label']}.", 'Bạn muốn xem nhóm hàng khác không?', $nextContext);
        $specKeys = ['inverter', 'room_area_max_m2'];
        foreach (['energy', 'capacity', 'water'] as $key) if (isset($rules[$key])) $specKeys[] = $rules[$key][0];
        $items = chatbotRank($this->model->recommendCandidates((string) $category['id'], array_values(array_unique($specKeys))), $slots, $slots['category']);
        if ($items === []) return $this->answer('RECOMMEND', 'NO_DATA', "Không có {$rules['label']} đang bán khớp điều kiện này.", 'Bạn có muốn nới ngân sách hoặc bỏ bớt tiêu chí không?', $nextContext);

        $conditions = [];
        if ($slots['budgetMax'] !== null) $conditions[] = 'giá đến ' . chatbotVnd($slots['budgetMax']);
        if ($slots['budgetMin'] !== null) $conditions[] = 'giá từ ' . chatbotVnd($slots['budgetMin']);
        if ($slots['roomAreaM2'] !== null) $conditions[] = 'phòng ' . chatbotNumber($slots['roomAreaM2']) . ' m²';
        $labels = ['energy' => 'tiết kiệm điện', 'water' => 'tiết kiệm nước', 'capacity' => 'dung tích/công suất lớn', 'inverter' => 'có Inverter'];
        foreach ($slots['criteria'] as $criterion) if (isset($labels[$criterion])) $conditions[] = $labels[$criterion];
        $reply = 'Đây là ' . count($items) . " {$rules['label']} đang bán phù hợp nhất" . ($conditions ? ' với ' . implode(', ', $conditions) : '') . '. Mỗi thẻ nêu một điểm phù hợp và một đánh đổi; giá, tồn lấy từ catalog lúc trả lời.';
        if (count($items) < 3) $reply .= ' Chỉ có ' . count($items) . ' sản phẩm thỏa điều kiện.';
        $followUp = $slots['budgetMax'] === null ? 'Ngân sách tối đa của bạn khoảng bao nhiêu?' : ($slots['criteria'] === [] ? 'Bạn ưu tiên tiết kiệm điện hay dung tích/công suất lớn?' : 'Bạn muốn so sánh 2–4 mẫu nào trong số này?');
        return $this->answer('RECOMMEND', 'ANSWERED', $reply, $followUp, $nextContext, ['categoryId' => (string) $category['id'], 'categoryName' => $category['name'], 'recommendations' => $items, 'checkedAt' => gmdate('Y-m-d\TH:i:s\Z')]);
    }

    // Quick-question chips are only ADMIN-approved ACTIVE FAQ questions.
    public function quickQuestions(): array
    {
        return ['items' => array_map(static fn (array $row): array => ['id' => (string) $row['id'], 'question' => $row['question']], array_slice($this->model->activeFaqs(), 0, 6))];
    }

    public function listFaqs(): array
    {
        return ['items' => array_map([$this, 'faqToApi'], $this->model->listFaqs())];
    }

    public function createFaq(array $input, int $actorId): array
    {
        return $this->faqToApi($this->model->createFaq($this->validFaq($input, false), $actorId));
    }

    public function updateFaq(int $id, array $input, int $actorId): array
    {
        $values = $this->validFaq($input, true);
        if (!$this->model->findFaq($id)) throw new ApiException('Không tìm thấy câu hỏi thường gặp.', 404);
        $row = $this->model->updateFaq($id, $values, $values['expectedVersion'], $actorId);
        if (!$row) throw new ApiException('FAQ đã được người khác cập nhật. Hãy tải lại trước khi sửa.', 409);
        return $this->faqToApi($row);
    }

    private function answer(string $intent, string $state, string $reply, string $followUp, array $context, array $extra = []): array
    {
        return array_replace(['intent' => $intent, 'state' => $state, 'reply' => $reply, 'followUpQuestion' => $followUp, 'context' => $context, 'recommendations' => [], 'faq' => null], $extra);
    }

    // Accept only the slot shape this service itself returns; anything else is rejected rather than trusted.
    private function validContext(mixed $context): array
    {
        $empty = ['category' => null, 'budgetMin' => null, 'budgetMax' => null, 'brandIds' => [], 'criteria' => [], 'roomAreaM2' => null];
        if ($context === null) return $empty;
        if (!is_array($context) || array_diff(array_keys($context), array_keys($empty)) !== []) throw new ApiException('Ngữ cảnh hội thoại không hợp lệ.', 422);
        $context += $empty;
        $category = $context['category'];
        if ($category !== null && (!is_string($category) || !isset(chatbotCategoryRules()[$category]))) throw new ApiException('Ngữ cảnh hội thoại không hợp lệ.', 422);
        foreach (['budgetMin', 'budgetMax'] as $key) if ($context[$key] !== null && (!is_int($context[$key]) || $context[$key] < 1 || $context[$key] > 10000000000)) throw new ApiException('Ngữ cảnh hội thoại không hợp lệ.', 422);
        if ($context['roomAreaM2'] !== null && (!is_int($context['roomAreaM2']) && !is_float($context['roomAreaM2']) || $context['roomAreaM2'] <= 0 || $context['roomAreaM2'] > 1000)) throw new ApiException('Ngữ cảnh hội thoại không hợp lệ.', 422);
        if (!is_array($context['brandIds']) || count($context['brandIds']) > 10 || array_filter($context['brandIds'], static fn ($id): bool => !is_string($id) || !preg_match('/^[1-9][0-9]{0,19}$/D', $id))) throw new ApiException('Ngữ cảnh hội thoại không hợp lệ.', 422);
        if (!is_array($context['criteria']) || array_diff($context['criteria'], ['energy', 'water', 'capacity', 'inverter']) !== []) throw new ApiException('Ngữ cảnh hội thoại không hợp lệ.', 422);
        $context['roomAreaM2'] = $context['roomAreaM2'] === null ? null : (float) $context['roomAreaM2'];
        $context['criteria'] = array_values(array_unique($context['criteria']));
        return $context;
    }

    // Plain text only: answers are rendered as text by React, never as HTML.
    private function validFaq(array $input, bool $update): array
    {
        foreach (array_keys($input) as $key) if (!in_array($key, self::FAQ_FIELDS, true)) throw new ApiException('Request chứa trường không được hỗ trợ.', 422);
        $errors = [];
        $text = static function (string $key, int $max) use ($input, &$errors): string {
            $value = $input[$key] ?? null;
            if (!is_string($value) || trim($value) === '' || mb_strlen(trim($value)) > $max) { $errors[$key] = "Cần từ 1 đến {$max} ký tự."; return ''; }
            return trim($value);
        };
        $values = ['question' => $text('question', 200), 'answer' => $text('answer', 2000), 'keywords' => $text('keywords', 500)];
        if ($values['keywords'] !== '') {
            $keywords = array_values(array_unique(array_filter(array_map('trim', explode(',', $values['keywords'])), static fn (string $word): bool => $word !== '')));
            if ($keywords === [] || count($keywords) > 20 || array_filter($keywords, static fn (string $word): bool => mb_strlen($word) < 2 || mb_strlen($word) > 50)) $errors['keywords'] = 'Nhập 1–20 từ khóa, mỗi từ 2–50 ký tự, cách nhau bằng dấu phẩy.';
            $values['keywords'] = implode(', ', $keywords);
        }
        $status = $input['status'] ?? 'DRAFT';
        if (!in_array($status, ['DRAFT', 'ACTIVE', 'INACTIVE'], true)) $errors['status'] = 'Trạng thái không hợp lệ.';
        $values['status'] = $status;
        $sort = $input['sortOrder'] ?? 0;
        if (!is_int($sort) || $sort < 0 || $sort > 1000) $errors['sortOrder'] = 'Thứ tự từ 0 đến 1000.';
        $values['sortOrder'] = $sort;
        if ($update) {
            $version = $input['expectedVersion'] ?? null;
            if (!is_int($version) || $version < 1) $errors['expectedVersion'] = 'Thiếu phiên bản hiện tại.';
            $values['expectedVersion'] = $version;
        }
        if ($errors) throw new ApiException('Dữ liệu FAQ chưa hợp lệ.', 422, $errors);
        return $values;
    }

    private function faqToApi(array $row): array
    {
        return ['id' => (string) $row['id'], 'question' => $row['question'], 'answer' => $row['answer'], 'keywords' => $row['keywords'], 'status' => $row['status'],
            'sortOrder' => (int) $row['sort_order'], 'version' => (int) $row['version'], 'updatedBy' => $row['updated_by_name'], 'updatedAt' => str_replace(' ', 'T', (string) $row['updated_at']) . 'Z'];
    }
}
