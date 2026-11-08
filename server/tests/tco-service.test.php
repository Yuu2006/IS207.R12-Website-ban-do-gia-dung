<?php
declare(strict_types=1);

require_once __DIR__ . '/../services/tco-service.php';

function tcoEnsure(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function tcoRequest(array $overrides = []): array
{
    return array_replace([
        'productIds' => [20, 21],
        'variantIds' => [30, 31],
        'years' => 3,
        'usesPerWeek' => 5,
        'hoursPerUse' => '1.50',
        'electricityVndPerKwh' => '3000.00',
        'waterVndPerM3' => '25000',
        'annualCosts' => [
            ['productId' => 20, 'consumablesVndPerYear' => '100000', 'maintenanceVndPerYear' => '50000'],
            ['productId' => 21, 'consumablesVndPerYear' => '200000', 'maintenanceVndPerYear' => '0'],
        ],
        'requestKey' => '4d52b3d1-49dc-4e65-9476-51b4f5d1c200',
    ], $overrides);
}

function tcoWasRejected(array $request): bool
{
    try {
        TcoCalculator::validateRequest($request);
    } catch (ApiException $error) {
        return $error->status === 422;
    }
    return false;
}

$normalized = TcoCalculator::validateRequest(tcoRequest());
$washer = [
    'product_id' => 20,
    'variant_id' => 30,
    'product_name' => 'Test washing machine',
    'category_id' => 1,
    'category_name' => 'Máy giặt thử nghiệm',
    'category_slug' => 'may-giat',
    'sku' => 'TCO-20',
    'variant_name' => 'Bạc',
    'purchase_price' => '1000000.00',
    'product_power_watts' => null,
    'attributes' => ['power_watts' => '2250.0000', 'water_liters_cycle' => '81.0000'],
    'defined_attributes' => ['power_watts' => true, 'water_liters_cycle' => true],
];
$washerResult = TcoCalculator::calculate($washer, $normalized);
tcoEnsure($washerResult['purchase'] === '1000000.00', 'The selected SKU price must stay exact.');
tcoEnsure($washerResult['electricity'] === '7897500.00', 'Power W must convert to kWh with per-use hours and weekly frequency.');
tcoEnsure($washerResult['water'] === '1579500.00', 'Liters per cycle must convert to cubic meters.');
tcoEnsure($washerResult['consumables'] === '300000.00', 'Annual consumables must scale by years.');
tcoEnsure($washerResult['maintenance'] === '150000.00', 'Annual maintenance must scale by years.');
tcoEnsure($washerResult['total'] === '10927000.00', 'The total must sum every component in cents.');
tcoEnsure($washerResult['missingInputs'] === [], 'A complete request and catalog fixture must produce no missing inputs.');

$oneYear = TcoCalculator::calculate($washer, TcoCalculator::validateRequest(tcoRequest(['years' => 1])));
$fiveYears = TcoCalculator::calculate($washer, TcoCalculator::validateRequest(tcoRequest(['years' => 5])));
tcoEnsure($oneYear['total'] === '4309000.00', 'The one-year scenario must scale recurring costs once.');
tcoEnsure($fiveYears['total'] === '17545000.00', 'The five-year scenario must scale recurring costs five times.');

$metricProduct = $washer;
$metricProduct['product_power_watts'] = '2250.0000';
$metricProduct['attributes'] = ['power_watts' => '2.2500', 'water_liters_cycle' => '0.0810'];
$metricProduct['attribute_units'] = ['power_watts' => 'kW', 'water_liters_cycle' => 'm³/chu trình'];
$metricResult = TcoCalculator::calculate($metricProduct, $normalized);
tcoEnsure($metricResult['electricity'] === $washerResult['electricity'], 'Catalog kW must normalize to the same watt calculation.');
tcoEnsure($metricResult['water'] === $washerResult['water'], 'Catalog m³ per cycle must normalize to the same liter calculation.');
tcoEnsure($metricResult['total'] === $washerResult['total'], 'Equivalent W/kW and L/m³ catalog values must produce identical TCO.');

$unsupportedUnitProduct = $metricProduct;
$unsupportedUnitProduct['attribute_units']['power_watts'] = 'hp';
$unsupportedUnitResult = TcoCalculator::calculate($unsupportedUnitProduct, $normalized);
tcoEnsure($unsupportedUnitResult['electricity'] === null && $unsupportedUnitResult['total'] === null, 'Unsupported power units must not be silently treated as W.');

$unsupportedWaterUnitProduct = $metricProduct;
$unsupportedWaterUnitProduct['attribute_units']['water_liters_cycle'] = 'gallon';
$unsupportedWaterUnitResult = TcoCalculator::calculate($unsupportedWaterUnitProduct, $normalized);
tcoEnsure($unsupportedWaterUnitResult['water'] === null && $unsupportedWaterUnitResult['total'] === null, 'Unsupported water units must not be silently treated as liters.');

$zeroUseRequest = TcoCalculator::validateRequest(tcoRequest(['usesPerWeek' => 0, 'hoursPerUse' => null]));
$zeroUseResult = TcoCalculator::calculate($washer, $zeroUseRequest);
tcoEnsure($zeroUseResult['electricity'] === '0.00' && $zeroUseResult['water'] === '0.00', 'Zero weekly use must yield zero usage-based utility costs without requiring hours.');
$zeroUseWithoutSpecs = $washer;
$zeroUseWithoutSpecs['attributes'] = [];
$zeroUseWithoutSpecs['defined_attributes'] = [];
$zeroUseWithoutSpecs['product_power_watts'] = null;
$zeroUseWithoutSpecsResult = TcoCalculator::calculate($zeroUseWithoutSpecs, $zeroUseRequest);
tcoEnsure($zeroUseWithoutSpecsResult['electricity'] === '0.00' && $zeroUseWithoutSpecsResult['water'] === '0.00', 'Zero weekly use must remain calculable when usage-based catalog specs are absent.');

$zeroHoursRequest = TcoCalculator::validateRequest(tcoRequest(['hoursPerUse' => '0']));
$zeroHoursResult = TcoCalculator::calculate($washer, $zeroHoursRequest);
tcoEnsure($zeroHoursResult['electricity'] === null && $zeroHoursResult['total'] === null, 'Zero hours with nonzero weekly use must not be reported as a complete estimate.');

$fridge = $washer;
$fridge['category_slug'] = 'tu-lanh';
$fridge['attributes'] = ['energy_kwh_year' => '460.0000'];
$fridge['defined_attributes'] = ['energy_kwh_year' => true];
$fridgeResult = TcoCalculator::calculate($fridge, $normalized);
tcoEnsure($fridgeResult['electricity'] === '4140000.00', 'Annual kWh must not be multiplied by the weekly use count.');
tcoEnsure($fridgeResult['water'] === '0.00', 'Known refrigerator category water cost must be explicit zero.');
$fridgeZeroUse = TcoCalculator::calculate($fridge, $zeroUseRequest);
tcoEnsure($fridgeZeroUse['electricity'] === $fridgeResult['electricity'], 'Annual kWh must remain independent of the weekly use count, including zero.');

$missingCosts = $normalized;
$missingCosts['annualCostsByProduct'][20]['maintenanceVndPerYear'] = null;
$missingResult = TcoCalculator::calculate($washer, $missingCosts);
tcoEnsure($missingResult['maintenance'] === null && $missingResult['total'] === null, 'Unknown recurring costs must remain null.');
tcoEnsure(count($missingResult['missingInputs']) === 1, 'The missing recurring cost must be explained.');

tcoEnsure(tcoWasRejected(tcoRequest(['years' => 4])), 'Only 1, 3, and 5 years are valid.');
tcoEnsure(tcoWasRejected(tcoRequest(['productIds' => [20, 20]])), 'Duplicate product IDs must be rejected.');
tcoEnsure(tcoWasRejected(tcoRequest(['electricityVndPerKwh' => 3000.5])), 'JSON float money must be rejected.');
tcoEnsure(tcoWasRejected(tcoRequest(['variantIds' => []])), 'Every selected product must have a selected SKU.');
tcoEnsure(tcoWasRejected(tcoRequest(['usesPerWeek' => 169])), 'Weekly frequency must stay within the documented bound.');
tcoEnsure(tcoWasRejected(tcoRequest(['annualCosts' => [
    ['productId' => 20, 'consumablesVndPerYear' => '-1', 'maintenanceVndPerYear' => '0'],
    ['productId' => 21, 'consumablesVndPerYear' => '0', 'maintenanceVndPerYear' => '0'],
]])), 'Negative annual assumptions must be rejected.');

echo "PASS: TCO exact arithmetic, unit conversion, missing values, and request validation.\n";
