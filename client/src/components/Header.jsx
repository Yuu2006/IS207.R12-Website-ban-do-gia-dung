import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
  ArrowLeftRight,
  Heart,
} from "lucide-react";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { roleHome } from "../context/auth-context.js";

const storefrontLinks = [
  ["/", "Trang chủ"],
  ["/products", "Sản phẩm"],
  ["/compare", "So sánh"],
  ["/warranty", "Bảo hành"],
  ["/orders", "Đơn hàng"],
];

function activeStorefrontPath(pathname) {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/products")) return "/products";
  if (pathname === "/compare") return "/compare";
  if (pathname.startsWith("/warranty")) return "/warranty";
  if (pathname.startsWith("/orders")) return "/orders";
  return null;
}

// Header chung của storefront; đơn hàng và tài khoản dùng cùng phiên khách hàng.
export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useCustomerAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const navRef = useRef(null);
  const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0, visible: false });
  const activePath = activeStorefrontPath(location.pathname);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const activeLink = activePath ? nav.querySelector('[aria-current="page"]') : null;
    if (!nav || !activeLink) {
      setNavIndicator(current => current.visible ? { ...current, visible: false } : current);
      return undefined;
    }

    const updateIndicator = () => {
      const next = { left: activeLink.offsetLeft, width: activeLink.offsetWidth, visible: true };
      setNavIndicator(current => current.left === next.left && current.width === next.width && current.visible ? current : next);
    };
    updateIndicator();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateIndicator);
    observer?.observe(nav);
    observer?.observe(activeLink);
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activePath]);

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
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-6">

        {/* LOGO */}
        <Link
          to="/"
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F5F73] text-white">
            <span className="text-lg font-bold">H</span>
          </div>

          <div>
            <div className="text-base font-bold leading-none text-[#0F5F73] sm:text-lg">
              HomeCare
            </div>

            <div className="mt-1 hidden text-[10px] text-[#667085] sm:block">
              Thiết bị tốt – Chăm sóc tận tâm
            </div>
          </div>
        </Link>

        {/* NAVIGATION */}
        <nav ref={navRef} aria-label="Điều hướng chính" className="hc-store-nav hidden flex-1 items-center justify-center gap-3 lg:flex">
          {storefrontLinks.map(([path, label]) => {
            const active = activePath === path;
            return <Link
              key={path}
              to={path}
              aria-current={active ? "page" : undefined}
              className={"hc-store-nav-link relative z-10 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium" + (active ? " is-active" : "")}
            >{path === "/compare" ? <span className="flex items-center gap-1.5"><ArrowLeftRight size={15} />{label}</span> : label}</Link>;
          })}
          <span className="hc-store-nav-indicator" aria-hidden="true" style={{ width: navIndicator.width + "px", transform: "translateX(" + navIndicator.left + "px)", opacity: navIndicator.visible ? 1 : 0 }} />
        </nav>
        {/* ACTIONS */}
        <div className="ml-auto flex items-center gap-2">

          <Link
            to="/products"
            className="hidden h-9 items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 text-sm text-[#667085] transition-colors hover:border-[#0F5F73] hover:text-[#0F5F73] xl:flex"
          >
            <Search size={16} />
            <span>Tìm kiếm</span>
          </Link>

          {/* Wishlist (CUS-11) is customer-only; guests are sent to login by the route guard. Staff accounts have no wishlist. */}
          {(!user || user.role === "CUSTOMER") && <Link
            to="/wishlist"
            aria-label="Sản phẩm yêu thích"
            title="Sản phẩm yêu thích"
            aria-current={location.pathname === "/wishlist" ? "page" : undefined}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#667085] transition-colors hover:border-[#0F5F73] hover:text-[#0F5F73]"
          >
            <Heart size={17} />
          </Link>}

          <Link
            to="/cart"
            aria-label="Giỏ hàng"
            title="Mở giỏ hàng"
            aria-current={location.pathname === "/cart" ? "page" : undefined}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#667085] transition-colors hover:border-[#0F5F73] hover:text-[#0F5F73]"
          >
            <ShoppingCart size={17} />
          </Link>

          <Link
            to={user ? roleHome[user.role] || "/profile" : "/login"}
            aria-label={user ? `Không gian của ${user.fullName || "tôi"}` : "Đăng nhập"}
            className="flex h-9 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] px-2 text-[#667085] transition-colors hover:border-[#0F5F73] hover:text-[#0F5F73]"
          >
            <User size={17} />
            {user && <span className="hidden max-w-28 truncate text-xs lg:inline">{user.fullName || "Tài khoản"}</span>}
          </Link>

          {user && <button type="button" aria-label="Đăng xuất" title="Đăng xuất" disabled={signingOut} onClick={handleSignOut} className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#667085] hover:text-[#0F5F73] disabled:opacity-50 sm:flex"><LogOut size={17} /></button>}

          <button
            type="button"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
            aria-controls="storefront-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#667085] lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

        </div>
      </div>
      {menuOpen && <nav id="storefront-mobile-nav" aria-label="Điều hướng trên điện thoại" className="grid gap-1 border-t border-[#E5E7EB] bg-white px-4 py-3 lg:hidden">
        {storefrontLinks.map(([path, label]) => {
          const active = activePath === path;
          return <Link key={path} to={path} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`hc-store-mobile-link rounded-xl px-4 py-3 text-sm ${active ? "is-active font-semibold text-[#0F5F73]" : "text-[#1F2937]"}`}>{label}</Link>;
        })}
        {user && <button type="button" disabled={signingOut} onClick={handleSignOut} className="flex items-center gap-2 px-4 py-3 text-left text-sm text-[#667085] disabled:opacity-50"><LogOut size={16} />{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</button>}
      </nav>}
      {error && <p role="alert" className="mx-auto max-w-7xl px-4 py-2 text-sm text-[#B42318]">{error}</p>}
    </header>
  );
}
