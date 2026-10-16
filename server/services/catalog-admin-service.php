<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/catalog-admin-model.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

// Nghiệp vụ quản trị SKU/giá khuyến mãi/ảnh/thông số; mọi hàm yêu cầu route đã kiểm tra ADMIN.
class CatalogAdminService
{
    private const VARIANT_FIELDS = ['sku', 'variant_name', 'price', 'sale_price', 'sale_starts_at', 'sale_ends_at', 'low_stock_threshold', 'is_active'];

    public function __construct(private CatalogAdminModel $model) {}

    // Tiền giữ dạng chuỗi thập phân tới PDO/DECIMAL(14,2), không đi qua float.
    private static function money(mixed $value, string $field, array &$errors): ?string
    {
        $text = is_int($value) ? (string) $value : (is_string($value) ? trim($value) : '');
        if (!preg_match('/^\d{1,12}(\.\d{1,2})?$/', $text)) { $errors[$field] = 'Giá phải là số không âm, tối đa 2 chữ số thập phân.'; return null; }
        return $text;
    }

    // So sánh tiền bằng số nguyên xu, không cần bcmath (image php:8.3-apache không có sẵn).
    private static function cents(string $money): int
    {
        [$whole, $fraction] = explode('.', $money . '.');
        return (int) $whole * 100 + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    // Nhận 'YYYY-MM-DD HH:MM[:SS]' hoặc datetime-local 'YYYY-MM-DDTHH:MM'; rỗng là không giới hạn.
    private static function dateTime(mixed $value, string $field, array &$errors): ?string
    {
        if ($value === null || $value === '') return null;
        $text = is_string($value) ? str_replace('T', ' ', trim($value)) : '';
        foreach (['Y-m-d H:i:s', 'Y-m-d H:i'] as $format) {
            $date = DateTimeImmutable::createFromFormat('!' . $format, $text);
            if ($date && $date->format($format) === $text) return $date->format('Y-m-d H:i:s');
        }
        $errors[$field] = 'Thời gian chưa hợp lệ.';
        return null;
    }

    private static function validateVariant(array $input, ?array $current): array
    {
        if (array_key_exists('stock_quantity', $input)) throw new ApiException('Tồn kho chỉ thay đổi qua điều chỉnh kho để luôn có lịch sử.', 422, ['stock_quantity' => 'Dùng màn hình điều chỉnh kho.']);
        if ($current && array_key_exists('sku', $input) && $input['sku'] !== $current['sku']) throw new ApiException('Mã SKU không được đổi sau khi tạo.', 422, ['sku' => 'Mã SKU cố định.']);
        onlyFields($input, self::VARIANT_FIELDS);
        $values = array_merge(['sale_price' => null, 'sale_starts_at' => null, 'sale_ends_at' => null, 'low_stock_threshold' => 5, 'is_active' => true], $current ?? [], $input);
        $errors = [];
        $result = [
            'sku' => textValue($values['sku'] ?? '', 'sku', 80, true, $errors),
            'variant_name' => textValue($values['variant_name'] ?? '', 'variant_name', 150, true, $errors),
            'price' => self::money($values['price'] ?? null, 'price', $errors),
            'sale_price' => $values['sale_price'] === null || $values['sale_price'] === '' ? null : self::money($values['sale_price'], 'sale_price', $errors),
            'sale_starts_at' => self::dateTime($values['sale_starts_at'], 'sale_starts_at', $errors),
            'sale_ends_at' => self::dateTime($values['sale_ends_at'], 'sale_ends_at', $errors),
            'low_stock_threshold' => $values['low_stock_threshold'],
            'is_active' => $values['is_active'],
        ];
        if (!isset($errors['sku']) && !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/', $result['sku'])) $errors['sku'] = 'SKU chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.';
        if ($result['sale_price'] !== null && $result['price'] !== null && self::cents($result['sale_price']) >= self::cents($result['price'])) $errors['sale_price'] = 'Giá khuyến mãi phải thấp hơn giá bán.';
        if ($result['sale_starts_at'] && $result['sale_ends_at'] && $result['sale_ends_at'] <= $result['sale_starts_at']) $errors['sale_ends_at'] = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
        if (!is_int($result['low_stock_threshold']) || $result['low_stock_threshold'] < 0 || $result['low_stock_threshold'] > 1000000) $errors['low_stock_threshold'] = 'Ngưỡng cảnh báo là số nguyên từ 0.';
        if (!is_bool($result['is_active']) && !in_array($result['is_active'], [0, 1], true)) $errors['is_active'] = 'Trạng thái phải là boolean.';
        if ($errors) throw new ApiException('Hãy kiểm tra thông tin SKU.', 422, $errors);
        $result['is_active'] = (bool) $result['is_active'];
        return $result;
    }

    public function variants(int $productId): array
    {
        if (!$this->model->productExists($productId)) throw new ApiException('Không tìm thấy sản phẩm.', 404);
        return $this->model->variants($productId);
    }

    public function createVariant(int $productId, array $input): array
    {
        if (!$this->model->productExists($productId)) throw new ApiException('Không tìm thấy sản phẩm.', 404);
        $values = self::validateVariant($input, null);
        try {
            return $this->model->variant($this->model->insertVariant($productId, $values));
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Mã SKU đã tồn tại.', 409, ['sku' => 'Mã SKU đã tồn tại.']);
            throw $error;
        }
    }

    public function updateVariant(int $id, array $input): array
    {
        $current = $this->model->variant($id);
        if (!$current) throw new ApiException('Không tìm thấy SKU.', 404);
        $current['low_stock_threshold'] = (int) $current['low_stock_threshold'];
        $current['is_active'] = (bool) $current['is_active'];
        $this->model->updateVariant($id, self::validateVariant($input, $current));
        return $this->model->variant($id);
    }

    // Chỉ nhận ảnh do /api/uploads/images sinh ra, tránh URL ngoài hoặc tên file tùy ý.
    public function setPrimaryImage(int $productId, array $input): array
    {
        onlyFields($input, ['image_url']);
        $url = $input['image_url'] ?? null;
        $path = is_string($url) && strlen($url) <= 500 && in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true) ? parse_url($url, PHP_URL_PATH) : null;
        if (!is_string($path) || !preg_match('#^/uploads/products/[a-f0-9]{32}\.(jpg|png|webp)$#', $path)) throw new ApiException('Ảnh phải được tải lên qua hệ thống.', 422, ['image_url' => 'Ảnh chưa hợp lệ.']);
        if (!$this->model->productExists($productId)) throw new ApiException('Không tìm thấy sản phẩm.', 404);
        $this->model->setPrimaryImage($productId, $url);
        return ['product_id' => (string) $productId, 'image_url' => $url];
    }

    public function createAttribute(int $categoryId, array $input): array
    {
        onlyFields($input, ['name', 'attribute_key', 'data_type', 'unit', 'is_required']);
        $errors = [];
        $values = [
            'name' => textValue($input['name'] ?? '', 'name', 100, true, $errors),
            'attribute_key' => textValue($input['attribute_key'] ?? '', 'attribute_key', 100, true, $errors),
            'data_type' => $input['data_type'] ?? 'text',
            'unit' => textValue($input['unit'] ?? '', 'unit', 30, false, $errors) ?: null,
            'is_required' => $input['is_required'] ?? false,
        ];
        if (!isset($errors['attribute_key']) && !preg_match('/^[a-z][a-z0-9_]*$/', $values['attribute_key'])) $errors['attribute_key'] = 'Khóa gồm chữ thường, số, gạch dưới; bắt đầu bằng chữ.';
        if (!in_array($values['data_type'], ['text', 'number', 'boolean'], true)) $errors['data_type'] = 'Kiểu dữ liệu là text, number hoặc boolean.';
        if (!is_bool($values['is_required'])) $errors['is_required'] = 'Giá trị phải là boolean.';
        if ($errors) throw new ApiException('Hãy kiểm tra thông số.', 422, $errors);
        if (!$this->model->categoryExists($categoryId)) throw new ApiException('Không tìm thấy danh mục.', 404);
        try {
            return ['id' => (string) $this->model->insertAttribute($categoryId, $values)] + $values;
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Khóa thông số đã tồn tại trong danh mục.', 409, ['attribute_key' => 'Khóa đã tồn tại.']);
            throw $error;
        }
    }

    public function banners(): array
    {
        return $this->model->banners();
    }
}
