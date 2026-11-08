// Dữ liệu nguồn cho scripts/generate-seed-data.mjs. Thương hiệu thật, nhưng tên model/giá/thông số là MÔ PHỎNG.
// Đổi dữ liệu ở đây rồi chạy lại generator; không sửa tay các file seeds/004..009 (sẽ bị ghi đè).

export const BRANDS = [
  ['Samsung', 'Thương hiệu điện tử gia dụng Hàn Quốc (dữ liệu mô phỏng cho demo).'],
  ['LG', 'Thương hiệu điện tử gia dụng Hàn Quốc (dữ liệu mô phỏng cho demo).'],
  ['Panasonic', 'Thương hiệu điện tử gia dụng Nhật Bản (dữ liệu mô phỏng cho demo).'],
  ['Toshiba', 'Thương hiệu điện tử gia dụng Nhật Bản (dữ liệu mô phỏng cho demo).'],
  ['Daikin', 'Thương hiệu điều hòa không khí Nhật Bản (dữ liệu mô phỏng cho demo).'],
  ['Casper', 'Thương hiệu điều hòa và gia dụng (dữ liệu mô phỏng cho demo).'],
  ['Electrolux', 'Thương hiệu gia dụng châu Âu (dữ liệu mô phỏng cho demo).'],
  ['Aqua', 'Thương hiệu gia dụng giá tốt (dữ liệu mô phỏng cho demo).'],
];

export const CATEGORY_ORDER = { 'tu-lanh': 1, 'may-giat': 2, 'may-lanh': 3 };
export const CATEGORY_LABEL = { 'tu-lanh': 'Tủ lạnh', 'may-giat': 'Máy giặt', 'may-lanh': 'Máy lạnh' };
export const CATEGORY_PREFIX = { TL: 'tu-lanh', MG: 'may-giat', ML: 'may-lanh' };

// variant = [hậu tố SKU, tên biến thể, giá, tồn nhập ban đầu, giá khuyến mãi?]  (tồn 0 = hết hàng, không có phiếu nhập)
// Tủ lạnh: [mã, hãng, tên, năm, lít, rộng, sâu, cao, kWh/năm, inverter, variants]
export const FRIDGES = [
  ['TL-011', 'Samsung', 'Tủ lạnh Samsung Inverter 322L ngăn đá dưới', 2025, 322, 595, 668, 1850, 340, 1, [['01', 'Tiêu chuẩn', 11990000, 20]]],
  ['TL-012', 'Samsung', 'Tủ lạnh Samsung Side by Side 650L', 2025, 650, 912, 716, 1780, 560, 1, [['A', 'Màu bạc', 24990000, 12], ['B', 'Màu đen', 26490000, 3]]],
  ['TL-013', 'LG', 'Tủ lạnh LG Inverter 335L ngăn đá trên', 2024, 335, 595, 680, 1730, 355, 1, [['01', 'Tiêu chuẩn', 12490000, 25, 11690000]]],
  ['TL-014', 'LG', 'Tủ lạnh LG Side by Side 614L', 2025, 614, 913, 735, 1790, 540, 1, [['A', 'Màu bạc', 23990000, 8], ['B', 'Màu đen', 25490000, 0]]],
  ['TL-015', 'Panasonic', 'Tủ lạnh Panasonic Inverter 255L', 2024, 255, 555, 640, 1560, 300, 1, [['01', 'Tiêu chuẩn', 9990000, 35]]],
  ['TL-016', 'Panasonic', 'Tủ lạnh Panasonic Multi Door 550L', 2025, 550, 800, 740, 1820, 480, 1, [['01', 'Tiêu chuẩn', 27990000, 6]]],
  ['TL-017', 'Toshiba', 'Tủ lạnh Toshiba 188L 2 cửa', 2023, 188, 540, 615, 1450, 270, 0, [['01', 'Tiêu chuẩn', 5290000, 20]]],
  ['TL-018', 'Electrolux', 'Tủ lạnh Electrolux Inverter 308L', 2024, 308, 595, 647, 1710, 330, 1, [['A', 'Màu bạc', 13490000, 12], ['B', 'Màu trắng', 13990000, 4]]],
  ['TL-019', 'Aqua', 'Tủ lạnh Aqua Inverter 283L', 2024, 283, 575, 650, 1640, 310, 1, [['01', 'Tiêu chuẩn', 7990000, 35, 7490000]]],
  ['TL-020', 'Aqua', 'Tủ lạnh mini Aqua 90L', 2023, 90, 475, 510, 850, 190, 0, [['01', 'Tiêu chuẩn', 3490000, 3]]],
];

// Máy giặt: [mã, hãng, tên, năm, kg, rộng, sâu, cao, W, lít/chu trình, inverter, variants]
export const WASHERS = [
  ['MG-011', 'Samsung', 'Máy giặt Samsung cửa trước 9kg', 2025, 9, 600, 600, 850, 450, 55, 1, [['01', 'Tiêu chuẩn', 9490000, 20]]],
  ['MG-012', 'Samsung', 'Máy giặt Samsung cửa trên 10kg', 2024, 10, 550, 575, 970, 420, 80, 1, [['01', 'Tiêu chuẩn', 8990000, 12]]],
  ['MG-013', 'LG', 'Máy giặt LG cửa trước 10kg', 2025, 10, 600, 565, 850, 500, 52, 1, [['A', 'Màu trắng', 11990000, 15], ['B', 'Màu đen', 12490000, 4]]],
  ['MG-014', 'LG', 'Máy giặt LG cửa trên 9kg', 2024, 9, 540, 590, 980, 400, 78, 1, [['01', 'Tiêu chuẩn', 7490000, 25, 6990000]]],
  ['MG-015', 'Panasonic', 'Máy giặt Panasonic cửa trước 9kg', 2024, 9, 600, 575, 850, 480, 56, 1, [['01', 'Tiêu chuẩn', 9990000, 8]]],
  ['MG-016', 'Panasonic', 'Máy giặt Panasonic cửa trên 8.5kg', 2023, 8.5, 540, 565, 940, 380, 85, 0, [['01', 'Tiêu chuẩn', 5490000, 20]]],
  ['MG-017', 'Electrolux', 'Máy giặt Electrolux cửa trước 9kg', 2025, 9, 597, 637, 850, 520, 54, 1, [['01', 'Tiêu chuẩn', 10990000, 4]]],
  ['MG-018', 'Aqua', 'Máy giặt Aqua cửa trên 9kg', 2023, 9, 540, 560, 960, 390, 82, 0, [['01', 'Tiêu chuẩn', 4990000, 35]]],
  ['MG-019', 'Toshiba', 'Máy giặt Toshiba cửa trước 8.5kg', 2024, 8.5, 600, 550, 850, 440, 50, 1, [['01', 'Tiêu chuẩn', 8490000, 12]]],
  ['MG-020', 'Samsung', 'Máy giặt sấy Samsung 12kg/8kg', 2025, 12, 600, 650, 850, 1100, 90, 1, [['01', 'Tiêu chuẩn', 19990000, 6]]],
];

// Máy lạnh: [mã, hãng, tên, năm, BTU, m² tối đa, W, rộng dàn lạnh mm, inverter, variants]
export const AIRCONS = [
  ['ML-011', 'Daikin', 'Máy lạnh Daikin Inverter 1 HP', 2025, 9000, 15, 800, 800, 1, [['01', 'Tiêu chuẩn', 10490000, 18]]],
  ['ML-012', 'Daikin', 'Máy lạnh Daikin Inverter 1.5 HP', 2025, 12000, 20, 1000, 800, 1, [['01', 'Tiêu chuẩn', 12990000, 22, 12490000]]],
  ['ML-013', 'Daikin', 'Máy lạnh Daikin Inverter 2 HP', 2024, 18000, 30, 1650, 998, 1, [['01', 'Tiêu chuẩn', 19490000, 8]]],
  ['ML-014', 'Panasonic', 'Máy lạnh Panasonic Inverter 1 HP', 2025, 9000, 15, 790, 860, 1, [['01', 'Tiêu chuẩn', 9990000, 25]]],
  ['ML-015', 'Panasonic', 'Máy lạnh Panasonic Inverter 1.5 HP', 2024, 12000, 20, 1050, 860, 1, [['01', 'Tiêu chuẩn', 12490000, 3]]],
  ['ML-016', 'Casper', 'Máy lạnh Casper 1 HP', 2023, 9000, 15, 900, 790, 0, [['01', 'Tiêu chuẩn', 6490000, 30]]],
  ['ML-017', 'Casper', 'Máy lạnh Casper Inverter 1.5 HP', 2025, 12000, 20, 950, 800, 1, [['01', 'Tiêu chuẩn', 9490000, 20]]],
  ['ML-018', 'LG', 'Máy lạnh LG Inverter 1 HP', 2025, 9200, 15, 770, 837, 1, [['01', 'Tiêu chuẩn', 10990000, 14]]],
  ['ML-019', 'Samsung', 'Máy lạnh Samsung WindFree 1.5 HP', 2025, 12000, 20, 1000, 889, 1, [['01', 'Tiêu chuẩn', 14990000, 10, 13990000]]],
  ['ML-020', 'Toshiba', 'Máy lạnh Toshiba Inverter 2.5 HP', 2024, 24000, 40, 2100, 1070, 1, [['01', 'Tiêu chuẩn', 25990000, 0]]],
];

// [tiêu đề, màu hex, ngày bắt đầu (so với hôm nay), ngày kết thúc, thứ tự, link]
export const BANNERS = [
  ['Khai trương mùa mới – giảm đến 15% điện lạnh', '#1d6fb8', -10, 50, 1, '/products'],
  ['Tủ lạnh Inverter tiết kiệm điện', '#2a9d8f', -5, 60, 2, '/products?category=tu-lanh'],
  ['Máy giặt cửa trước – giặt sạch, êm ái', '#6a4c93', -5, 60, 3, '/products?category=may-giat'],
  ['Máy lạnh sẵn kho – giao lắp nhanh', '#e76f51', -2, 45, 4, '/products?category=may-lanh'],
  ['Ưu đãi sắp tới (chưa bắt đầu)', '#8d99ae', 20, 50, 5, '/products'],
];

export const CUSTOMERS = [
  // email, họ tên, sđt, địa chỉ [người nhận, sđt, dòng địa chỉ, phường/xã, quận/huyện, tỉnh/thành]
  ['customer@example.test', 'Nguyễn Minh', '0901234567', [
    ['Nguyễn Minh', '0901234567', '12 Nguyễn Văn Linh', 'Phường Tân Thuận Tây', 'Quận 7', 'TP. Hồ Chí Minh'],
    ['Nguyễn Minh (văn phòng)', '0901234567', '45 Lê Lợi', 'Phường Bến Thành', 'Quận 1', 'TP. Hồ Chí Minh']]],
  ['lan.tran@example.test', 'Trần Thị Lan', '0902345678', [
    ['Trần Thị Lan', '0902345678', '88 Trần Hưng Đạo', 'Phường Cầu Ông Lãnh', 'Quận 1', 'TP. Hồ Chí Minh']]],
  ['hung.le@example.test', 'Lê Quốc Hùng', '0903456789', [
    ['Lê Quốc Hùng', '0903456789', '25 Kim Mã', 'Phường Kim Mã', 'Quận Ba Đình', 'Hà Nội'],
    ['Lê Quốc Hùng', '0903456789', '102 Cầu Giấy', 'Phường Quan Hoa', 'Quận Cầu Giấy', 'Hà Nội']]],
  ['ha.pham@example.test', 'Phạm Thu Hà', '0904567890', [
    ['Phạm Thu Hà', '0904567890', '7 Hoàng Diệu', 'Phường Hải Châu 1', 'Quận Hải Châu', 'Đà Nẵng']]],
  ['tuan.vo@example.test', 'Võ Anh Tuấn', '0905678901', [
    ['Võ Anh Tuấn', '0905678901', '310 Nguyễn Văn Cừ', 'Phường An Hòa', 'Quận Ninh Kiều', 'Cần Thơ']]],
  ['mai.dang@example.test', 'Đặng Ngọc Mai', '0906789012', [
    ['Đặng Ngọc Mai', '0906789012', '56 Đại lộ Bình Dương', 'Phường Phú Hòa', 'TP. Thủ Dầu Một', 'Bình Dương'],
    ['Đặng Ngọc Mai', '0906789012', '19 Yersin', 'Phường Hiệp Thành', 'TP. Thủ Dầu Một', 'Bình Dương']]],
  ['khoa.bui@example.test', 'Bùi Đăng Khoa', '0907890123', [
    ['Bùi Đăng Khoa', '0907890123', '64 Lê Duẩn', 'Phường Điện Biên', 'Quận Ba Đình', 'Hà Nội']]],
  ['yen.hoang@example.test', 'Hoàng Hải Yến', '0908901234', [
    ['Hoàng Hải Yến', '0908901234', '150 Nguyễn Thị Minh Khai', 'Phường 6', 'Quận 3', 'TP. Hồ Chí Minh']]],
];

// [mã, loại, giá trị, đơn tối thiểu, giảm tối đa|null, bắt đầu (ngày), kết thúc (ngày), giới hạn|'AUTO', is_active]
// 'AUTO' = đúng bằng số lượt đã dùng trong dữ liệu đơn (voucher hết lượt).
export const VOUCHERS = [
  ['KHAITRUONG10', 'PERCENT', 10, 3000000, 1000000, -120, 120, 300, 1],
  ['MAYGIAT5', 'PERCENT', 5, 2000000, 600000, -90, 90, 200, 1],
  ['GIAM500K', 'FIXED', 500000, 15000000, null, -60, 90, 100, 1],
  ['THANTHIET', 'PERCENT', 7, 5000000, 800000, -100, 200, 50, 1],
  ['HETLUOT', 'FIXED', 300000, 3000000, null, -100, 60, 'AUTO', 1],
  ['HETHAN', 'PERCENT', 15, 4000000, 1500000, -200, -30, 100, 1],
  ['TETSALE', 'PERCENT', 12, 3000000, 1200000, 30, 60, 500, 1],
  ['TAMTAT', 'FIXED', 100000, 1000000, null, -60, 60, 100, 0],
];

export const REVIEW_TEXT = {
  5: ['Sản phẩm rất tốt, giao hàng nhanh, nhân viên lắp đặt nhiệt tình.', 'Chạy êm, tiết kiệm điện đúng như mô tả. Rất hài lòng.', 'Đóng gói cẩn thận, máy mới nguyên seal. Sẽ ủng hộ tiếp.', 'Đúng kích thước đã kiểm tra bằng FitCheck, đặt vừa khít chỗ trống.', 'Chất lượng tốt so với tầm giá, gia đình dùng rất ổn.'],
  4: ['Dùng ổn, giao hơi trễ một ngày nhưng sản phẩm tốt.', 'Máy chạy tốt, thiết kế đẹp, tiếc là hơi ồn lúc khởi động.', 'Đáng tiền, hướng dẫn sử dụng có thể rõ ràng hơn.', 'Hàng đúng mô tả, lắp đặt nhanh.'],
  3: ['Tạm ổn, chưa có gì nổi bật so với giá.', 'Sản phẩm bình thường, giao hàng đúng hẹn.'],
  2: ['Máy hơi ồn hơn mong đợi, đang liên hệ bảo hành.'],
  1: ['Hộp bị móp khi nhận hàng, đã yêu cầu đổi trả.'],
};
