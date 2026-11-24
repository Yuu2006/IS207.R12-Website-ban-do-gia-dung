<?php
declare(strict_types=1);

// Khóa/đơn vị dùng chung khi đọc thông số TV4 cho FitCheck, TCO, bot và compare.
// Catalog vẫn là nguồn sự thật: chỉ chấp nhận field khi product_attributes khớp định nghĩa này.
function specFieldMap(): array
{
    return [
        'width_mm' => ['unit' => 'mm', 'catalogUnit' => 'mm', 'type' => 'number', 'fit' => true],
        'depth_mm' => ['unit' => 'mm', 'catalogUnit' => 'mm', 'type' => 'number', 'fit' => true],
        'height_mm' => ['unit' => 'mm', 'catalogUnit' => 'mm', 'type' => 'number', 'fit' => true],
        'indoor_width_mm' => ['unit' => 'mm', 'catalogUnit' => 'mm', 'type' => 'number', 'fit' => true],
        'room_area_max_m2' => ['unit' => 'm2', 'catalogUnit' => 'm²', 'type' => 'number', 'fit' => true],
        'inverter' => ['unit' => 'boolean', 'catalogUnit' => null, 'type' => 'boolean', 'fit' => true],
        'capacity_liters' => ['unit' => 'L', 'catalogUnit' => 'L', 'type' => 'number', 'fit' => false],
        'capacity_kg' => ['unit' => 'kg', 'catalogUnit' => 'kg', 'type' => 'number', 'fit' => false],
        'energy_kwh_year' => ['unit' => 'kWh/year', 'catalogUnit' => 'kWh/năm', 'type' => 'number', 'fit' => false],
        'power_watts' => ['unit' => 'W', 'catalogUnit' => 'W', 'type' => 'number', 'fit' => false],
        'water_liters_cycle' => ['unit' => 'L/cycle', 'catalogUnit' => 'L', 'type' => 'number', 'fit' => false],
        'cooling_btu' => ['unit' => 'BTU', 'catalogUnit' => 'BTU', 'type' => 'number', 'fit' => false],
    ];
}

// Normalize only known catalog units; bad metadata remains unknown instead of becoming a made-up spec.
function normalizedCatalogSpec(string $key, string $type, ?string $unit, mixed $value): int|float|null
{
    $spec = specFieldMap()[$key] ?? null;
    if (!$spec || $spec['type'] !== $type || $value === null) return null;
    if ($type === 'boolean') return in_array((string) $value, ['0', '1'], true) && ($unit === null || $unit === '') ? (int) $value : null;
    if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < 0) return null;
    $unit = strtolower(str_replace(['³', '²', ' '], ['3', '2', ''], trim($unit ?? '')));
    $factor = match ($key) {
        'power_watts' => match ($unit) { 'w' => 1, 'kw' => 1000, default => null },
        'water_liters_cycle' => match ($unit) { 'l', 'l/cycle', 'l/chu trình', 'l/chutrình' => 1, 'm3', 'm3/cycle', 'm3/chutrình' => 1000, default => null },
        'energy_kwh_year' => in_array($unit, ['kwh', 'kwh/năm', 'kwh/year'], true) ? 1 : null,
        default => $unit === strtolower(str_replace(['³', '²', ' '], ['3', '2', ''], $spec['catalogUnit'] ?? '')) ? 1 : null,
    };
    return $factor === null ? null : (float) $value * $factor;
}

// Trường phòng luôn lưu theo đơn vị chuẩn của room_profiles.
function roomSpecFieldMap(): array
{
    return [
        'placement_width_mm' => ['label' => 'Chiều rộng vị trí', 'unit' => 'mm'],
        'placement_depth_mm' => ['label' => 'Chiều sâu vị trí', 'unit' => 'mm'],
        'placement_height_mm' => ['label' => 'Chiều cao vị trí', 'unit' => 'mm'],
        'door_width_mm' => ['label' => 'Chiều rộng cửa', 'unit' => 'mm'],
        'floor_area_m2' => ['label' => 'Diện tích phòng', 'unit' => 'm2'],
        'occupant_count' => ['label' => 'Số người', 'unit' => 'people'],
        'power_available' => ['label' => 'Có nguồn điện', 'unit' => 'boolean'],
        'water_supply' => ['label' => 'Có cấp nước', 'unit' => 'boolean'],
        'drainage' => ['label' => 'Có thoát nước', 'unit' => 'boolean'],
    ];
}
