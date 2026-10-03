import { useState } from "react";
import {
  SlidersHorizontal,
  ChevronDown,
  Grid3X3,
  List,
  Search,
} from "lucide-react";
import { products, categories } from "../../data";
import ProductCard from "../../components/ProductCard";

const brands = [
  "Samsung",
  "LG",
  "Daikin",
  "Panasonic",
  "Sharp",
  "Toshiba",
  "Dyson",
  "Ariston",
];

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
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 20000000]);
  const [sort, setSort] = useState("Bán chạy nhất");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((item) => item !== brand)
        : [...prev, brand]
    );
  };

  const clearFilters = () => {
    setSelectedCat(null);
    setSelectedBrands([]);
    setPriceRange([0, 20000000]);
    setSearch("");
    setPage(1);
  };

  const filtered = products.filter((product) => {
    if (
      selectedCat &&
      product.category !== selectedCat
    ) {
      return false;
    }

    if (
      selectedBrands.length > 0 &&
      !selectedBrands.includes(product.brand)
    ) {
      return false;
    }

    if (
      product.price < priceRange[0] ||
      product.price > priceRange[1]
    ) {
      return false;
    }

    if (
      search &&
      !product.name
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const sortedProducts = [...filtered].sort(
    (a, b) => {
      if (sort === "Giá tăng dần") {
        return a.price - b.price;
      }

      if (sort === "Giá giảm dần") {
        return b.price - a.price;
      }

      if (sort === "Đánh giá cao nhất") {
        return b.rating - a.rating;
      }

      return 0;
    }
  );

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

            <span className="font-medium text-[#1F2937]">
              Sản phẩm
            </span>
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
            Khám phá các thiết bị gia dụng chính hãng
            từ những thương hiệu hàng đầu.
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
                  <SlidersHorizontal
                    size={15}
                    className="text-[#176B87]"
                  />

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
                      setSelectedCat(null);
                      setPage(1);
                    }}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                      !selectedCat
                        ? "bg-[#e8f4f8] font-medium text-[#176B87]"
                        : "text-[#1F2937] hover:bg-gray-50"
                    }`}
                  >
                    Tất cả ({products.length})
                  </button>

                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCat(category.id);
                        setPage(1);
                      }}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        selectedCat === category.id
                          ? "bg-[#e8f4f8] font-medium text-[#176B87]"
                          : "text-[#1F2937] hover:bg-gray-50"
                      }`}
                    >
                      {category.icon} {category.name} (
                      {category.count})
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
                      key={brand}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(
                          brand
                        )}
                        onChange={() =>
                          toggleBrand(brand)
                        }
                        className="accent-[#176B87]"
                      />

                      <span className="text-sm text-[#1F2937]">
                        {brand}
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

                <div className="space-y-1">
                  {[
                    [0, 2000000, "Dưới 2 triệu"],
                    [2000000, 5000000, "2–5 triệu"],
                    [5000000, 10000000, "5–10 triệu"],
                    [10000000, 20000000, "Trên 10 triệu"],
                  ].map(([min, max, label]) => (
                    <button
                      key={label}
                      onClick={() =>
                        setPriceRange([
                          Number(min),
                          Number(max),
                        ])
                      }
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        priceRange[0] === min &&
                        priceRange[1] === max
                          ? "bg-[#e8f4f8] font-medium text-[#176B87]"
                          : "text-[#1F2937] hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
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
                        className="accent-[#176B87]"
                      />

                      <span className="text-sm text-[#1F2937]">
                        {warranty}
                      </span>
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
                  {sortedProducts.length}
                </span>{" "}
                sản phẩm
              </div>

              <div className="flex items-center gap-3">
                {/* SORT */}
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value)
                    }
                    className="appearance-none rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-[#176B87]"
                  >
                    {sortOptions.map((option) => (
                      <option key={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                </div>

                {/* VIEW */}
                <div className="flex overflow-hidden rounded-xl border border-[#E2E8F0]">
                  <button
                    type="button"
                    className="bg-[#176B87] p-2 text-white"
                  >
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

            {/* PRODUCTS */}
            {sortedProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {sortedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    navigate={handleProductClick}
                    onAddToCart={handleAddToCart}
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
            <div className="mt-8 flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((number) => (
                <button
                  key={number}
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
                className="h-9 w-9 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#64748B] hover:border-[#176B87]"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}