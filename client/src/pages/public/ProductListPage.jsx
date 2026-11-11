import { useState, useEffect } from "react";
import {
  getWishlist,
  addWishlist,
  removeWishlist,
} from "../../services/wishlist-service.js";
import { useOrderAction, useOrderQuery } from "../../hooks/use-order-api.js";
import {
  SlidersHorizontal,
  ChevronDown,
  Grid3X3,
  List,
  Search,
} from "lucide-react";
import { useProductList } from "../../hooks/use-product-list";
import ProductCard from "../../components/ProductCard";

const ALL_PRICES = [0, Number.MAX_SAFE_INTEGER];

const warrantyOptions = [
  "6 tháng",
  "12 tháng",
  "18 tháng",
  "24 tháng",
  "36 tháng",
];

const sortOptions = [
  "Mới nhất",
  "Bán chạy nhất",
  "Giá tăng dần",
  "Giá giảm dần",
  "Đánh giá cao nhất",
];

export default function ProductListPage() {
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState(ALL_PRICES);
  const [selectedWarranty, setSelectedWarranty] = useState([]);
  const [sort, setSort] = useState("Bán chạy nhất");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Tải danh sách yêu thích một lần tại trang sản phẩm
  const wishlist = useOrderQuery((signal) => getWishlist({ signal }), []);

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
    brand_id: selectedBrands.join(","),
    min_price: priceRange[0] === 0 ? "" : priceRange[0],
    max_price: priceRange[1] === Number.MAX_SAFE_INTEGER ? "" : priceRange[1],
    warranty_months: selectedWarranty
      .map((item) => item.replace(" tháng", ""))
      .join(","),
    sort: sortMapping[sort],
    page,
    page_size: 12,
  };

  const { products, categories, brands, pagination, loading, error } =
    useProductList(filters);

  const toggleBrand = (brandId) => {
    setSelectedBrands((prev) =>
      prev.includes(brandId)
        ? prev.filter((id) => id !== brandId)
        : [...prev, brandId],
    );
    setPage(1);
  };

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
    setSelectedBrands([]);
    setPriceRange(ALL_PRICES);
    setSelectedWarranty([]);
    setSearch("");
    setDebouncedSearch("");
    setSort("Bán chạy nhất");
    setPage(1);
  };

  const handleProductClick = (id) => {
    window.location.href = `/products/${id}`;
  };

  const handleAddToCart = (product) => {
    console.log("Thêm vào giỏ:", product);
  };
  return (
    <main className="min-h-screen bg-[#F7FAFC]">
      {/* PAGE HEADER */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
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

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* MOBILE FILTER BUTTON */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mb-4 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#1F2937] lg:hidden"
        >
          <SlidersHorizontal size={16} />
          Bộ lọc
        </button>

        <div className="flex gap-6">
          {/* SIDEBAR */}
          <aside
            className={`w-60 flex-shrink-0 ${
              showFilters ? "block" : "hidden"
            } lg:block`}
          >
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
              {/* FILTER HEADER */}
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-[#176B87]" />

                  <span className="text-sm font-semibold text-[#1F2937]">
                    Bộ lọc
                  </span>
                </div>

                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-[#176B87] hover:underline"
                >
                  Xóa
                </button>
              </div>

              {/* CATEGORY */}
              <div className="border-b border-[#E2E8F0] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Danh mục
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedCat("");
                      setPage(1);
                    }}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                      !selectedCat
                        ? "bg-[#e8f4f8] font-medium text-[#176B87]"
                        : "text-[#1F2937] hover:bg-gray-50"
                    }`}
                  >
                    Tất cả sản phẩm
                  </button>

                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCat(String(category.id));
                        setPage(1);
                      }}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        String(selectedCat) === String(category.id)
                          ? "bg-[#e8f4f8] font-medium text-[#176B87]"
                          : "text-[#1F2937] hover:bg-gray-50"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* BRAND */}
              <div className="border-b border-[#E2E8F0] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Thương hiệu
                </div>

                <div className="space-y-2">
                  {brands.map((brand) => (
                    <label
                      key={brand.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand.id)}
                        onChange={() => toggleBrand(brand.id)}
                        className="accent-[#176B87]"
                      />

                      <span className="text-sm text-[#1F2937]">
                        {brand.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* PRICE */}
              <div className="border-b border-[#E2E8F0] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Khoảng giá
                </div>
                <div className="space-y-2">
                  {[
                    {
                      label: "Tất cả mức giá",
                      min: 0,
                      max: Number.MAX_SAFE_INTEGER,
                    },
                    { label: "Dưới 1 triệu", min: 0, max: 999999 },
                    { label: "1 - dưới 5 triệu", min: 1000000, max: 4999999 },
                    { label: "5 - 10 triệu", min: 5000000, max: 10000000 },
                    {
                      label: "Trên 10 triệu",
                      min: 10000001,
                      max: Number.MAX_SAFE_INTEGER,
                    },
                  ].map((range) => (
                    <label
                      key={range.label}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="radio"
                        name="priceRange"
                        checked={
                          priceRange[0] === range.min &&
                          priceRange[1] === range.max
                        }
                        onChange={() => {
                          setPriceRange([range.min, range.max]);
                          setPage(1);
                        }}
                        className="accent-[#176B87]"
                      />
                      <span className="text-sm text-[#1F2937]">
                        {range.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* WARRANTY */}
              <div className="p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Thời hạn bảo hành
                </div>

                <div className="space-y-2">
                  {warrantyOptions.map((warranty) => (
                    <label
                      key={warranty}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWarranty.includes(warranty)}
                        onChange={() => toggleWarranty(warranty)}
                        className="accent-[#176B87]"
                      />

                      <span className="text-sm text-[#1F2937]">{warranty}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <div className="min-w-0 flex-1">
            {/* SEARCH */}
            <div className="mb-4 flex gap-3">
              <div className="relative flex-1">
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
            </div>

            {/* TOOLBAR */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[#64748B]">
                Hiển thị{" "}
                <span className="font-semibold text-[#1F2937]">
                  {pagination.total_items}
                </span>{" "}
                sản phẩm
              </div>

              <div className="flex items-center gap-3">
                {/* SORT */}
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setPage(1);
                    }}
                    className="appearance-none rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-[#176B87]"
                  >
                    {sortOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                </div>

                {/* VIEW */}
                <div className="flex overflow-hidden rounded-xl border border-[#E2E8F0]">
                  <button type="button" className="bg-[#176B87] p-2 text-white">
                    <Grid3X3 size={15} />
                  </button>

                  <button
                    type="button"
                    className="p-2 text-[#64748B] hover:bg-gray-50"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>
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
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    navigate={handleProductClick}
                    onAddToCart={handleAddToCart}
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
            {/* PAGINATION */}
            {pagination.total_pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => prev - 1)}
                  className="h-9 w-9 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#64748B] disabled:opacity-40"
                >
                  ‹
                </button>

                {Array.from(
                  { length: pagination.total_pages },
                  (_, index) => index + 1,
                ).map((number) => (
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

                <button
                  type="button"
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="h-9 w-9 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#64748B] disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
