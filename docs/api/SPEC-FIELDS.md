# Khóa thông số và đơn vị dùng chung với catalog TV4

`product_attributes.attribute_key` cùng `data_type` và `unit` là nguồn dữ liệu thực. `server/config/spec-fields.php` chốt khóa/đơn vị chuẩn mà FitCheck, TCO, bot và compare được phép tham chiếu; một key trong catalog sai kiểu hoặc đơn vị sẽ không được đưa vào form FitCheck. Không đọc giá trị từ JSON `products.specifications` để thay thế một thuộc tính động còn thiếu.

| Key catalog | Kiểu | Unit đang lưu | Unit chuẩn | Mục đích |
| --- | --- | --- | --- | --- |
| `width_mm`, `depth_mm`, `height_mm`, `indoor_width_mm` | number | `mm` | `mm` | FitCheck, compare |
| `room_area_max_m2` | number | `m²` | `m2` | FitCheck phòng máy lạnh, compare |
| `inverter` | boolean | `NULL` | `boolean` | FitCheck khi cần, compare |
| `capacity_liters` | number | `L` | `L` | bot, compare |
| `capacity_kg` | number | `kg` | `kg` | bot, compare |
| `energy_kwh_year` | number | `kWh/năm` | `kWh/year` | TCO điện tủ lạnh, compare |
| `power_watts` | number | `W` | `W` | TCO điện máy giặt/máy lạnh, bot, compare |
| `water_liters_cycle` | number | `L` | `L/cycle` | TCO nước máy giặt, compare |
| `cooling_btu` | number | `BTU` | `BTU` | bot, compare |

Trường phòng lưu ở `room_profiles`: `placement_width_mm`, `placement_depth_mm`, `placement_height_mm`, `door_width_mm` là `mm`; `floor_area_m2` là `m2`; `occupant_count` là `people`; `power_available`, `water_supply`, `drainage` là `boolean`. Không đổi mm sang cm trong API. `rightValue` hằng số dùng cùng unit với vế trái. `marginValue` chỉ là khoảng hở mm cộng vào vế trái, không phải thông số sản phẩm.

TCO đổi `W / 1000 = kW`, `L / 1000 = m³`, `kWh/year` theo số năm. Bot/compare phải gắn unit khi hiển thị, không trộn `L` dung tích với `L/cycle` lượng nước. Không đủ dữ liệu thì trả `null`/“Chưa có dữ liệu”, không suy đoán. Đây là bảng chuẩn hóa theo seed catalog hiện có, **chờ TV4 xác nhận** field, kiểu, đơn vị và nguồn giá trị trước khi dùng cho kết luận FitCheck/TCO production. Nếu TV4 đổi metadata, cập nhật bảng chuẩn, contract và test cùng một PR; không âm thầm chấp nhận unit mới.
