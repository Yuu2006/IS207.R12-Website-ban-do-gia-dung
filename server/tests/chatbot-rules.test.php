<?php
declare(strict_types=1);

// Pure BOT-01..04 rule checks: slot parsing, FAQ matching, active-only ranking inputs and explanations. No database.
require_once __DIR__ . '/../services/chatbot-rules.php';

$passed = 0;
function ensureRule(bool $condition, string $message): void
{
    global $passed;
    if (!$condition) { fwrite(STDERR, "FAIL: {$message}\n"); exit(1); }
    $passed++;
}

$brands = [['id' => '1', 'name' => 'LG'], ['id' => '2', 'name' => 'Samsung'], ['id' => '3', 'name' => 'Daikin']];

$slots = chatbotParse('Tư vấn máy giặt LG dưới 10 triệu, tiết kiệm điện', $brands);
ensureRule($slots['categories'] === ['may-giat'], 'washer category');
ensureRule($slots['budgetMax'] === 10000000 && $slots['budgetMin'] === null, 'budget max in triệu');
ensureRule($slots['brandIds'] === ['1'], 'brand LG');
ensureRule($slots['criteria'] === ['energy'], 'energy criterion');

$slots = chatbotParse('Điều Hoà cho phòng 20 m2 inverter từ 8 đến 12 triệu', $brands);
ensureRule($slots['categories'] === ['may-lanh'], 'điều hoà maps to máy lạnh');
ensureRule($slots['roomAreaM2'] === 20.0, 'room area');
ensureRule($slots['budgetMin'] === 8000000 && $slots['budgetMax'] === 12000000, 'budget range shares the trailing unit');
ensureRule(in_array('inverter', $slots['criteria'], true), 'inverter criterion');

$slots = chatbotParse('tủ lạnh trên 15tr cho 4 người', $brands);
ensureRule($slots['budgetMin'] === 15000000 && $slots['budgetMax'] === null, '"trên" sets a minimum');
ensureRule(chatbotParse('phòng 20 m2', $brands)['budgetMax'] === null, 'area number is not money');
ensureRule(chatbotParse('giá 9.990.000', $brands)['budgetMax'] === 9990000, 'plain VND amount');
ensureRule(chatbotParse('so sánh tủ lạnh', $brands)['compare'] === true, 'compare intent');
ensureRule(chatbotParse('tủ lạnh và máy giặt', $brands)['categories'] === ['tu-lanh', 'may-giat'], 'two categories are reported, not guessed');

$faqs = [
    ['id' => 1, 'question' => 'Chính sách đổi trả?', 'answer' => 'A', 'keywords' => 'đổi trả, trả hàng'],
    ['id' => 2, 'question' => 'Bảo hành?', 'answer' => 'B', 'keywords' => 'bảo hành'],
    ['id' => 3, 'question' => 'Giao hàng?', 'answer' => 'C', 'keywords' => 'giao hàng, phí ship'],
];
ensureRule(chatbotMatchFaq('Cho mình hỏi chính sách đổi trả thế nào?', $faqs)['id'] === 1, 'FAQ keyword with punctuation');
ensureRule(chatbotMatchFaq('bao hanh bao lau', $faqs)['id'] === 2, 'FAQ without diacritics');
ensureRule(chatbotMatchFaq('xin chào', $faqs) === null, 'no FAQ match');
ensureRule(chatbotMatchFaq('bảo hành và giao hàng', $faqs) === null, 'tie between FAQs asks instead of guessing');

$product = static fn (int $id, string $brand, array $variants, array $specs): array => ['productId' => (string) $id, 'productName' => "Washer {$id}", 'brandId' => $brand, 'brandName' => $brand === '1' ? 'LG' : 'Other', 'imageUrl' => null, 'warrantyMonths' => 24, 'variants' => $variants, 'specs' => $specs];
$sku = static fn (int $id, int $price, int $stock): array => ['variantId' => (string) $id, 'sku' => "SKU-{$id}", 'variantName' => 'Std', 'price' => $price, 'stock' => $stock];
$products = [
    $product(1, '1', [$sku(11, 9000000, 3)], ['power_watts' => '1800', 'capacity_kg' => '9']),
    $product(2, '2', [$sku(21, 8000000, 2), $sku(22, 7000000, 0)], ['power_watts' => '1500', 'capacity_kg' => '10']),
    $product(3, '1', [$sku(31, 12000000, 5)], ['power_watts' => '1200']),
    $product(4, '2', [$sku(41, 6000000, 1)], []),
];
$slots = ['budgetMin' => null, 'budgetMax' => 10000000, 'brandIds' => [], 'criteria' => ['energy'], 'roomAreaM2' => null];
$ranked = chatbotRank($products, $slots, 'may-giat');
ensureRule(array_column($ranked, 'productId') === ['2', '1', '4'], 'over-budget product excluded, lower power ranks first, missing spec last');
ensureRule($ranked[0]['variantId'] === '21', 'in-stock SKU preferred over a cheaper out-of-stock SKU');
ensureRule(str_contains($ranked[0]['reason'], 'Công suất 1.500 W'), 'reason cites the real spec');
ensureRule(str_contains($ranked[2]['tradeoff'], 'Chưa có dữ liệu Công suất'), 'missing spec is a stated trade-off, not a win');
ensureRule($ranked[0]['href'] === '/catalog/products/2?variantId=21', 'detail route uses the chosen SKU');

$branded = chatbotRank($products, ['budgetMin' => null, 'budgetMax' => null, 'brandIds' => ['1'], 'criteria' => [], 'roomAreaM2' => null], 'may-giat');
ensureRule(in_array($branded[0]['productId'], ['1', '3'], true) && in_array($branded[1]['productId'], ['1', '3'], true), 'requested brand ranks first');
ensureRule(chatbotRank($products, ['budgetMin' => null, 'budgetMax' => 1000, 'brandIds' => [], 'criteria' => [], 'roomAreaM2' => null], 'may-giat') === [], 'nothing in budget returns empty');

$ac = [
    $product(5, '3', [$sku(51, 9000000, 1)], ['room_area_max_m2' => '15']),
    $product(6, '3', [$sku(61, 11000000, 1)], ['room_area_max_m2' => '25']),
    $product(7, '3', [$sku(71, 10000000, 0)], []),
];
$rankedAc = chatbotRank($ac, ['budgetMin' => null, 'budgetMax' => null, 'brandIds' => [], 'criteria' => [], 'roomAreaM2' => 20.0], 'may-lanh');
ensureRule(array_column($rankedAc, 'productId') === ['6', '7'], 'AC too small for the room is excluded; missing area stays with a trade-off');
ensureRule($rankedAc[1]['tradeoff'] === 'Tạm hết hàng, chưa thể thêm vào giỏ' && $rankedAc[1]['availability'] === 'OUT_OF_STOCK', 'out of stock is the first trade-off');

echo "PASS: {$passed} chatbot rule checks.\n";
