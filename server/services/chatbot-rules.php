<?php
declare(strict_types=1);

// BOT-01..04 rule engine: keyword slots and deterministic scoring. Pure functions, no SQL, no eval, no LLM.

// Lowercase and strip Vietnamese diacritics so keyword rules match "điều hòa", "dieu hoa" and "Điều Hoà" alike.
function chatbotNormalize(string $text): string
{
    $text = mb_strtolower($text, 'UTF-8');
    $groups = ['a' => 'àáạảãâầấậẩẫăằắặẳẵ', 'e' => 'èéẹẻẽêềếệểễ', 'i' => 'ìíịỉĩ', 'o' => 'òóọỏõôồốộổỗơờớợởỡ', 'u' => 'ùúụủũưừứựửữ', 'y' => 'ỳýỵỷỹ', 'd' => 'đ'];
    foreach ($groups as $plain => $marked) $text = preg_replace('/[' . $marked . ']/u', $plain, $text) ?? $text;
    return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
}

// Whitelisted catalog keys per category slug. Direction: 'min' = lower is better, 'max' = higher is better.
function chatbotCategoryRules(): array
{
    return [
        'tu-lanh' => ['label' => 'tủ lạnh', 'pattern' => '/\btu lanh\b/', 'energy' => ['energy_kwh_year', 'min', 'Điện năng', 'kWh/năm'], 'capacity' => ['capacity_liters', 'max', 'Dung tích', 'L']],
        'may-giat' => ['label' => 'máy giặt', 'pattern' => '/\bmay giat\b/', 'energy' => ['power_watts', 'min', 'Công suất', 'W'], 'capacity' => ['capacity_kg', 'max', 'Khối lượng giặt', 'kg'], 'water' => ['water_liters_cycle', 'min', 'Nước mỗi chu trình', 'L']],
        'may-lanh' => ['label' => 'máy lạnh', 'pattern' => '/\b(may lanh|dieu hoa)\b/', 'energy' => ['power_watts', 'min', 'Công suất', 'W'], 'capacity' => ['cooling_btu', 'max', 'Công suất làm lạnh', 'BTU']],
    ];
}

// Convert "10 triệu", "8tr5", "500k", "9.990.000" into integer VND; null when the token is not money.
function chatbotMoney(string $number, string $unit): ?int
{
    $unit = trim($unit);
    if ($unit === '') {
        $digits = preg_replace('/[.,]/', '', $number);
        return ctype_digit($digits) && (int) $digits >= 100000 ? (int) $digits : null;
    }
    $value = (float) str_replace(',', '.', $number);
    $scale = in_array($unit, ['trieu', 'tr', 'cu'], true) ? 1000000 : (in_array($unit, ['k', 'nghin', 'ngan'], true) ? 1000 : 1);
    return $value > 0 ? (int) round($value * $scale) : null;
}

// Extract structured slots from one message. Brands come from the active catalog: [['id' => '1', 'name' => 'LG'], ...].
function chatbotParse(string $message, array $brands): array
{
    $text = chatbotNormalize($message);
    $slots = ['categories' => [], 'budgetMin' => null, 'budgetMax' => null, 'brandIds' => [], 'criteria' => [], 'roomAreaM2' => null, 'compare' => false];
    foreach (chatbotCategoryRules() as $slug => $rule) if (preg_match($rule['pattern'], $text)) $slots['categories'][] = $slug;
    $money = '(\d+(?:[.,]\d+)*)\s*(trieu|tr|cu|k|nghin|ngan|vnd|dong|d)?\b';
    if (preg_match('/(?:tu|khoang)\s+' . $money . '\s*(?:den|toi|-)\s*' . $money . '/', $text, $range)) {
        $low = chatbotMoney($range[1], $range[2] !== '' ? $range[2] : ($range[4] ?? ''));
        $high = chatbotMoney($range[3], $range[4] ?? '');
        if ($low !== null && $high !== null && $low <= $high) [$slots['budgetMin'], $slots['budgetMax']] = [$low, $high];
    }
    if ($slots['budgetMax'] === null && preg_match_all('/(tren|hon|it nhat|toi thieu)?\s*' . $money . '/', $text, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $value = chatbotMoney($match[2], $match[3] ?? '');
            if ($value === null) continue;
            if ($match[1] !== '') $slots['budgetMin'] = $value; else $slots['budgetMax'] = $value;
            break;
        }
    }
    if (preg_match('/(\d+(?:[.,]\d+)?)\s*(m2|m²|met vuong|m vuong)/u', $text, $area)) $slots['roomAreaM2'] = (float) str_replace(',', '.', $area[1]);
    foreach ($brands as $brand) {
        $name = chatbotNormalize((string) $brand['name']);
        if ($name !== '' && preg_match('/\b' . preg_quote($name, '/') . '\b/', $text)) $slots['brandIds'][] = (string) $brand['id'];
    }
    $criteria = ['energy' => '/tiet kiem dien|it (ton|hao) dien|tiet kiem dien nang/', 'water' => '/tiet kiem nuoc|it (ton|hao) nuoc/', 'capacity' => '/dung tich lon|lon nhat|rong|nhieu nguoi|gia dinh dong|lam lanh nhanh|giat nhieu|cong suat lon/', 'inverter' => '/\binverter\b/'];
    foreach ($criteria as $key => $pattern) if (preg_match($pattern, $text)) $slots['criteria'][] = $key;
    $slots['compare'] = (bool) preg_match('/\bso sanh\b/', $text);
    return $slots;
}

// Count FAQ keyword hits; returns the best ACTIVE FAQ or null when nothing (or a tie) matches.
function chatbotMatchFaq(string $message, array $faqs): ?array
{
    $text = ' ' . preg_replace('/[^\p{L}\p{N}]+/u', ' ', chatbotNormalize($message)) . ' ';
    $best = null;
    $bestScore = 0;
    $tie = false;
    foreach ($faqs as $faq) {
        $score = 0;
        foreach (explode(',', (string) $faq['keywords']) as $keyword) {
            $keyword = chatbotNormalize($keyword);
            // Short keywords must be whole words so "the" does not match inside "thẻ"/"thêm".
            if ($keyword !== '' && (str_contains($text, ' ' . $keyword . ' ') || (mb_strlen($keyword) >= 5 && str_contains($text, $keyword)))) $score++;
        }
        if ($score > $bestScore) [$best, $bestScore, $tie] = [$faq, $score, false];
        elseif ($score > 0 && $score === $bestScore) $tie = true;
    }
    return $tie ? null : $best;
}

// Pick one SKU per product: in budget and in stock first, then cheapest.
function chatbotPickVariant(array $variants, ?int $min, ?int $max): array
{
    usort($variants, static function (array $a, array $b) use ($min, $max): int {
        $fits = static fn (array $v): int => ($max === null || $v['price'] <= $max) && ($min === null || $v['price'] >= $min) ? 1 : 0;
        return [$fits($b), $b['stock'] > 0 ? 1 : 0, $a['price'], (int) $a['variantId']] <=> [$fits($a), $a['stock'] > 0 ? 1 : 0, $b['price'], (int) $b['variantId']];
    });
    return $variants[0];
}

function chatbotVnd(int $value): string
{
    return number_format($value, 0, ',', '.') . '₫';
}

function chatbotNumber(float $value): string
{
    return rtrim(rtrim(number_format($value, 2, ',', '.'), '0'), ',');
}

// Rank candidate products (one chosen SKU each) and explain one fit point and one trade-off per item.
// Missing price/spec never counts as meeting a criterion.
function chatbotRank(array $products, array $slots, string $categorySlug, int $limit = 5): array
{
    $rules = chatbotCategoryRules()[$categorySlug];
    $pool = [];
    foreach ($products as $product) {
        if ($product['variants'] === []) continue;
        $variant = chatbotPickVariant($product['variants'], $slots['budgetMin'], $slots['budgetMax']);
        if ($slots['budgetMax'] !== null && $variant['price'] > $slots['budgetMax']) continue;
        if ($slots['budgetMin'] !== null && $variant['price'] < $slots['budgetMin']) continue;
        $area = $product['specs']['room_area_max_m2'] ?? null;
        if ($slots['roomAreaM2'] !== null && $area !== null && (float) $area < $slots['roomAreaM2']) continue;
        $pool[] = $product + ['variant' => $variant, 'score' => 0.0, 'pros' => [], 'cons' => []];
    }
    if ($pool === []) return [];
    $criteria = array_values(array_filter($slots['criteria'], static fn (string $key): bool => isset($rules[$key]) || $key === 'inverter'));
    if ($criteria === [] && isset($rules['capacity'])) $display = [$rules['capacity']]; else $display = [];
    foreach ($criteria as $criterion) {
        if ($criterion === 'inverter') {
            foreach ($pool as &$item) {
                $value = $item['specs']['inverter'] ?? null;
                if ($value === null) $item['cons'][] = 'Chưa có dữ liệu Inverter';
                elseif ((bool) $value) { $item['score'] += 2; $item['pros'][] = 'Có công nghệ Inverter'; }
                else $item['cons'][] = 'Không có Inverter';
            }
            unset($item);
            continue;
        }
        [$key, $direction, $label, $unit] = $rules[$criterion];
        $values = array_filter(array_map(static fn (array $item): ?float => isset($item['specs'][$key]) ? (float) $item['specs'][$key] : null, $pool), static fn (?float $value): bool => $value !== null);
        $best = $values === [] ? null : ($direction === 'min' ? min($values) : max($values));
        $worst = $values === [] ? null : ($direction === 'min' ? max($values) : min($values));
        foreach ($pool as &$item) {
            $value = isset($item['specs'][$key]) ? (float) $item['specs'][$key] : null;
            if ($value === null) { $item['cons'][] = "Chưa có dữ liệu {$label}"; continue; }
            // A known value always outranks a missing one (0.5 floor); the best value gets the full 2 points.
            $item['score'] += $best === $worst ? 2 : 0.5 + 1.5 * abs($value - $worst) / abs($best - $worst);
            $text = "{$label} " . chatbotNumber($value) . " {$unit}";
            if ($value === $best) $item['pros'][] = $text . ($direction === 'min' ? ', thấp nhất trong nhóm gợi ý' : ', cao nhất trong nhóm gợi ý');
            else $item['cons'][] = $text . ', kém hơn mẫu tốt nhất (' . chatbotNumber($best) . " {$unit})";
        }
        unset($item);
    }
    $cheapest = min(array_map(static fn (array $item): int => $item['variant']['price'], $pool));
    foreach ($pool as &$item) {
        $price = $item['variant']['price'];
        if ($slots['roomAreaM2'] !== null) {
            $area = $item['specs']['room_area_max_m2'] ?? null;
            if ($area === null) $item['cons'][] = 'Chưa có dữ liệu diện tích phòng tối đa';
            else { $item['score'] += 2; $item['pros'][] = 'Phù hợp phòng đến ' . chatbotNumber((float) $area) . ' m²'; }
        }
        if ($slots['brandIds'] !== []) {
            if (in_array((string) $item['brandId'], $slots['brandIds'], true)) { $item['score'] += 2; $item['pros'][] = "Đúng thương hiệu {$item['brandName']}"; }
            else $item['cons'][] = 'Không thuộc thương hiệu bạn chọn';
        }
        if ($slots['budgetMax'] !== null) { $item['score'] += 1; $item['pros'][] = 'Giá ' . chatbotVnd($price) . ', trong ngân sách ' . chatbotVnd($slots['budgetMax']); }
        if ($item['variant']['stock'] > 0) $item['score'] += 1; else array_unshift($item['cons'], 'Tạm hết hàng, chưa thể thêm vào giỏ');
        if ($price > $cheapest) $item['cons'][] = 'Giá cao hơn lựa chọn rẻ nhất trong nhóm ' . chatbotVnd($price - $cheapest);
        else $item['pros'][] = 'Giá thấp nhất trong nhóm gợi ý: ' . chatbotVnd($price);
        foreach ($display as [$key, , $label, $unit]) {
            $value = $item['specs'][$key] ?? null;
            if ($value === null) $item['cons'][] = "Chưa có dữ liệu {$label}";
        }
    }
    unset($item);
    usort($pool, static fn (array $a, array $b): int => [$b['score'], $a['variant']['price'], (int) $a['productId']] <=> [$a['score'], $b['variant']['price'], (int) $b['productId']]);
    return array_map(static fn (array $item): array => [
        'productId' => (string) $item['productId'], 'productName' => $item['productName'], 'brandName' => $item['brandName'],
        'imageUrl' => $item['imageUrl'], 'warrantyMonths' => $item['warrantyMonths'],
        'variantId' => (string) $item['variant']['variantId'], 'sku' => $item['variant']['sku'], 'variantName' => $item['variant']['variantName'],
        'currentPrice' => (string) $item['variant']['price'], 'stockQuantity' => $item['variant']['stock'],
        'availability' => $item['variant']['stock'] > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        'score' => round($item['score'], 2),
        'reason' => $item['pros'][0] ?? 'Đang bán trong danh mục ' . $rules['label'],
        'tradeoff' => $item['cons'][0] ?? 'Chưa có thêm thông số để so sánh; xem chi tiết trước khi chọn',
        'href' => '/catalog/products/' . rawurlencode((string) $item['productId']) . '?variantId=' . rawurlencode((string) $item['variant']['variantId']),
    ], array_slice($pool, 0, $limit));
}
