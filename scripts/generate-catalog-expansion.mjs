// Sinh server/db/seeds/012_catalog_expansion.sql: nhóm + danh mục theo https://www.dienmayxanh.com/danh-muc-nhom-hang
// (chỉ 5 nhóm đồ gia dụng; bỏ điện thoại/laptop/phụ kiện/máy cũ/dụng cụ), mỗi danh mục 6 sản phẩm giá thấp -> cao.
//   node scripts/generate-catalog-expansion.mjs
// Độc lập với generate-seed-data.mjs (không đụng 004..009 vì đơn hàng seed phụ thuộc danh sách sản phẩm cũ).
// Thương hiệu thật, nhưng tên model/giá/thông số là MÔ PHỎNG cho demo.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'server/db/seeds/012_catalog_expansion.sql');
const EXISTING = [['tu-lanh', 1], ['may-giat', 2], ['may-lanh', 3]]; // đã có từ seed 003, chỉ gắn vào nhóm Điện lạnh

// Nhóm: [tên, bảo hành (tháng), danh mục con]. Danh mục: [tên, loại hàng, 6 hãng (thấp -> cao), 6 mô tả, giá thấp nhất, giá cao nhất]
const GROUPS = [
  ['Điện lạnh, điện máy', 24, [
    ['Tivi', 'Smart Tivi', 'Casper,TCL,Xiaomi,Samsung,LG,Sony', '32 inch HD|43 inch Full HD|50 inch 4K|55 inch QLED 4K|65 inch Mini LED 4K|75 inch OLED 4K', 3.2e6, 52e6],
    ['Máy sấy quần áo', 'Máy sấy quần áo', 'Aqua,Midea,Electrolux,Panasonic,Samsung,LG', '7 kg thông hơi|8 kg ngưng tụ|8 kg bơm nhiệt|9 kg bơm nhiệt|10 kg bơm nhiệt Inverter|12 kg bơm nhiệt AI', 4.9e6, 32e6],
    ['Máy nước nóng', 'Máy nước nóng', 'Kangaroo,Picenza,Panasonic,Ariston,Ferroli,Rheem', 'trực tiếp 3500W|trực tiếp 4500W chống giật|gián tiếp 15L|gián tiếp 30L|bơm nhiệt 150L|bơm nhiệt 300L', 1.1e6, 19e6],
    ['Tủ mát', 'Tủ mát', 'Sanaky,Alaska,Darling,Hòa Phát,Sanden Intercool,Panasonic', '1 cánh 150L|1 cánh 230L|1 cánh 300L|2 cánh 450L|2 cánh 600L|3 cánh 1000L', 3e6, 26e6],
    ['Tủ đông', 'Tủ đông', 'Sanaky,Alaska,Darling,Hòa Phát,Sanden Intercool,Panasonic', 'dàn đồng 100L|dàn đồng 200L|dàn đồng 300L|1 ngăn đông 450L|2 ngăn đông mát 400L|2 ngăn đông mát 600L', 3.5e6, 22e6],
    ['Máy rửa chén', 'Máy rửa chén', 'Chefs,Hafele,Malloca,Electrolux,Bosch,Miele', 'độc lập 8 bộ|độc lập 10 bộ|độc lập 13 bộ|âm tủ 13 bộ|âm tủ 14 bộ sấy Zeolith|âm tủ 14 bộ Inverter', 6.5e6, 55e6],
    ['Loa, Dàn âm thanh', 'Loa', 'JBL,Sony,LG,Samsung,Marshall,Bose', 'Bluetooth mini|Bluetooth 20W|thanh 2.1 ch 300W|thanh Dolby Atmos 5.1.2 ch|dàn âm thanh 5.1 cao cấp|Hi-Fi 2.0 cao cấp', 3.5e5, 2e7],
    ['Micro', 'Micro', 'Boya,JBL,Shure,Sennheiser,Rode,Neumann', 'cài áo có dây|karaoke có dây|karaoke không dây đôi|thu âm USB|thu âm condenser|phòng thu condenser', 3e5, 16e6],
  ]],
  ['Điện gia dụng', 12, [
    ['Nồi cơm điện', 'Nồi cơm điện', 'Sunhouse,Kangaroo,Sharp,Toshiba,Panasonic,Zojirushi', 'cơ 1.2L|cơ 1.8L|điện tử 1.8L|cao tần IH 1.0L|cao tần IH 1.8L|áp suất cao tần IH 1.0L', 4.5e5, 9.5e6],
    ['Nồi chiên không dầu', 'Nồi chiên không dầu', 'Sunhouse,Kangaroo,Lock&Lock,Philips,Ninja,Instant', '3.5L|4.5L|5.5L|6.2L|7L hai ngăn|9L hai ngăn', 7e5, 6.5e6],
    ['Bếp từ', 'Bếp từ', 'Sunhouse,Kangaroo,Midea,Electrolux,Bosch,Miele', 'đơn 2000W|đơn cảm ứng 2100W|đôi 3400W|đôi 3800W Inverter|ba vùng nấu 7200W|âm 4 vùng cao cấp', 5e5, 3e7],
    ['Bếp hồng ngoại', 'Bếp hồng ngoại', 'Sunhouse,Kangaroo,Midea,Electrolux,Bosch,Teka', 'đơn 2000W|đơn 2200W|đôi 3500W|đôi âm 4000W|âm hai vùng cao cấp|âm 3 vùng cao cấp', 6e5, 11e6],
    ['Bình đun siêu tốc', 'Bình đun siêu tốc', 'Sunhouse,Kangaroo,Bear,Xiaomi,Philips,Tefal', '1.5L|1.7L|1.8L inox|1.7L chỉnh nhiệt|1.7L thủy tinh|1.7L giữ nhiệt thông minh', 1.5e5, 1.6e6],
    ['Bếp ga', 'Bếp gas', 'Sunhouse,Paloma,Kangaroo,Rinnai,Bosch,Teka', 'đơn|đôi mặt kiếng|đôi hồng ngoại|âm đôi|âm ba kính cường lực|âm hai Hybrid hồng ngoại', 4.5e5, 13e6],
    ['Lò vi sóng', 'Lò vi sóng', 'Sharp,Sunhouse,Toshiba,Panasonic,Samsung,Electrolux', '20L cơ|23L điện tử|25L có nướng|30L có nướng|32L đối lưu|43L âm tủ', 1.1e6, 13e6],
    ['Lò nướng', 'Lò nướng', 'Sunhouse,Kangaroo,Electrolux,Bosch,Teka,Miele', '12L điện cơ|20L đối lưu|30L 2 khay đối lưu|45L đối lưu|âm tủ 71L|âm tủ 76L hơi nước', 9e5, 25e6],
    ['Máy xay sinh tố', 'Máy xay sinh tố', 'Sunhouse,Kangaroo,Philips,Panasonic,Ninja,Vitamix', '0.6L cầm tay|1.5L cối nhựa|2L cối thủy tinh|1.5L công suất 1000W|2L chân không|2L chuyên nghiệp 1500W', 3.5e5, 16e6],
    ['Máy ép trái cây', 'Máy ép trái cây', 'Sunhouse,Kangaroo,Philips,Panasonic,Kuvings,Hurom', 'ép nhanh 400W|ép nhanh 500W|ép chậm 150W|ép chậm cối rộng|ép chậm trục xoắn đôi|ép chậm cao cấp', 6.5e5, 13e6],
    ['Máy làm sữa hạt', 'Máy làm sữa hạt', 'Sunhouse,Kangaroo,Bear,Philips,Joyoung,Panasonic', '0.8L|1.0L|1.2L|1.3L nấu nóng|1.75L đa năng|1.75L cao cấp', 1.2e6, 7e6],
    ['Máy vắt cam', 'Máy vắt cam', 'Sunhouse,Kangaroo,Philips,Panasonic,Tefal,Bosch', 'cơ vắt tay|điện 25W|điện 40W cần ép|điện 85W|điện 100W|chuyên dụng 160W', 2.5e5, 2.2e6],
    ['Nồi áp suất', 'Nồi áp suất', 'Sunhouse,Supor,Lock&Lock,Philips,Tefal,Instant Pot', 'inox 5L|inox 6L|điện 5L|điện 6L đa năng|điện đa năng 6L Pro|điện đa năng 8L', 6e5, 6e6],
    ['Lẩu điện', 'Lẩu điện', 'Sunhouse,Kangaroo,Bear,Philips,Tefal,Sharp', '1.5L|2L|3L|3.5L chống dính|4L chia ngăn|5L đa năng', 3.5e5, 2.4e6],
    ['Máy xay thịt', 'Máy xay thịt', 'Sunhouse,Kangaroo,Bear,Philips,Panasonic,Bosch', 'cối 1.5L|cối 2L|cối 2.5L inox|cối 3L 600W|điện 1000W|điện 1500W chuyên dụng', 4e5, 3.5e6],
    ['Máy nhồi bột, đánh trứng', 'Máy đánh trứng', 'Sunhouse,Kangaroo,Philips,Bosch,Kenwood,KitchenAid', 'cầm tay 150W|cầm tay 300W|để bàn 5L|để bàn 4.5L 800W|để bàn 6L 1000W|để bàn 4.8L Artisan', 3.5e5, 18e6],
    ['Bình thủy điện', 'Bình thủy điện', 'Sunhouse,Kangaroo,Sharp,Panasonic,Tiger,Zojirushi', '2.5L|3L|3.2L|4L|4L chân không|5L hâm nóng nhanh', 6e5, 5e6],
    ['Máy pha cà phê', 'Máy pha cà phê', 'Sunhouse,Kangaroo,Philips,Delonghi,Breville,Jura', 'phin 600ml|nhỏ giọt 1.2L|viên nén 1450W|bán tự động 15 bar|tự động xay sẵn|tự động cao cấp cảm ứng', 9e5, 60e6],
    ['Máy hút bụi', 'Máy hút bụi', 'Sunhouse,Philips,Xiaomi,Electrolux,Dyson,Dyson', 'cầm tay mini 120W|cầm tay 600W|cây 18V|giường nệm UV|không dây V8|không dây V15 Detect', 7e5, 22e6],
    ['Robot hút bụi', 'Robot hút bụi', 'Xiaomi,Ecovacs,Dreame,Roborock,Ecovacs,Roborock', 'lau nhà cơ bản|lực hút 4000Pa|LiDAR 5000Pa|tự giặt giẻ|tự đổ rác|tự đổ rác và giặt giẻ cao cấp', 2.9e6, 32e6],
    ['Máy lọc không khí', 'Máy lọc không khí', 'Xiaomi,Sharp,Philips,Panasonic,Daikin,Dyson', 'phòng 20m²|phòng 30m²|phòng 40m²|phòng 50m²|phòng 70m² HEPA|phòng 90m² tích hợp quạt', 1.4e6, 25e6],
    ['Quạt', 'Quạt', 'Senko,Asia,Midea,Mitsubishi Electric,Panasonic,Dyson', 'bàn|đứng cơ|đứng điều khiển|lửng Inverter|tháp không cánh|tạo ẩm lọc khí', 2.5e5, 14e6],
    ['Quạt điều hoà', 'Quạt điều hòa', 'Sunhouse,Kangaroo,Daikiosan,Boss,Hatari,Mitsubishi Electric', 'bình 20L|bình 30L|bình 40L|bình 50L|Inverter 55L|Inverter 70L cảm ứng', 1.6e6, 9e6],
    ['Máy hút ẩm', 'Máy hút ẩm', 'Kangaroo,Sunhouse,Midea,Sharp,Panasonic,Daikin', '12L/ngày|16L/ngày|20L/ngày|25L/ngày|30L/ngày|50L/ngày công nghiệp', 2.2e6, 16e6],
    ['Quạt sưởi', 'Quạt sưởi', 'Sunhouse,Kangaroo,Mishio,Sharp,Panasonic,Dyson', 'gốm 1200W|gốm 2000W|dầu 9 thanh|dầu 11 thanh|gốm Inverter|sưởi và mát', 4e5, 14e6],
    ['Bàn ủi', 'Bàn ủi', 'Sunhouse,Philips,Panasonic,Tefal,Bosch,Philips', 'khô|hơi nước cầm tay|hơi nước 2000W|hơi nước 2400W|đứng 1800W|nồi hơi', 1.6e5, 8e6],
    ['Tủ sấy quần áo', 'Tủ sấy quần áo', 'Sunhouse,Kangaroo,Fujiko,Xiaomi,Panasonic,Electrolux', 'gấp gọn 15kg|1 tầng 10kg|2 tầng|có UV 15kg|có UV 20kg|bơm nhiệt', 1.5e6, 9e6],
    ['Máy hút mùi', 'Máy hút mùi', 'Sunhouse,Kangaroo,Hafele,Teka,Bosch,Faber', 'cổ điển 70cm|cổ điển 90cm|kính vát 70cm|kính cong 90cm|âm tủ|đảo trung tâm 90cm', 1.6e6, 28e6],
    ['Quạt trần', 'Quạt trần', 'Asia,Senko,Vinawind,Panasonic,Mitsubishi Electric,Fanco', '3 cánh gỗ|3 cánh điều khiển|4 cánh đèn|5 cánh đèn LED|5 cánh DC Inverter|trang trí cao cấp', 6e5, 9e6],
    ['Ổ cắm', 'Ổ cắm điện', 'Điện Quang,Lioa,Rạng Đông,Panasonic,Schneider,Legrand', '3 lỗ 2m|4 lỗ 3m|6 lỗ 3m chống giật|6 lỗ cổng USB|8 lỗ chống sét|âm tường cao cấp', 6e4, 1.1e6],
    ['Đèn điện, đèn sạc', 'Đèn', 'Rạng Đông,Điện Quang,Philips,Xiaomi,Panasonic,Xiaomi', 'bàn LED|sạc cầm tay|để bàn chống cận|sạc 2 chế độ|bàn thông minh|ốp trần thông minh', 9e4, 2.2e6],
    ['Vợt muỗi', 'Vợt muỗi', 'Sunhouse,Kangaroo,Điện Quang,Xiaomi,Bear,Philips', 'sạc cơ bản|sạc có đèn LED|2 lớp lưới|đèn bắt muỗi|để bàn đèn UV|đèn UV cao cấp', 6e4, 8e5],
    ['Bóng đèn', 'Bóng đèn LED', 'Điện Quang,Rạng Đông,Philips,Panasonic,Xiaomi,Philips Hue', 'bulb 5W|bulb 9W|bulb 12W|tuýp 1m2|bulb thông minh|bulb thông minh đổi màu', 2.5e4, 5.5e5],
    ['Máy sấy giày', 'Máy sấy giày', 'Sunhouse,Kangaroo,Fujiko,Xiaomi,Philips,Panasonic', 'khử mùi mini|sấy khô cơ bản|sấy 2 đôi|UV khử khuẩn|sấy 4 đôi UV|tủ sấy giày UV', 4e5, 3e6],
    ['Chăn điện sưởi ấm', 'Chăn điện', 'Sunhouse,Kangaroo,Mishio,Sharp,Panasonic,Hanil', 'đơn|đôi|đơn Inverter|đôi an toàn 2 vùng|đôi 4 vùng|đôi điều khiển từ xa', 3e5, 2.4e6],
  ]],
  ['Máy lọc nước', 12, [
    ['Máy lọc nước', 'Máy lọc nước', 'Sunhouse,Karofi,Kangaroo,Mutosi,Toshiba,A.O. Smith', 'RO 6 lõi|RO 8 lõi|RO 9 lõi để gầm|RO nóng lạnh|RO nóng nguội lạnh|RO 10 lõi Hydrogen', 2.2e6, 28e6],
    ['Lọc nước điện giải', 'Máy lọc nước điện giải', 'Kangaroo,Karofi,Mutosi,Cuckoo,Panasonic,Enagic Kangen', 'Hydrogen 7 lõi|Hydrogen 9 lõi|3 tấm điện cực|5 tấm điện cực|7 tấm điện cực|9 tấm điện cực', 8e6, 95e6],
    ['Cây nước nóng lạnh', 'Cây nước nóng lạnh', 'Sunhouse,Kangaroo,Karofi,Sharp,Toshiba,Daikiosan', 'compressor làm lạnh|nóng lạnh cơ bản|bình úp|bình âm|nóng lạnh tích hợp lọc RO|nóng nguội lạnh cảm ứng', 1.8e6, 9e6],
    ['Lọc Tổng Đầu Nguồn', 'Lọc tổng đầu nguồn', 'Karofi,Kangaroo,Mutosi,Sunhouse,Toshiba,Aquafilter', 'cột 10 inch|cột composite|bộ 2 cột|bộ 3 cột|cột inox công suất lớn|hệ thống Pro', 1.2e6, 18e6],
    ['Cốc lọc đầu nguồn', 'Cốc lọc đầu nguồn', 'Karofi,Kangaroo,Sunhouse,Mutosi,Toshiba,Aquafilter', '10 inch|20 inch|cốc đơn 10 inch|cốc đôi|cốc 3 cấp|cốc 3 cấp inox', 2.5e5, 3.5e6],
    ['Lõi máy lọc nước', 'Lõi lọc nước', 'Sunhouse,Kangaroo,Karofi,Mutosi,Toshiba,A.O. Smith', 'PP 5 micron|than hoạt tính|RO 75 GPD|bộ 3 lõi 1-2-3|bộ 5 lõi|bộ 9 lõi thay thế', 8e4, 2.2e6],
  ]],
  ['Đồ gia dụng', 6, [
    ['Chảo', 'Chảo', 'Elmich,Sunhouse,Lock&Lock,Tefal,Fissler,Zwilling', 'chống dính 20cm|chống dính 24cm|chống dính 26cm vân đá|chống dính 28cm|đáy từ 28cm|đáy từ cao cấp 28cm', 9e4, 3.2e6],
    ['Nồi, bộ nồi', 'Bộ nồi', 'Sunhouse,Elmich,Lock&Lock,Tefal,Fissler,Zwilling', '3 món inox|3 món chống dính|4 món|5 món inox 304|5 món từ|7 món cao cấp', 3.5e5, 8e6],
    ['Bộ lau nhà', 'Bộ lau nhà', 'Sunhouse,Elmich,Lock&Lock,Kangaroo,Xiaomi,Bosch', 'cây lau bông|cây lau xoay|xoay 360 độ|vắt thông minh|tự vắt cao cấp|lau hút bụi không dây', 1.2e5, 3.5e6],
    ['Bình, ly giữ nhiệt', 'Bình giữ nhiệt', 'Sunhouse,Elmich,Lock&Lock,Tiger,Zojirushi,Stanley', '350ml|500ml|750ml|1L|1.2L|1.2L cao cấp', 1e5, 1.9e6],
    ['Mũ bảo hiểm', 'Mũ bảo hiểm', 'Protec,Andes,Royal,Asia,AGV,Shoei', 'nửa đầu|3/4 đầu|3/4 kính|fullface|fullface cao cấp|fullface carbon', 1.2e5, 9e6],
    ['Dao', 'Dao', 'Elmich,Sunhouse,Lock&Lock,Tojiro,Zwilling,Global', 'thái|chặt|bếp inox|thái Nhật|Chef 20cm|bộ 5 dao', 6e4, 6e6],
    ['Thớt', 'Thớt', 'Sunhouse,Elmich,Lock&Lock,Inochi,Zwilling,Boos', 'nhựa PP|gỗ cao su|gỗ tre|kháng khuẩn|gỗ teak|gỗ óc chó', 4e4, 1.8e6],
    ['Kéo', 'Kéo', 'Elmich,Sunhouse,Lock&Lock,Tojiro,Zwilling,Global', 'cắt giấy|nhà bếp|cắt gà|cắt thực phẩm đa năng|inox cao cấp|bếp cao cấp', 2.5e4, 1.1e6],
    ['Thau, rổ, gáo nước', 'Bộ thau rổ', 'Duy Tân,Việt Nhật,Inochi,Lock&Lock,Elmich,Tupperware', 'thau nhựa|rổ nhựa|gáo nước|3 món|bộ inox|bộ cao cấp', 1.5e4, 4e5],
    ['Muỗng, đũa', 'Bộ muỗng đũa', 'Sunhouse,Elmich,Lock&Lock,Inochi,Zwilling,Tupperware', 'đũa tre|muỗng inox|đũa inox 304|bộ 6 muỗng nĩa|bộ 24 món|bộ 30 món cao cấp', 2e4, 1.2e6],
    ['Móc kẹp quần áo', 'Móc kẹp quần áo', 'Duy Tân,Inochi,Elmich,Lock&Lock,Sunhouse,Xiaomi', 'móc nhựa 20 cái|kẹp nhựa 24 cái|móc inox 12 cái|kẹp inox 30 cái|móc nhung 50 cái|móc xoay inox', 2e4, 6e5],
    ['Khay, ly làm đá', 'Khay làm đá', 'Duy Tân,Inochi,Lock&Lock,Elmich,Tupperware,Bear', 'nhựa 12 viên|nhựa 24 viên|silicon có nắp|2 tầng có nắp|viên tròn|thanh dài', 2e4, 3.5e5],
    ['Ổ khóa', 'Ổ khóa', 'Việt Tiệp,Huy Hoàng,Solex,Yale,Philips,Samsung', 'cửa móc|treo thép|cửa tay gạt|vân tay mini|vân tay thông minh|vân tay và camera', 4e4, 9e6],
    ['Thùng rác', 'Thùng rác', 'Duy Tân,Inochi,Lock&Lock,Sunhouse,Xiaomi,Simplehuman', 'nhựa 10L|đạp 15L|nắp lật 20L|đạp inox 30L|cảm ứng 10L|cảm ứng 45L inox', 5e4, 4.5e6],
    ['Khay - kệ đựng đồ', 'Kệ đựng đồ', 'Duy Tân,Inochi,Sunhouse,Lock&Lock,Elmich,IKEA', 'khay nhựa|kệ 3 tầng nhựa|kệ nhà bếp inox|kệ bếp xoay|kệ góc inox 304|kệ 4 tầng cao cấp', 6e4, 2.2e6],
    ['Bình đựng nước', 'Bình đựng nước', 'Duy Tân,Inochi,Lock&Lock,Sunhouse,Elmich,Tupperware', 'nhựa 1L|nhựa 2L|thủy tinh 1.2L|thủy tinh 1.5L có nắp|inox 2L|thủy tinh cao cấp 2L', 4e4, 9e5],
    ['Dụng cụ vắt cam', 'Dụng cụ vắt cam', 'Inochi,Lock&Lock,Elmich,Sunhouse,Zwilling,OXO', 'nhựa|inox tay cầm|ép chanh|đa năng|inox 304|cao cấp', 2.5e4, 5.5e5],
    ['Dụng cụ mài dao', 'Dụng cụ mài dao', 'Elmich,Sunhouse,Tojiro,Zwilling,Global,Shapton', 'đá mài 2 mặt|mài cầm tay|mài 3 giai đoạn|đá mài Nhật|bộ mài 2 đá|bộ mài chuyên nghiệp', 3e4, 1.8e6],
    ['Miếng rửa chén, cọ chùi', 'Miếng rửa chén', 'Sunhouse,Inochi,Lock&Lock,Elmich,3M,Scotch-Brite', 'miếng 3 cái|cước 5 cái|cọ chén|cọ nồi|bộ cọ 4 món|bộ vệ sinh bếp', 1e4, 2.5e5],
    ['Hộp đựng thực phẩm', 'Hộp đựng thực phẩm', 'Duy Tân,Inochi,Lock&Lock,Elmich,Tupperware,Pyrex', 'nhựa 500ml|nhựa 1L|bộ 3 hộp|thủy tinh 800ml|bộ 5 hộp thủy tinh|bộ 10 hộp cao cấp', 3e4, 1.5e6],
    ['Tô, chén, dĩa', 'Bộ chén dĩa', 'Minh Long,Duy Tân,Inochi,Lock&Lock,Corelle,Noritake', 'nhựa melamine|sứ 4 món|sứ 10 món|thủy tinh 12 món|sứ cao cấp 18 món|sứ xương 24 món', 2e4, 3.5e6],
    ['Hộp đựng đồ đa năng', 'Hộp đựng đồ', 'Duy Tân,Inochi,Lock&Lock,Sunhouse,Elmich,IKEA', 'nhựa 10L|nhựa 20L|có bánh xe 30L|gấp gọn 40L|có nắp 60L|tủ nhựa 5 ngăn', 4e4, 1.8e6],
  ]],
  ['Làm đẹp, chăm sóc cá nhân', 12, [
    ['Máy tạo ẩm', 'Máy tạo ẩm', 'Xiaomi,Sunhouse,Kangaroo,Philips,Panasonic,Dyson', 'siêu âm 2L|siêu âm 3L|sương lạnh 4L|bay hơi 5L|tạo ẩm lọc khí|tạo ẩm cao cấp', 2.5e5, 12e6],
    ['Máy massage cá nhân', 'Máy massage', 'Xiaomi,Sunhouse,Beurer,Omron,Panasonic,Ogawa', 'cổ vai gáy|lưng đa năng|xung điện EMS|cổ vai gáy nhiệt|lưng cổ cao cấp|toàn thân', 3e5, 8e6],
    ['Ghế massage', 'Ghế massage', 'Kingsport,Elip,Fuji Luxury,Ogawa,Panasonic,Inada', '4D cơ bản|3D trượt chân|4D túi khí|4D AI|4D chân không|SL track cao cấp', 1.2e7, 1.1e8],
    ['Bồn ngâm chân', 'Bồn ngâm chân', 'Sunhouse,Kangaroo,Beurer,Panasonic,Ogawa,Fuji Luxury', 'nhựa gấp gọn|massage rung|massage con lăn|sưởi 2 ngăn|spa nâng cao|spa tự động', 3.5e5, 4.5e6],
    ['Máy tăm nước', 'Máy tăm nước', 'Xiaomi,Oral-B,Philips,Panasonic,Waterpik,Waterpik', 'cầm tay|bình 200ml|bình 600ml|3 chế độ|5 chế độ|Pro bình 700ml', 4e5, 3.5e6],
    ['Súng massage cầm tay', 'Súng massage', 'Xiaomi,Sunhouse,Beurer,Panasonic,Hyperice,Therabody', 'mini|4 đầu|6 đầu|20 tốc độ|Pro 30 tốc độ|Elite', 4e5, 9e6],
    ['Bàn chải điện', 'Bàn chải điện', 'Xiaomi,Oral-B,Philips,Panasonic,Oral-B,Philips Sonicare', 'pin AA|sạc 2 chế độ|3 chế độ|sonic 5 chế độ|AI Series 7|AI Series 9', 2.5e5, 6e6],
    ['Cân sức khoẻ', 'Cân sức khỏe', 'Xiaomi,Sunhouse,Omron,Tanita,Beurer,Withings', 'cơ|điện tử|thủy tinh|đo mỡ cơ thể|Bluetooth thông minh|phân tích 8 điện cực', 1.5e5, 5e6],
    ['Máy massage chân', 'Máy massage chân', 'Sunhouse,Xiaomi,Beurer,Panasonic,Ogawa,Fuji Luxury', 'rung|con lăn|nén khí|nén khí và nhiệt|bắp chân|toàn bộ chân cao cấp', 7e5, 1.3e7],
    ['Siêu sắc thuốc', 'Siêu sắc thuốc', 'Sunhouse,Kangaroo,Bear,Philips,Panasonic,Joyoung', '2L|2.5L|3.2L|4L|5L|6L đa năng', 1.2e6, 4e6],
    ['Máy massage mắt', 'Máy massage mắt', 'Xiaomi,Sunhouse,Beurer,Panasonic,Ogawa,Fuji Luxury', 'rung|nhiệt|nhiệt và rung|nén khí|Bluetooth|cao cấp', 3e5, 6e6],
    ['Bàn chải điện trẻ em', 'Bàn chải điện trẻ em', 'Xiaomi,Oral-B,Philips,Panasonic,Colgate,Philips Sonicare', 'pin|sạc|3 chế độ|hình thú|Kids Bluetooth|Kids Bluetooth cao cấp', 2e5, 2e6],
    ['Máy massage đầu', 'Máy massage đầu', 'Xiaomi,Sunhouse,Beurer,Panasonic,Ogawa,Fuji Luxury', 'cầm tay 8 chấu|cào đầu 20 chấu|điện 3 chế độ|nhiệt và rung|dạng mũ|dạng mũ cao cấp', 3e5, 4.5e6],
    ['Máy sấy tóc', 'Máy sấy tóc', 'Sunhouse,Xiaomi,Philips,Panasonic,Dyson,Dyson', '1200W|1800W|2000W ion|ion nanoe|Supersonic|Supersonic Nural', 1.5e5, 1e7],
    ['Máy cạo râu', 'Máy cạo râu', 'Xiaomi,Philips,Panasonic,Remington,Braun,Braun', '1 lưỡi|2 lưỡi|3 lưỡi|3 lưỡi khô ướt|Series 7|Series 9 Pro', 2e5, 8e6],
    ['Máy triệt lông', 'Máy triệt lông', 'Xiaomi,Philips,Braun,Panasonic,Remington,Philips', 'IPL cơ bản|IPL 3 chế độ|IPL Silk-expert|IPL Lumea 7000|IPL Lumea 9900|IPL Pro cao cấp', 8e5, 14e6],
    ['Máy tỉa lông mũi', 'Máy tỉa lông mũi', 'Xiaomi,Philips,Panasonic,Remington,Braun,Wahl', 'pin AA|pin sạc|rửa nước|2 đầu|đa năng|bộ cao cấp', 9e4, 6e5],
    ['Tông đơ cắt tóc', 'Tông đơ cắt tóc', 'Xiaomi,Philips,Panasonic,Wahl,Braun,Andis', 'có dây|không dây|3 lược|thân kim loại|salon|salon cao cấp', 2e5, 3.5e6],
    ['Máy rửa mặt', 'Máy rửa mặt', 'Xiaomi,Philips,Panasonic,Foreo,Clarisonic,Foreo', 'silicon 1 mặt|silicon sạc|rung 3 chế độ|sonic 2 mặt|sonic cao cấp|thông minh', 3e5, 5e6],
    ['Máy tạo kiểu tóc', 'Máy tạo kiểu tóc', 'Xiaomi,Philips,Panasonic,Remington,Dyson,Dyson', 'kẹp thẳng mini|kẹp thẳng 200°C|uốn xoăn 32mm|chải sấy 3 trong 1|Airwrap|Airwrap Complete Long', 3.5e5, 13e6],
    ['Mặt nạ chăm sóc da', 'Mặt nạ ánh sáng LED', 'Xiaomi,Philips,Panasonic,Foreo,Shark,CurrentBody', '3 màu|5 màu|7 màu|LED và nhiệt|LED hồng ngoại cao cấp|toàn mặt Pro', 7e5, 11e6],
  ]],
];

// ---------- tiện ích ----------
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const assert = (c, m) => { if (!c) throw new Error(`Assert failed: ${m}`); };
const stepOf = (p) => (p < 1e5 ? 1e4 : p < 1e6 ? 5e4 : p < 1e7 ? 1e5 : 1e6);
const priceOf = (p) => { const s = stepOf(p); return Math.round(p / s) * s - s / 10; }; // 1.290.000, 24.900.000, 95.000 ...
let seed = 20261115; // PRNG cố định: chạy lại cho cùng kết quả
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- sinh SQL ----------
let s = '-- Seed 012 — nhóm + danh mục + sản phẩm theo dienmayxanh.com/danh-muc-nhom-hang (chỉ 5 nhóm đồ gia dụng).\n'
  + '-- FILE SINH TỰ ĐỘNG bởi scripts/generate-catalog-expansion.mjs — đừng sửa tay. Dữ liệu MÔ PHỎNG cho demo:\n'
  + '-- thương hiệu thật, nhưng tên model, giá và thông số không phải của sản phẩm thật. Cần 001, 003 và migration 011 (sort_order).\n'
  + '-- Không thêm ảnh: trang hiển thị "Chưa có hình ảnh" cho tới khi ADMIN tải ảnh lên.\n\n';
const slugs = new Set(EXISTING.map(([x]) => x)), brands = new Set(), skus = new Set();
let nCat = 0, nProd = 0, pIdx = 0;

for (const [gi, [gname, warranty, cats]] of GROUPS.entries()) {
  const gslug = `nhom-${slugify(gname)}`;
  assert(!slugs.has(gslug), `slug nhóm trùng ${gslug}`); slugs.add(gslug);
  s += `\n-- ===== ${gname} =====\nINSERT IGNORE INTO categories (name, slug, sort_order) VALUES (${q(gname)}, ${q(gslug)}, ${gi + 1});\n`;
  if (gi === 0) s += `UPDATE categories c JOIN categories g ON g.slug = ${q(gslug)} SET c.parent_id = g.id WHERE c.slug IN (${EXISTING.map(([x]) => q(x)).join(', ')}) AND c.parent_id IS NULL;\n`;
  let order = gi === 0 ? EXISTING.length : 0;
  for (const [cname, noun, brandCsv, descBar, lo, hi] of cats) {
    const cslug = slugify(cname), bs = brandCsv.split(','), ds = descBar.split('|');
    assert(!slugs.has(cslug), `slug danh mục trùng ${cslug}`); slugs.add(cslug);
    assert(bs.length === 6 && ds.length === 6, `${cname}: cần đúng 6 hãng và 6 mô tả`);
    s += `\nINSERT IGNORE INTO categories (name, slug, parent_id, sort_order) SELECT ${q(cname)}, ${q(cslug)}, g.id, ${++order} FROM categories g WHERE g.slug = ${q(gslug)};\n`;
    nCat++;
    let prev = 0;
    for (let i = 0; i < 6; i++) {
      const brand = bs[i], name = `${noun} ${brand} ${ds[i]}`, price = priceOf(lo * (hi / lo) ** (i / 5));
      assert(price > prev, `${cname}: giá phải tăng dần (${price} <= ${prev})`); prev = price;
      const sale = i % 3 === 1 ? Math.floor(price * 0.93 / 1000) * 1000 : null; // 1 SP trong 3 có khuyến mãi ~7%
      assert(sale === null || (sale > 0 && sale < price), `${name}: giá khuyến mãi`);
      const code = `SP-${String(++pIdx).padStart(4, '0')}`, sku = `${code}-01`, pslug = `${cslug}-${code.toLowerCase()}`;
      assert(!skus.has(sku), 'SKU trùng'); skus.add(sku);
      const stock = rnd() < 0.06 ? 0 : price < 5e5 ? 30 + Math.floor(rnd() * 90) : price < 5e6 ? 8 + Math.floor(rnd() * 33) : 2 + Math.floor(rnd() * 14); // vài SP hết hàng
      if (!brands.has(brand)) { brands.add(brand); s += `INSERT IGNORE INTO brands (name) VALUES (${q(brand)});\n`; }
      const desc = `${name} – dữ liệu mô phỏng cho demo; tên model, giá và thông số không phải của sản phẩm thật.`;
      s += `INSERT IGNORE INTO products (category_id, brand_id, product_code, name, slug, description, specifications, warranty_months) SELECT c.id, b.id, ${q(code)}, ${q(name)}, ${q(pslug)}, ${q(desc)}, JSON_OBJECT('Phân loại', ${q(ds[i])}, 'Năm sản xuất', ${2024 + (i % 2)}), ${warranty} FROM categories c JOIN brands b ON b.name = ${q(brand)} WHERE c.slug = ${q(cslug)};\n`;
      s += `INSERT IGNORE INTO product_variants (product_id, sku, variant_name, price, sale_price, sale_starts_at, sale_ends_at, stock_quantity, low_stock_threshold) SELECT p.id, ${q(sku)}, 'Tiêu chuẩn', ${price}, ${sale ?? 'NULL'}, ${sale ? 'UTC_TIMESTAMP()' : 'NULL'}, ${sale ? 'UTC_TIMESTAMP() + INTERVAL 30 DAY' : 'NULL'}, 0, ${price < 5e5 ? 10 : 5} FROM products p WHERE p.product_code = ${q(code)};\n`;
      if (stock > 0) { // tồn kho luôn đi qua inventory_movements (như seed 004)
        s += `INSERT IGNORE INTO inventory_movements (variant_id, movement_type, quantity_change, quantity_before, quantity_after, reference_code, note, performed_by) SELECT v.id, 'import', ${stock}, v.stock_quantity, v.stock_quantity + ${stock}, ${q(`SEED-${sku}`)}, 'Nhập kho dữ liệu demo', u.id FROM product_variants v JOIN users u ON u.email = 'admin@example.test' WHERE v.sku = ${q(sku)} AND v.stock_quantity = 0;\n`;
        s += `UPDATE product_variants v JOIN inventory_movements m ON m.variant_id = v.id AND m.reference_code = ${q(`SEED-${sku}`)} SET v.stock_quantity = m.quantity_after WHERE v.sku = ${q(sku)} AND v.stock_quantity = m.quantity_before AND NOT EXISTS (SELECT 1 FROM inventory_movements o WHERE o.variant_id = v.id AND o.id <> m.id);\n`;
      }
      nProd++;
    }
  }
}
writeFileSync(OUT, s, 'utf8');
console.log(`${GROUPS.length} nhóm, ${nCat} danh mục, ${brands.size} thương hiệu mới, ${nProd} sản phẩm -> ${OUT}`);
