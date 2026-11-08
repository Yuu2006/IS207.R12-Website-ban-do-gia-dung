<?php
declare(strict_types=1);

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../models/tco-model.php';

/** Validates TCO requests and calculates transparent, exact-cent cost estimates. */
final class TcoCalculator
{
    private const MAX_MONEY_CENTS = 99999999999999;
    private const MAX_RATE_CENTS = 10000000;
    private const MAX_POWER_UNITS = 1000000000;
    private const MAX_ENERGY_UNITS = 10000000000;
    private const MAX_WATER_UNITS = 1000000000;

    /** Converts the public request into bounded integer units; floats and malformed decimals are rejected. */
    public static function validateRequest(array $input): array
    {
        $errors = [];
        $productIds = self::positiveIdList($input['productIds'] ?? null, 'productIds', $errors);
        $variantIds = self::positiveIdList($input['variantIds'] ?? null, 'variantIds', $errors);

        if (count($productIds) < 2 || count($productIds) > 4) {
            $errors['productIds'] = 'Chọn từ 2 đến 4 sản phẩm.';
        }
        if (count($variantIds) !== count($productIds)) {
            $errors['variantIds'] = 'Mỗi sản phẩm cần chọn đúng một SKU.';
        }
        if (count(array_unique($productIds)) !== count($productIds)) {
            $errors['productIds'] = 'Không chọn trùng sản phẩm.';
        }
        if (count(array_unique($variantIds)) !== count($variantIds)) {
            $errors['variantIds'] = 'Không chọn trùng SKU.';
        }

        $years = $input['years'] ?? null;
        if (!is_int($years) || !in_array($years, [1, 3, 5], true)) {
            $errors['years'] = 'Thời gian sở hữu phải là 1, 3 hoặc 5 năm.';
        }

        $usesPerWeek = $input['usesPerWeek'] ?? null;
        if (!is_int($usesPerWeek) || $usesPerWeek < 0 || $usesPerWeek > 168) {
            $errors['usesPerWeek'] = 'Tần suất sử dụng phải là số nguyên từ 0 đến 168 lần mỗi tuần.';
        }

        $hoursPerUse = self::optionalDecimalUnits($input['hoursPerUse'] ?? null, 2, 2400, 'hoursPerUse', $errors);
        $electricityRate = self::moneyUnits($input['electricityVndPerKwh'] ?? null, 'electricityVndPerKwh', $errors, self::MAX_RATE_CENTS);
        $waterRate = self::moneyUnits($input['waterVndPerM3'] ?? null, 'waterVndPerM3', $errors, self::MAX_RATE_CENTS);

        $requestKey = $input['requestKey'] ?? null;
        if (!is_string($requestKey) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $requestKey) !== 1) {
            $errors['requestKey'] = 'requestKey phải là UUID hợp lệ.';
        }

        $costsByProduct = self::annualCosts($input['annualCosts'] ?? null, $productIds, $errors);

        if ($errors) {
            throw new ApiException('Dữ liệu tính TCO chưa hợp lệ.', 422, $errors);
        }

        return [
            'productIds' => $productIds,
            'variantIds' => $variantIds,
            'years' => $years,
            'usesPerWeek' => $usesPerWeek,
            'hoursPerUseUnits' => $hoursPerUse,
            'electricityRateCents' => $electricityRate,
            'waterRateCents' => $waterRate,
            'annualCostsByProduct' => $costsByProduct,
            'requestKey' => strtolower($requestKey),
        ];
    }

    /** Builds one product result, preserving unknown costs as null instead of treating them as free. */
    public static function calculate(array $product, array $request): array
    {
        $missing = [];
        $assumptions = [];
        $attributes = $product['attributes'] ?? [];
        $defined = $product['defined_attributes'] ?? [];

        $purchaseCents = self::databaseMoney($product['purchase_price'] ?? null);
        if ($purchaseCents === null) {
            $missing[] = 'SKU chưa có giá bán hợp lệ.';
        }

        $electricityUnits = self::electricityUnits($product, $request, $missing, $assumptions);
        $electricityCents = $electricityUnits === null
            ? null
            : self::multiplyDivideRound($electricityUnits, $request['electricityRateCents'], 10000);

        $waterUnits = self::waterUnits($product, $request, $missing, $assumptions);
        $waterCents = $waterUnits === null
            ? null
            : self::multiplyDivideRound($waterUnits, $request['waterRateCents'], 10000);

        $annualCosts = $request['annualCostsByProduct'][(int) $product['product_id']];
        $consumablesCents = self::annualCost($annualCosts['consumablesVndPerYear'], $request['years']);
        $maintenanceCents = self::annualCost($annualCosts['maintenanceVndPerYear'], $request['years']);

        if ($consumablesCents === null) {
            $missing[] = 'Nhập chi phí vật tư ước tính mỗi năm; nhập 0 nếu xác nhận không phát sinh.';
        } else {
            $assumptions[] = 'Chi phí vật tư mỗi năm do người dùng nhập.';
        }
        if ($maintenanceCents === null) {
            $missing[] = 'Nhập chi phí bảo trì ước tính mỗi năm; nhập 0 nếu xác nhận không phát sinh.';
        } else {
            $assumptions[] = 'Chi phí bảo trì mỗi năm do người dùng nhập.';
        }

        $components = [$purchaseCents, $electricityCents, $waterCents, $consumablesCents, $maintenanceCents];
        $totalCents = in_array(null, $components, true) ? null : self::safeSum($components);

        return [
            'productId' => (int) $product['product_id'],
            'variantId' => (int) $product['variant_id'],
            'productName' => $product['product_name'],
            'categoryId' => (int) $product['category_id'],
            'categoryName' => $product['category_name'],
            'sku' => $product['sku'],
            'variantName' => $product['variant_name'],
            'purchase' => self::formatMoney($purchaseCents),
            'electricity' => self::formatMoney($electricityCents),
            'water' => self::formatMoney($waterCents),
            'consumables' => self::formatMoney($consumablesCents),
            'maintenance' => self::formatMoney($maintenanceCents),
            'total' => self::formatMoney($totalCents),
            'assumptions' => array_values(array_unique($assumptions)),
            'formula' => [
                'purchase' => 'Giá bán hiệu lực hiện tại của SKU đã chọn.',
                'electricity' => self::electricityFormula($product, $defined),
                'water' => self::waterFormula($product, $defined),
                'consumables' => 'Chi phí vật tư mỗi năm do người dùng nhập × số năm sở hữu.',
                'maintenance' => 'Chi phí bảo trì mỗi năm do người dùng nhập × số năm sở hữu.',
                'total' => 'Giá mua + điện + nước + vật tư + bảo trì.',
            ],
            'missingInputs' => array_values(array_unique($missing)),
            'currency' => 'VND',
        ];
    }

    /** Parses a bounded, non-negative decimal into integer units without binary floating point. */
    public static function decimalUnits(mixed $value, int $scale, int $maximum, string $field): ?int
    {
        if (is_int($value)) {
            $value = (string) $value;
        }
        if (!is_string($value) || preg_match('/^(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,' . $scale . '}))?$/D', $value, $matches) !== 1) {
            return null;
        }

        $factor = 10 ** $scale;
        $fraction = str_pad($matches[2] ?? '', $scale, '0');
        $units = ((int) $matches[1] * $factor) + ($fraction === '' ? 0 : (int) $fraction);
        return $units <= $maximum ? $units : null;
    }

    /** Rounds a non-negative integer multiplication/division to nearest unit, half up, with overflow checks. */
    private static function multiplyDivideRound(int $left, int $right, int $divisor): int
    {
        if ($left < 0 || $right < 0 || $divisor <= 0) {
            throw new ApiException('Không thể tính chi phí TCO với dữ liệu hiện tại.', 422);
        }

        $whole = intdiv($left, $divisor);
        $remainder = $left % $divisor;
        if ($right > 0 && $whole > intdiv(PHP_INT_MAX, $right)) {
            throw new ApiException('Giá trị tính TCO vượt giới hạn cho phép.', 422);
        }
        if ($right > 0 && $remainder > intdiv(PHP_INT_MAX - intdiv($divisor, 2), $right)) {
            throw new ApiException('Giá trị tính TCO vượt giới hạn cho phép.', 422);
        }

        $base = $whole * $right;
        $fraction = intdiv(($remainder * $right) + intdiv($divisor, 2), $divisor);
        if ($base > PHP_INT_MAX - $fraction) {
            throw new ApiException('Giá trị tính TCO vượt giới hạn cho phép.', 422);
        }

        return $base + $fraction;
    }

    /** Computes electricity from an annual kWh spec or rated power and the submitted use scenario. */
    private static function electricityUnits(array $product, array $request, array &$missing, array &$assumptions): ?int
    {
        $attributes = $product['attributes'] ?? [];
        $defined = $product['defined_attributes'] ?? [];
        $units = $product['attribute_units'] ?? [];

        if (isset($defined['energy_kwh_year'])) {
            $energyUnit = self::canonicalUnit($units['energy_kwh_year'] ?? null, 'kwh');
            if ($energyUnit !== 'kwh') {
                $missing[] = 'Đơn vị điện năng theo năm trong catalog phải là kWh/năm.';
                return null;
            }
            $annual = self::physicalUnits($attributes['energy_kwh_year'] ?? null, self::MAX_ENERGY_UNITS);
            if ($annual === null) {
                $missing[] = 'Thiếu điện năng tiêu thụ theo năm (kWh/năm) trong catalog.';
                return null;
            }
            $assumptions[] = 'Điện năng năm lấy từ thông số catalog; tần suất sử dụng không nhân lại thông số này.';
            return self::multiplyDivideRound($annual, $request['years'], 1);
        }

        if ($request['usesPerWeek'] === 0) {
            $assumptions[] = 'Tần suất người dùng chọn là 0 lần/tuần; điện năng theo công suất sử dụng được tính bằng 0.';
            return 0;
        }

        $dynamicPower = $attributes['power_watts'] ?? null;
        $basePower = $product['product_power_watts'] ?? null;
        $dynamicPowerUnits = self::powerInWatts($dynamicPower, $units['power_watts'] ?? null);
        $basePowerUnits = self::powerInWatts($basePower, 'W');
        if ($dynamicPower !== null && $basePower !== null) {
            if ($dynamicPowerUnits === null || $basePowerUnits === null || $dynamicPowerUnits !== $basePowerUnits) {
                $missing[] = 'Thông số công suất giữa catalog cơ bản và thuộc tính động không khớp; cần kiểm tra dữ liệu.';
                return null;
            }
        }

        $powerUnits = $dynamicPower !== null ? $dynamicPowerUnits : $basePowerUnits;
        if ($powerUnits === null) {
            $missing[] = $dynamicPower !== null
                ? 'Thiếu công suất hợp lệ hoặc đơn vị công suất trong catalog không được hỗ trợ (W/kW).'
                : 'Thiếu công suất điện (W) hoặc điện năng tiêu thụ trong catalog.';
            return null;
        }
        if ($request['hoursPerUseUnits'] === null || $request['hoursPerUseUnits'] <= 0) {
            $missing[] = 'Nhập thời lượng mỗi lần sử dụng để tính điện từ công suất W.';
            return null;
        }

        $cyclesInPeriod = $request['usesPerWeek'] * 52 * $request['years'];
        $energyUnits = self::multiplyDivideRound($powerUnits, $request['hoursPerUseUnits'] * $cyclesInPeriod, 100000);
        $assumptions[] = 'Công suất catalog được chuẩn hóa về W (kW × 1.000 nếu cần) trước khi tính điện năng.';
        return $energyUnits;
    }

    /** Computes water from liters per use; known non-water appliance categories are explicitly excluded. */
    private static function waterUnits(array $product, array $request, array &$missing, array &$assumptions): ?int
    {
        $attributes = $product['attributes'] ?? [];
        $defined = $product['defined_attributes'] ?? [];
        $units = $product['attribute_units'] ?? [];

        if ($request['usesPerWeek'] === 0) {
            $assumptions[] = 'Tần suất người dùng chọn là 0 lần/tuần; lượng nước sử dụng được tính bằng 0.';
            return 0;
        }

        if (!isset($defined['water_liters_cycle'])) {
            if (in_array($product['category_slug'] ?? '', ['tu-lanh', 'may-lanh'], true)) {
                $assumptions[] = 'Danh mục không khai báo nước theo chu trình; khoản nước được tính 0.';
                return 0;
            }
            $missing[] = 'Danh mục chưa định nghĩa mức tiêu thụ nước theo chu trình.';
            return null;
        }

        $litersUnits = self::waterInLiters($attributes['water_liters_cycle'] ?? null, $units['water_liters_cycle'] ?? null);
        if ($litersUnits === null) {
            $missing[] = 'Thiếu lượng nước hợp lệ hoặc đơn vị nước trong catalog không được hỗ trợ (L/m³ mỗi chu trình).';
            return null;
        }

        $cycles = $request['usesPerWeek'] * 52 * $request['years'];
        $waterUnits = self::multiplyDivideRound($litersUnits, $cycles, 1000);
        $assumptions[] = 'Lượng nước catalog được chuẩn hóa về lít (m³ × 1.000 nếu cần), rồi đổi sang m³ để tính chi phí.';
        return $waterUnits;
    }

    /** Documents the exact electricity rule chosen for the current product data. */
    private static function electricityFormula(array $product, array $defined): string
    {
        if (isset($defined['energy_kwh_year'])) {
            return 'kWh/năm từ catalog × số năm × giá điện mỗi kWh.';
        }
        return 'Công suất catalog quy về W (kW × 1.000 nếu cần) ÷ 1.000 × giờ/lần × lần/tuần × 52 × số năm × giá điện mỗi kWh.';
    }

    /** Documents whether water is calculated from catalog or excluded by the known appliance category. */
    private static function waterFormula(array $product, array $defined): string
    {
        if (isset($defined['water_liters_cycle'])) {
            return 'Lượng nước catalog quy về L (m³ × 1.000 nếu cần) ÷ 1.000 × lần/tuần × 52 × số năm × giá nước mỗi m³.';
        }
        if (in_array($product['category_slug'] ?? '', ['tu-lanh', 'may-lanh'], true)) {
            return '0 VND: danh mục tủ lạnh/máy lạnh hiện không khai báo tiêu thụ nước theo chu trình.';
        }
        return 'Chưa đủ dữ liệu tiêu thụ nước để tính.';
    }

    private static function positiveIdList(mixed $value, string $field, array &$errors): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            $errors[$field] = 'Trường phải là danh sách ID.';
            return [];
        }

        $ids = [];
        foreach ($value as $id) {
            if (!is_int($id) || $id < 1) {
                $errors[$field] = 'ID phải là số nguyên dương.';
                return [];
            }
            $ids[] = $id;
        }
        return $ids;
    }

    private static function annualCosts(mixed $value, array $productIds, array &$errors): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) !== count($productIds)) {
            $errors['annualCosts'] = 'Cần có một bộ chi phí vật tư/bảo trì cho mỗi sản phẩm.';
            return [];
        }

        $expected = array_fill_keys($productIds, true);
        $costs = [];
        foreach ($value as $row) {
            if (!is_array($row) || !is_int($row['productId'] ?? null) || !isset($expected[$row['productId']])) {
                $errors['annualCosts'] = 'Chi phí phải khớp với các sản phẩm đã chọn.';
                continue;
            }
            $productId = $row['productId'];
            if (isset($costs[$productId])) {
                $errors['annualCosts'] = 'Không gửi trùng chi phí cho một sản phẩm.';
                continue;
            }

            $costs[$productId] = [
                'consumablesVndPerYear' => self::optionalMoneyUnits($row['consumablesVndPerYear'] ?? null, "annualCosts.{$productId}.consumablesVndPerYear", $errors),
                'maintenanceVndPerYear' => self::optionalMoneyUnits($row['maintenanceVndPerYear'] ?? null, "annualCosts.{$productId}.maintenanceVndPerYear", $errors),
            ];
        }

        if (count($costs) !== count($productIds)) {
            $errors['annualCosts'] = 'Mỗi sản phẩm cần một bộ giả định chi phí riêng.';
        }
        return $costs;
    }

    private static function moneyUnits(mixed $value, string $field, array &$errors, int $maximum): ?int
    {
        $units = self::decimalUnits($value, 2, $maximum, $field);
        if ($units === null) {
            $errors[$field] = 'Nhập số tiền không âm, tối đa 2 chữ số thập phân.';
        }
        return $units;
    }

    private static function optionalMoneyUnits(mixed $value, string $field, array &$errors): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        return self::moneyUnits($value, $field, $errors, self::MAX_MONEY_CENTS);
    }

    private static function optionalDecimalUnits(mixed $value, int $scale, int $maximum, string $field, array &$errors): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $units = self::decimalUnits($value, $scale, $maximum, $field);
        if ($units === null) {
            $errors[$field] = 'Giá trị vượt giới hạn hoặc có định dạng không hợp lệ.';
        }
        return $units;
    }

    private static function physicalUnits(mixed $value, int $maximum): ?int
    {
        return self::decimalUnits($value, 4, $maximum, 'catalog');
    }

    /** Converts a catalog power value recorded in W or kW into bounded 1/10,000-W integer units. */
    private static function powerInWatts(mixed $value, mixed $unit): ?int
    {
        $canonical = self::canonicalUnit($unit, 'w');
        $multiplier = match ($canonical) {
            'w', 'watt', 'watts' => 1,
            'kw', 'kilowatt', 'kilowatts' => 1000,
            default => null,
        };
        return $multiplier === null ? null : self::scaledPhysicalUnits($value, $multiplier, self::MAX_POWER_UNITS);
    }

    /** Converts water per cycle recorded in liters or cubic metres into bounded 1/10,000-liter units. */
    private static function waterInLiters(mixed $value, mixed $unit): ?int
    {
        $canonical = self::canonicalUnit($unit, 'l');
        $multiplier = match ($canonical) {
            'l', 'liter', 'liters', 'litre', 'litres' => 1,
            'm3', 'cubicmeter', 'cubicmeters', 'cubicmetre', 'cubicmetres' => 1000,
            default => null,
        };
        return $multiplier === null ? null : self::scaledPhysicalUnits($value, $multiplier, self::MAX_WATER_UNITS);
    }

    /** Normalizes unit labels before conversion while preserving the key-defined default for legacy rows. */
    private static function canonicalUnit(mixed $unit, string $default): string
    {
        if (!is_string($unit) || trim($unit) === '') {
            return $default;
        }

        $normalized = function_exists('mb_strtolower') ? mb_strtolower(trim($unit), 'UTF-8') : strtolower(trim($unit));
        $normalized = str_replace(['³', '^3', ' ', "\u{00A0}"], ['3', '3', '', ''], $normalized);
        return explode('/', $normalized, 2)[0];
    }

    /** Applies a unit multiplier without overflowing or exceeding the appliance-specific bound. */
    private static function scaledPhysicalUnits(mixed $value, int $multiplier, int $maximum): ?int
    {
        $unscaled = self::physicalUnits($value, intdiv($maximum, $multiplier));
        if ($unscaled === null || $unscaled > intdiv($maximum, $multiplier)) {
            return null;
        }
        return $unscaled * $multiplier;
    }

    private static function databaseMoney(mixed $value): ?int
    {
        return self::decimalUnits($value, 2, self::MAX_MONEY_CENTS, 'catalog price');
    }

    private static function annualCost(?int $annualCents, int $years): ?int
    {
        if ($annualCents === null) {
            return null;
        }
        if ($annualCents > intdiv(PHP_INT_MAX, $years)) {
            throw new ApiException('Chi phí năm vượt giới hạn tính TCO.', 422);
        }
        return $annualCents * $years;
    }

    private static function safeSum(array $values): int
    {
        $sum = 0;
        foreach ($values as $value) {
            if (!is_int($value) || $value < 0 || $sum > PHP_INT_MAX - $value) {
                throw new ApiException('Tổng TCO vượt giới hạn tính toán.', 422);
            }
            $sum += $value;
        }
        return $sum;
    }

    private static function formatMoney(?int $cents): ?string
    {
        if ($cents === null) {
            return null;
        }
        return intdiv($cents, 100) . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}

/** Loads trusted catalog data, calculates a comparison, then records one deduplicated usage event. */
final class TcoService
{
    public function __construct(private TcoModel $model)
    {
    }

    /** Returns a TCO comparison for two to four active products in the same category. */
    public function calculate(array $input, ?array $principal): array
    {
        $request = TcoCalculator::validateRequest($input);
        $products = [];
        foreach ($request['productIds'] as $index => $productId) {
            $product = $this->model->findActiveProductVariant($productId, $request['variantIds'][$index]);
            if (!$product) {
                throw new ApiException('Không tìm thấy sản phẩm hoặc SKU đang hoạt động.', 404, ['productIds' => 'Kiểm tra sản phẩm/SKU đã chọn.']);
            }
            $products[] = $product;
        }

        $categoryIds = array_unique(array_column($products, 'category_id'));
        if (count($categoryIds) !== 1) {
            throw new ApiException('Chỉ có thể so sánh sản phẩm cùng danh mục.', 422, ['productIds' => 'Chọn sản phẩm cùng danh mục.']);
        }

        $results = array_map(static fn (array $product): array => TcoCalculator::calculate($product, $request), $products);
        $userId = isset($principal['id']) && ctype_digit((string) $principal['id']) ? (int) $principal['id'] : null;
        $this->model->recordCalculation($request['requestKey'], $userId);

        return [
            'requestKey' => $request['requestKey'],
            'categoryId' => (int) $products[0]['category_id'],
            'categoryName' => $products[0]['category_name'],
            'years' => $request['years'],
            'usesPerWeek' => $request['usesPerWeek'],
            'hoursPerUse' => $request['hoursPerUseUnits'] === null ? null : self::formatHours($request['hoursPerUseUnits']),
            'electricityVndPerKwh' => self::formatInputMoney($request['electricityRateCents']),
            'waterVndPerM3' => self::formatInputMoney($request['waterRateCents']),
            'products' => $results,
        ];
    }

    private static function formatHours(int $units): string
    {
        return intdiv($units, 100) . '.' . str_pad((string) ($units % 100), 2, '0', STR_PAD_LEFT);
    }

    private static function formatInputMoney(int $cents): string
    {
        return intdiv($cents, 100) . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
