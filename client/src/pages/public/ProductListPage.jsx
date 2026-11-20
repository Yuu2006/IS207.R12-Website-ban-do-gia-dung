import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getWishlist,
  addWishlist,
  removeWishlist,
} from "../../services/wishlist-service.js";
import { useOrderAction, useOrderQuery } from "../../hooks/use-order-api.js";
import { SlidersHorizontal, Search, X } from "lucide-react";
import { useProductList } from "../../hooks/use-product-list";
import { getProduct } from "../../services/catalog-service.js";
import { useOrderService } from "../../context/OrderServiceContext.jsx";
import ProductCard from "../../components/ProductCard";

const ALL_PRICES = [0, Number.MAX_SAFE_INTEGER];

const warrantyOptions = [
  "6 tháng",
  "12 tháng",
  "18 tháng",
  "24 tháng",
  "36 tháng",
];

const PRICE_RANGES = [
  { label: "Dưới 1 triệu", min: 0, max: 999999 },
  { label: "1 - dưới 5 triệu", min: 1000000, max: 4999999 },
  { label: "5 - 10 triệu", min: 5000000, max: 10000000 },
  { label: "Trên 10 triệu", min: 10000001, max: Number.MAX_SAFE_INTEGER },
];

// Chỉ các kiểu sắp xếp backend hỗ trợ (sortMapping bên dưới).
const sortOptions = [
  "Bán chạy nhất",
  "Mới nhất",
  "Giá tăng dần",
  "Giá giảm dần",
  "Đánh giá cao nhất",
];

export default function ProductListPage() {
  // Danh mục nằm trên URL (?category=<id>) để trang chủ trỏ thẳng tới và nút Back hoạt động.
  const [params, setParams] = useSearchParams();
  const selectedCat = params.get("category") ?? "";
  const setSelectedCat = (id) => {
    setParams(id ? { category: String(id) } : {});
    // Mỗi lần chỉ một loại sản phẩm: đổi loại thì bỏ bộ lọc của loại cũ.
    setPriceRange(ALL_PRICES);
    setSelectedWarranty([]);
  };
  const [priceRange, setPriceRange] = useState(ALL_PRICES);
  const [selectedWarranty, setSelectedWarranty] = useState([]);
  const [sort, setSort] = useState("Bán chạy nhất");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Tải danh sách yêu thích một lần tại trang sản phẩm
  const orderService = useOrderService();
  const [addingProductId, setAddingProductId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState(false);
  // Guests and staff have no wishlist: treat 401/403 as an empty list instead of an error banner.
  const wishlist = useOrderQuery((signal) => getWishlist({ signal }).catch((failure) => {
    if (failure.status === 401 || failure.status === 403) return [];
    throw failure;
  }), []);

  const wishlistAction = useOrderAction();

  const favoriteIds = new Set(
    (wishlist.data || []).map((item) => String(item.product_id)),
  );

  async function handleToggleWishlist(product) {
    const productId = String(product.id);
    const isFavorite = favoriteIds.has(productId);

    const result = await wishlistAction.run(
      isFavorite ? "wishlist-remove" : "wishlist-add",
      { productId },
      (options) =>
        isFavorite
          ? removeWishlist(productId, options)
          : addWishlist(productId, options),
    );

    if (result !== null) {
      wishlist.reload();
    }
  }
  // Debounce tìm kiếm 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const sortMapping = {
    "Mới nhất": "newest",
    "Bán chạy nhất": "best_selling",
    "Giá tăng dần": "price_asc",
    "Giá giảm dần": "price_desc",
    "Đánh giá cao nhất": "rating_desc",
  };

  const filters = {
    keyword: debouncedSearch,
    category_id: selectedCat,
    min_price: priceRange[0] === 0 ? "" : priceRange[0],
    max_price: priceRange[1] === Number.MAX_SAFE_INTEGER ? "" : priceRange[1],
    warranty_months: selectedWarranty
      .map((item) => item.replace(" tháng", ""))
      .join(","),
    sort: sortMapping[sort],
    page,
    page_size: 15,
  };

  const { products, categories, pagination, loading, error } =
    useProductList(filters);

  const toggleWarranty = (warranty) => {
    setSelectedWarranty((prev) =>
      prev.includes(warranty)
        ? prev.filter((item) => item !== warranty)
        : [...prev, warranty],
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedCat("");
    setPriceRange(ALL_PRICES);
    setSelectedWarranty([]);
    setSearch("");
    setDebouncedSearch("");
    setSort("Bán chạy nhất");
    setPage(1);
  };

  // Nhóm cha chỉ là tiêu đề nhóm trong bảng lọc; chỉ danh mục con/đơn lẻ mới chọn được.
  const groups = categories
    .filter((category) => !category.parent_id)
    .map((group) => ({
      id: group.id,
      name: group.name,
      items: categories.some((category) => category.parent_id === group.id)
        ? categories.filter((category) => category.parent_id === group.id)
        : [group],
    }));

  const chips = [];
  const currentCat = categories.find((category) => String(category.id) === String(selectedCat));
  if (currentCat) chips.push({ key: "cat", label: currentCat.name, remove: () => { setSelectedCat(""); setPage(1); } });
  const currentRange = PRICE_RANGES.find((range) => priceRange[0] === range.min && priceRange[1] === range.max);
  if (currentRange) chips.push({ key: "price", label: currentRange.label, remove: () => { setPriceRange(ALL_PRICES); setPage(1); } });
  selectedWarranty.forEach((warranty) => chips.push({ key: warranty, label: `Bảo hành ${warranty}`, remove: () => toggleWarranty(warranty) }));

  const handleProductClick = (id) => {
    window.location.href = `/products/${id}`;
  };

  // Single-SKU products go straight to the cart (backend rechecks stock); multi-SKU products open the detail page to pick one.
  const handleAddToCart = async (product) => {
    setActionMessage("");
    if (!product.inStock) {
      setActionError(true);
      setActionMessage("Sản phẩm hiện đã hết hàng.");
      return;
    }
    if (product.variant_count !== 1) {
      handleProductClick(product.id);
      return;
    }
    setAddingProductId(product.id);
    try {
      const detail = await getProduct(product.id);
      const variant = detail.variants?.find((item) => Number(item.stock_quantity) > 0);
      if (!variant) throw new Error("SKU của sản phẩm hiện đã hết hàng.");
      await orderService.addCartItem(String(variant.id), 1);
      setActionError(false);
      setActionMessage(`Đã thêm ${product.name} vào giỏ hàng.`);
    } catch (failure) {
      setActionError(true);
      setActionMessage(failure.message || "Không thể thêm sản phẩm vào giỏ hàng.");
    } finally {
      setAddingProductId("");
    }
  };
  return (
    <main className="min-h-screen bg-[#F7FAFC]">
      {/* PAGE HEADER */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-[#64748B]">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="hover:text-[#176B87]"
            >
              Trang chủ
            </button>

            <span>/</span>

            <span className="font-medium text-[#1F2937]">Sản phẩm</span>
          </div>

          <h1
            className="text-3xl font-bold text-[#1F2937]"
            style={{
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            Sản phẩm
          </h1>

          <p className="mt-2 text-sm text-[#64748B]">
            Khám phá các thiết bị gia dụng chính hãng từ những thương hiệu hàng
            đầu.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* TOP BAR: nút Lọc + chip đang áp dụng */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
            className="flex items-center gap-2 rounded-lg border border-[#176B87] bg-white px-4 py-2 text-sm font-medium text-[#176B87]"
          >
            <SlidersHorizontal size={16} />
            Lọc
          </button>

          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EEF2F6] px-3 py-2 text-sm text-[#1F2937]"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.remove}
                aria-label={`Bỏ lọc ${chip.label}`}
                className="text-[#64748B] hover:text-[#1F2937]"
              >
                <X size={14} />
              </button>
            </span>
          ))}

          {chips.length > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-[#176B87] hover:underline"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Chọn loại sản phẩm (mỗi lần một loại)
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.id}>
                  <div className="mb-1.5 text-sm font-semibold text-[#1F2937]">
                    {group.name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setSelectedCat(
                            String(selectedCat) === String(category.id) ? "" : category.id,
                          );
                          setPage(1);
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          String(selectedCat) === String(category.id)
                            ? "border-[#176B87] bg-[#e8f4f8] font-medium text-[#176B87]"
                            : "border-[#E2E8F0] text-[#1F2937] hover:border-[#176B87]"
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedCat && (
              <div className="mt-4 grid gap-4 border-t border-[#E2E8F0] pt-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Khoảng giá
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRICE_RANGES.map((range) => {
                      const active =
                        priceRange[0] === range.min && priceRange[1] === range.max;
                      return (
                        <button
                          key={range.label}
                          type="button"
                          onClick={() => {
                            setPriceRange(active ? ALL_PRICES : [range.min, range.max]);
                            setPage(1);
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? "border-[#176B87] bg-[#e8f4f8] font-medium text-[#176B87]"
                              : "border-[#E2E8F0] text-[#1F2937] hover:border-[#176B87]"
                          }`}
                        >
                          {range.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Thời hạn bảo hành
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {warrantyOptions.map((warranty) => (
                      <button
                        key={warranty}
                        type="button"
                        onClick={() => toggleWarranty(warranty)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          selectedWarranty.includes(warranty)
                            ? "border-[#176B87] bg-[#e8f4f8] font-medium text-[#176B87]"
                            : "border-[#E2E8F0] text-[#1F2937] hover:border-[#176B87]"
                        }`}
                      >
                        {warranty}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 text-right">
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg bg-[#176B87] px-4 py-2 text-sm font-medium text-white"
              >
                Xem {pagination.total_items} sản phẩm
              </button>
            </div>
          </div>
        )}

        {/* SEARCH */}
        <div className="relative mb-4">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm kiếm sản phẩm..."
            className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#176B87]"
          />
        </div>

        {/* SORT */}
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="text-[#64748B]">Sắp xếp theo:</span>
          {sortOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setSort(option);
                setPage(1);
              }}
              aria-pressed={sort === option}
              className={
                sort === option
                  ? "font-medium text-[#176B87]"
                  : "text-[#1F2937] hover:text-[#176B87]"
              }
            >
              {option}
            </button>
          ))}
          <span className="ml-auto text-[#64748B]">
            <span className="font-semibold text-[#1F2937]">{pagination.total_items}</span>{" "}
            sản phẩm
          </span>
        </div>

        <div>
          <div className="min-w-0">
            {wishlist.error && (
              <p className="mb-3 text-sm text-red-600" role="alert">
                Không thể tải danh sách yêu thích: {wishlist.error.message}
                <button
                  type="button"
                  onClick={wishlist.reload}
                  className="ml-2 font-semibold underline"
                >
                  Thử lại
                </button>
              </p>
            )}

            {actionMessage && (
              <p className={`mb-3 text-sm ${actionError ? "text-red-600" : "text-[#027A48]"}`} role={actionError ? "alert" : "status"}>
                {actionMessage}
              </p>
            )}
            {wishlistAction.error && (
              <p className="mb-3 text-sm text-red-600" role="alert">
                {wishlistAction.error.message}
              </p>
            )}
            {/* PRODUCTS */}
            {loading ? (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-16 text-center text-sm text-[#64748B]">
                Đang tải sản phẩm...
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-2xl border border-[#E2E8F0] bg-white p-16 text-center text-sm text-[#B91C1C]"
              >
                {error.message}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    navigate={handleProductClick}
                    onAddToCart={handleAddToCart}
                    adding={addingProductId === product.id}
                    favorite={favoriteIds.has(String(product.id))}
                    onToggleWishlist={handleToggleWishlist}
                    wishlistBusy={
                      wishlist.loading ||
                      wishlistAction.busy ||
                      wishlistAction.uncertain
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-16 text-center">
                <div className="mb-4 text-4xl">🔍</div>

                <div className="mb-2 font-semibold text-[#1F2937]">
                  Không tìm thấy sản phẩm
                </div>

                <div className="text-sm text-[#64748B]">
                  Vui lòng thay đổi bộ lọc để xem thêm sản phẩm.
                </div>

                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium text-[#176B87] hover:underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
            {/* PAGINATION: « ‹ 1 2 3 … › » */}
            {pagination.total_pages > 1 && (() => {
              const total = pagination.total_pages;
              const start = Math.max(1, Math.min(page - 1, total - 2));
              const pages = Array.from(
                { length: Math.min(3, total) },
                (_, index) => start + index,
              );
              const nav = "h-9 w-9 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#64748B] disabled:opacity-40";
              return (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button type="button" aria-label="Trang đầu" disabled={page <= 1} onClick={() => setPage(1)} className={nav}>«</button>
                  <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} className={nav}>‹</button>
                  {pages.map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setPage(number)}
                      className={`h-9 w-9 rounded-xl text-sm font-medium transition-colors ${
                        page === number
                          ? "bg-[#176B87] text-white"
                          : "border border-[#E2E8F0] bg-white text-[#1F2937] hover:border-[#176B87]"
                      }`}
                    >
                      {number}
                    </button>
                  ))}
                  {pages[pages.length - 1] < total && <span className="px-1 text-[#64748B]">…</span>}
                  <button type="button" aria-label="Trang sau" disabled={page >= total} onClick={() => setPage((prev) => prev + 1)} className={nav}>›</button>
                  <button type="button" aria-label="Trang cuối" disabled={page >= total} onClick={() => setPage(total)} className={nav}>»</button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </main>
  );
}
