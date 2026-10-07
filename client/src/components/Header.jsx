import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
} from "lucide-react";

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";

// Header chung của storefront; đơn hàng và tài khoản dùng cùng phiên khách hàng.
export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useCustomerAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setMenuOpen(false); setError(""); }, [location.pathname]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    try { await signOut(); navigate("/", { replace: true }); }
    catch (failure) { setError(failure.message || "Chưa thể đăng xuất. Hãy thử lại."); }
    finally { setSigningOut(false); }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-6">

        {/* LOGO */}
        <Link
          to="/"
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176B87] text-white">
            <span className="text-lg font-bold">H</span>
          </div>

          <div>
            <div className="text-base font-bold leading-none text-[#176B87] sm:text-lg">
              HomeCare
            </div>

            <div className="mt-1 hidden text-[10px] text-[#64748B] sm:block">
              Thiết bị tốt – Chăm sóc tận tâm
            </div>
          </div>
        </Link>

        {/* NAVIGATION */}
        <nav className="hidden flex-1 items-center justify-center gap-3 lg:flex">

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
            aria-current={location.pathname.startsWith("/orders") ? "page" : undefined}
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
            className="hidden h-9 items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#64748B] transition-colors hover:border-[#176B87] hover:text-[#176B87] xl:flex"
          >
            <Search size={16} />
            <span>Tìm kiếm</span>
          </Link>

          <Link
            to="/checkout"
            aria-label="Giỏ hàng và thanh toán"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#176B87] hover:text-[#176B87]"
          >
            <ShoppingCart size={17} />
          </Link>

          <Link
            to={user ? "/orders" : "/login"}
            aria-label={user ? `Tài khoản ${user.fullName || "khách hàng"}` : "Đăng nhập"}
            className="flex h-9 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] px-2 text-[#64748B] transition-colors hover:border-[#176B87] hover:text-[#176B87]"
          >
            <User size={17} />
            {user && <span className="hidden max-w-28 truncate text-xs lg:inline">{user.fullName || "Tài khoản"}</span>}
          </Link>

          {user && <button type="button" aria-label="Đăng xuất" title="Đăng xuất" disabled={signingOut} onClick={handleSignOut} className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] hover:text-[#176B87] disabled:opacity-50 sm:flex"><LogOut size={17} /></button>}

          <button
            type="button"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
            aria-controls="storefront-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

        </div>
      </div>
      {menuOpen && <nav id="storefront-mobile-nav" aria-label="Điều hướng trên điện thoại" className="grid gap-1 border-t border-[#E2E8F0] bg-white px-4 py-3 lg:hidden">
        {[["/", "Trang chủ"], ["/products", "Sản phẩm"], ["/warranty", "Bảo hành & Sửa chữa"], ["/orders", "Đơn hàng"]].map(([path, label]) => {
          const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
          return <Link key={path} to={path} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`rounded-xl px-4 py-3 text-sm ${active ? "bg-[#E8F4F7] font-semibold text-[#176B87]" : "text-[#1F2937]"}`}>{label}</Link>;
        })}
        {user && <button type="button" disabled={signingOut} onClick={handleSignOut} className="flex items-center gap-2 px-4 py-3 text-left text-sm text-[#64748B] disabled:opacity-50"><LogOut size={16} />{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</button>}
      </nav>}
      {error && <p role="alert" className="mx-auto max-w-7xl px-4 py-2 text-sm text-[#B42318]">{error}</p>}
    </header>
  );
}
