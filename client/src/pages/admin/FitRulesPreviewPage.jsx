import { useEffect } from 'react';
import '../customer/decision-tools.css';

// Bản mẫu giúp quản trị duyệt cấu trúc quy tắc trước khi có API CRUD.
export default function FitRulesPreviewPage() {
  useEffect(() => { document.title = 'Quy tắc FitCheck · HomeCare'; }, []);
  return <section className="dt-page"><div className="hc-page-heading"><span className="hc-eyebrow">Quản trị · FIT-01</span><h1>Quy tắc FitCheck</h1><p>Cấu hình điều kiện theo danh mục hoặc sản phẩm; mỗi điều kiện có giải thích và mức ảnh hưởng.</p></div><div className="hc-demo-banner" role="note">Màn hình mẫu. Chưa có API quản trị quy tắc; ví dụ bên dưới không phải quy tắc đang áp dụng cho sản phẩm thật.</div><section className="hc-card"><h2>Một quy tắc cần những thông tin nào?</h2><div className="hc-table-wrap"><table className="hc-table"><thead><tr><th>Phạm vi</th><th>Dữ liệu sản phẩm</th><th>Dữ liệu phòng</th><th>Toán tử</th><th>Đơn vị</th><th>Mức</th><th>Trạng thái</th></tr></thead><tbody><tr><td>Danh mục tủ lạnh (ví dụ)</td><td>Chiều rộng + khoảng hở</td><td>Chiều rộng vị trí</td><td>≤</td><td>mm</td><td>Bắt buộc</td><td>Ví dụ</td></tr></tbody></table></div><div className="dt-note">Quy tắc thiếu dữ liệu đầu vào dẫn tới “Cần kiểm tra thêm”. Vi phạm quy tắc bắt buộc dẫn tới “Không phù hợp”. Quản trị chỉ chọn toán tử và trường cho phép; không nhập biểu thức mã nguồn.</div><button className="hc-button" type="button" disabled>Thêm quy tắc (chưa khả dụng)</button></section></section>;
}
