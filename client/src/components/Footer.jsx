import { Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#1F2937] text-[#94A3B8]">
      {/* MAIN FOOTER */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* BRAND */}
          <div>
            <Link to="/" className="mb-4 inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#176B87] text-white">
                <span className="text-lg font-bold">⌂</span>
              </div>

              <div>
                <div className="text-xl font-bold leading-none text-white">
                  HomeCare
                </div>

                <div className="mt-1 text-xs text-[#94A3B8]">
                  Thiết bị tốt – Chăm sóc tận tâm
                </div>
              </div>
            </Link>

            <p className="max-w-xs text-sm leading-6">
              Chuyên cung cấp thiết bị gia dụng chính hãng với dịch vụ bảo hành,
              sửa chữa tận tâm tại nhà.
            </p>

            <div className="mt-5 flex gap-3">
              <a
                href="#facebook"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#374151] text-white transition-colors hover:bg-[#176B87]"
              >
                <span className="text-sm font-bold">f</span>
              </a>

              <a
                href="#youtube"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#374151] text-white transition-colors hover:bg-[#176B87]"
              >
                <span className="text-sm font-bold">▶</span>
              </a>
            </div>
          </div>

          {/* PRODUCTS */}
          <div>
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wide text-[#64CCC5]">
              SẢN PHẨM
            </h3>

            <div className="flex flex-col gap-3 text-sm">
              <Link
                to="/products?category=tu-lanh"
                className="transition-colors hover:text-white"
              >
                Tủ lạnh
              </Link>

              <Link
                to="/products?category=may-giat"
                className="transition-colors hover:text-white"
              >
                Máy giặt
              </Link>

              <Link
                to="/products?category=dieu-hoa"
                className="transition-colors hover:text-white"
              >
                Điều hòa
              </Link>

              <Link
                to="/products?category=may-loc-nuoc"
                className="transition-colors hover:text-white"
              >
                Máy lọc nước
              </Link>

              <Link
                to="/products?category=lo-vi-song"
                className="transition-colors hover:text-white"
              >
                Lò vi sóng
              </Link>

              <Link
                to="/products?category=may-hut-bui"
                className="transition-colors hover:text-white"
              >
                Máy hút bụi
              </Link>
            </div>
          </div>

          {/* SERVICES */}
          <div>
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wide text-[#64CCC5]">
              DỊCH VỤ
            </h3>

            <div className="flex flex-col gap-3 text-sm">
              <a
                href="#register-warranty"
                className="transition-colors hover:text-white"
              >
                Đăng ký bảo hành
              </a>

              <a
                href="#warranty"
                className="transition-colors hover:text-white"
              >
                Tra cứu bảo hành
              </a>

              <a href="#repair" className="transition-colors hover:text-white">
                Yêu cầu sửa chữa
              </a>

              <a
                href="#technician"
                className="transition-colors hover:text-white"
              >
                Đặt lịch kỹ thuật viên
              </a>

              <a
                href="#tracking"
                className="transition-colors hover:text-white"
              >
                Theo dõi sửa chữa
              </a>

              <a href="#history" className="transition-colors hover:text-white">
                Lịch sử bảo hành
              </a>
            </div>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wide text-[#64CCC5]">
              LIÊN HỆ
            </h3>

            <div className="flex flex-col gap-4 text-sm">
              <div className="flex items-center gap-3">
                <Phone size={16} className="flex-shrink-0 text-[#64CCC5]" />

                <span>1800 6868 (Miễn phí)</span>
              </div>

              <div className="flex items-center gap-3">
                <Mail size={16} className="flex-shrink-0 text-[#64CCC5]" />

                <span>cskh@homecare.vn</span>
              </div>

              <div className="flex items-start gap-3">
                <MapPin
                  size={16}
                  className="mt-0.5 flex-shrink-0 text-[#64CCC5]"
                />

                <span>123 Nguyễn Huệ, Q.1, TP. HCM</span>
              </div>
            </div>

            {/* TRUST BADGE */}
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              <ShieldCheck size={17} className="text-green-400" />

              <span className="text-white">Sản phẩm chính hãng 100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs md:flex-row md:items-center md:justify-between">
          <p>© 2024 HomeCare. Tất cả quyền được bảo lưu.</p>

          <div className="flex flex-wrap gap-5">
            <a href="#privacy" className="transition-colors hover:text-white">
              Chính sách bảo mật
            </a>

            <a href="#terms" className="transition-colors hover:text-white">
              Điều khoản sử dụng
            </a>

            <a href="#return" className="transition-colors hover:text-white">
              Chính sách đổi trả
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
