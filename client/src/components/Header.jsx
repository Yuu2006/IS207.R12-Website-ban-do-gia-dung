import {
  Search,
  ShoppingCart,
  User,
  Menu,
} from "lucide-react";

import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">

        {/* LOGO */}
        <Link
          to="/"
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176B87] text-white">
            <span className="text-lg font-bold">H</span>
          </div>

          <div>
            <div className="text-lg font-bold leading-none text-[#176B87]">
              HomeCare
            </div>

            <div className="mt-1 text-[10px] text-[#64748B]">
              Thiết bị tốt – Chăm sóc tận tâm
            </div>
          </div>
        </Link>

        {/* NAVIGATION */}
        <nav className="hidden flex-1 items-center justify-center gap-3 md:flex">

          {/* TRANG CHỦ */}
          <Link
            to="/"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname === "/"
                ? "bg-[#E8F4F7] text-[#176B87]"
                : "text-[#1F2937] hover:text-[#176B87]"
            }`}
          >
            Trang chủ
          </Link>

          {/* SẢN PHẨM */}
          <Link
            to="/products"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname.startsWith("/products")
                ? "bg-[#E8F4F7] text-[#176B87]"
                : "text-[#1F2937] hover:text-[#176B87]"
            }`}
          >
            Sản phẩm
          </Link>

          {/* BẢO HÀNH */}
          <Link
            to="/warranty"
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname.startsWith("/warranty")
                ? "bg-[#E8F4F7] text-[#176B87]"
                : "text-[#1F2937] hover:text-[#176B87]"
            }`}
          >
            Bảo hành & Sửa chữa
          </Link>

          {/* ĐƠN HÀNG */}
          <Link
            to="/orders"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname.startsWith("/orders")
                ? "bg-[#E8F4F7] text-[#176B87]"
                : "text-[#1F2937] hover:text-[#176B87]"
            }`}
          >
            Đơn hàng
          </Link>

        </nav>

        {/* ACTIONS */}
        <div className="ml-auto flex items-center gap-2">

          <Link
            to="/products"
            className="hidden h-9 items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#64748B] transition-colors hover:border-[#176B87] hover:text-[#176B87] sm:flex"
          >
            <Search size={16} />
            <span>Tìm kiếm</span>
          </Link>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#176B87] hover:text-[#176B87]"
          >
            <ShoppingCart size={17} />
          </button>

          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#176B87] hover:text-[#176B87] sm:flex"
          >
            <User size={17} />
          </button>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] md:hidden"
          >
            <Menu size={18} />
          </button>

        </div>
      </div>
    </header>
  );
}