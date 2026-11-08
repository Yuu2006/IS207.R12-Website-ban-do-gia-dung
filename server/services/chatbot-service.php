<?php
declare(strict_types=1);

// Provides a deterministic catalog action for the chatbot; no client-supplied price or stock is trusted.
final class ChatbotService
{
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
}
