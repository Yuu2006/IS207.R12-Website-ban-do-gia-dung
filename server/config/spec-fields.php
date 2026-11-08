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
