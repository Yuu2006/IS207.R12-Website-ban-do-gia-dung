import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  SlidersHorizontal,
  ChevronDown,
  Grid3X3,
  List,
  Search,
} from "lucide-react";
import { formatPrice } from "../../data";
import ProductCard from "../../components/ProductCard";
import { listProducts, getProduct } from "../../services/catalog-service.js";
import { API_URL } from "../../services/http-client.js";
import { useOrderService } from "../../context/OrderServiceContext.jsx";

const PRICE_MIN = 0;
const PRICE_MAX = 20000000;
const PRICE_STEP = 100000;

const warrantyOptions = [
  "6 tháng",
  "12 tháng",
  "18 tháng",
  "24 tháng",
  "36 tháng",
];

const sortOptions = [
  "Mới nhất",
  "Giá tăng dần",
  "Giá giảm dần",
];

const imageSource = (value) => !value ? "" : /^https?:\/\//i.test(value) ? value : `${API_URL}${value.startsWith("/") ? value : `/${value}`}`;
const categoryIcon = (name) => /tủ lạnh/i.test(name) ? "🧊" : /máy giặt/i.test(name) ? "🧺" : /lạnh|điều hòa/i.test(name) ? "❄️" : "📦";

function mapCatalogProduct(product) {
  return {
    ...product,
    id: String(product.id),
    categoryId: String(product.category_id),
    category: product.category_name,
    brand: product.brand_name,
    price: Number(product.min_price),
    image: imageSource(product.primary_image),
    rating: null,
    reviews: 0,
    inStock: Number(product.total_stock) > 0,
    variant_count: Number(product.variant_count),
  };
}

export default function ProductListPage() {
  const navigate = useNavigate();
  const orderService = useOrderService();
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [addingProductId, setAddingProductId] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 20000000]);
  const [sort, setSort] = useState("Mới nhất");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    setCatalogError("");
    listProducts({ is_active: 1 })
      .then((result) => {
        if (!Array.isArray(result)) throw new Error("Danh sách sản phẩm không đúng định dạng.");
        if (active) setProducts(result.map(mapCatalogProduct).filter((product) => product.variant_count > 0));
      })
      .catch((error) => { if (active) setCatalogError(error.message || "Không thể tải danh sách sản phẩm."); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [catalogRetry]);

  const categories = useMemo(() => {
    const grouped = new Map();
    products.forEach((product) => {
      if (!grouped.has(product.categoryId)) grouped.set(product.categoryId, { id: product.categoryId, name: product.category, count: 0, icon: categoryIcon(product.category) });
      grouped.get(product.categoryId).count += 1;
    });
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, "vi"));
  }, [products]);
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [products]);

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

  const updateMinPrice = (value) => {
    if (value === "") return;
    const nextMin = Number(value);
    setPriceRange(([, currentMax]) => [
      Math.max(PRICE_MIN, Math.min(nextMin, currentMax - PRICE_STEP)),
      currentMax,
    ]);
    setPage(1);
  };

  const updateMaxPrice = (value) => {
    if (value === "") return;
    const nextMax = Number(value);
    setPriceRange(([currentMin, currentMax]) => [
      currentMin,
      Math.min(PRICE_MAX, Math.max(nextMax, currentMin + PRICE_STEP)),
    ]);
    setPage(1);
  };

  const filtered = products.filter((product) => {
    if (
      selectedCat &&
      product.categoryId !== String(selectedCat)
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

      return 0;
    }
  );
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const visibleProducts = sortedProducts.slice((page - 1) * pageSize, page * pageSize);

  const handleProductClick = (id) => {
    navigate(`/products/${id}`);
  };

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
    } catch (error) {
      setActionError(true);
      setActionMessage(error.message || "Không thể thêm sản phẩm vào giỏ hàng.");
    } finally {
      setAddingProductId("");
    }
  };

  return (
    <main className="min-h-screen bg-[#F7FAFC]">
      {/* PAGE HEADER */}
      <section className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-[#667085]">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="hover:text-[#0F5F73]"
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

          <p className="mt-2 text-sm text-[#667085]">
            Khám phá các thiết bị gia dụng chính hãng
            từ những thương hiệu hàng đầu.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* MOBILE FILTER BUTTON */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mb-4 flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F2937] lg:hidden"
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
            <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
              {/* FILTER HEADER */}
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal
                    size={15}
                    className="text-[#0F5F73]"
                  />

                  <span className="text-sm font-semibold text-[#1F2937]">
                    Bộ lọc
                  </span>
                </div>

                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-[#0F5F73] hover:underline"
                >
                  Xóa
                </button>
              </div>

              {/* CATEGORY */}
              <div className="border-b border-[#E5E7EB] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#667085]">
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
                        ? "bg-[#eaf4f6] font-medium text-[#0F5F73]"
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
                          ? "bg-[#eaf4f6] font-medium text-[#0F5F73]"
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
              <div className="border-b border-[#E5E7EB] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#667085]">
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
                        className="accent-[#0F5F73]"
                      />

                      <span className="text-sm text-[#1F2937]">
                        {brand}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* PRICE */}
              <div className="border-b border-[#E5E7EB] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#667085]">
                  Khoảng giá
                </div>

                <div className="mb-2 flex items-center justify-between text-xs text-[#667085]">
                  <span>{formatPrice(priceRange[0])}</span>
                  <span>{formatPrice(priceRange[1])}</span>
                </div>

                <div
                  className="pl-price-slider"
                  style={{
                    "--price-start": `${(priceRange[0] / PRICE_MAX) * 100}%`,
                    "--price-end": `${(priceRange[1] / PRICE_MAX) * 100}%`,
                  }}
                >
                  <div className="pl-price-slider__track" aria-hidden="true" />
                  <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={priceRange[0]}
                    aria-label="Giá thấp nhất"
                    aria-valuetext={formatPrice(priceRange[0])}
                    onChange={(event) => updateMinPrice(event.target.value)}
                  />
                  <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={priceRange[1]}
                    aria-label="Giá cao nhất"
                    aria-valuetext={formatPrice(priceRange[1])}
                    onChange={(event) => updateMaxPrice(event.target.value)}
                  />
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <label className="pl-price-input">
                    <span>Từ</span>
                    <input
                      type="number"
                      min={PRICE_MIN}
                      max={priceRange[1] - PRICE_STEP}
                      step={PRICE_STEP}
                      value={priceRange[0]}
                      aria-label="Giá từ"
                      onChange={(event) => updateMinPrice(event.target.value)}
                    />
                  </label>
                  <label className="pl-price-input">
                    <span>Đến</span>
                    <input
                      type="number"
                      min={priceRange[0] + PRICE_STEP}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={priceRange[1]}
                      aria-label="Giá đến"
                      onChange={(event) => updateMaxPrice(event.target.value)}
                    />
                  </label>
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
                      onClick={() => {
                        setPriceRange([Number(min), Number(max)]);
                        setPage(1);
                      }}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        priceRange[0] === min &&
                        priceRange[1] === max
                          ? "bg-[#eaf4f6] font-medium text-[#0F5F73]"
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
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#667085]">
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
                        className="accent-[#0F5F73]"
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
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#0F5F73]"
                />
              </div>
            </div>

            {/* TOOLBAR */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[#667085]">
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
                    className="appearance-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-[#0F5F73]"
                  >
                    {sortOptions.map((option) => (
                      <option key={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#667085]"
                  />
                </div>

                {/* VIEW */}
                <div className="flex overflow-hidden rounded-xl border border-[#E5E7EB]">
                  <button
                    type="button"
                    className="bg-[#0F5F73] p-2 text-white"
                  >
                    <Grid3X3 size={15} />
                  </button>

                  <button
                    type="button"
                    className="p-2 text-[#667085] hover:bg-gray-50"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {actionMessage && (
              <p
                className={`mb-4 rounded-lg border px-4 py-3 text-sm ${actionError ? "border-[#FECACA] bg-[#FEF2F2] text-[#B42318]" : "border-[#A6D4BD] bg-[#F2FAF5] text-[#216444]"}`}
                role={actionError ? "alert" : "status"}
              >
                {actionMessage}
              </p>
            )}

            {/* PRODUCTS */}
            {catalogLoading ? (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-16 text-center text-sm text-[#667085]" role="status">Đang tải sản phẩm…</div>
            ) : catalogError ? (
              <div className="rounded-2xl border border-[#FECACA] bg-white p-12 text-center" role="alert">
                <p className="text-sm text-[#B42318]">{catalogError}</p>
                <button type="button" onClick={() => setCatalogRetry((value) => value + 1)} className="mt-3 text-sm font-semibold text-[#0F5F73]">Thử tải lại</button>
              </div>
            ) : sortedProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    navigate={handleProductClick}
                    onAddToCart={handleAddToCart}
                    adding={addingProductId === product.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-16 text-center">
                <div className="mb-4 text-4xl">🔍</div>

                <div className="mb-2 font-semibold text-[#1F2937]">
                  Không tìm thấy sản phẩm
                </div>

                <div className="text-sm text-[#667085]">
                  Vui lòng thay đổi bộ lọc để xem thêm sản phẩm.
                </div>

                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium text-[#0F5F73] hover:underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}

            {/* PAGINATION */}
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  onClick={() => setPage(number)}
                  className={`h-9 w-9 rounded-xl text-sm font-medium transition-colors ${
                    page === number
                      ? "bg-[#0F5F73] text-white"
                      : "border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#0F5F73]"
                  }`}
                >
                  {number}
                </button>
              ))}

              {totalPages > 1 && <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="h-9 w-9 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#667085] hover:border-[#0F5F73] disabled:opacity-40">›</button>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
