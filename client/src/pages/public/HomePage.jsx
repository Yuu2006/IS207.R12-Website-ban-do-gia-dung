import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Star,
  Shield,
  Truck,
  Headphones,
  Award,
  ChevronRight,
  ArrowLeftRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { listProducts, getProduct } from "../../services/catalog-service.js";
import { API_URL } from "../../services/http-client.js";
import { useOrderService } from "../../context/OrderServiceContext.jsx";
import ProductCard from "../../components/ProductCard";

const reviews = [
  {
    name: "Nguyễn Thị Hoa",
    rating: 5,
    text: "Sản phẩm chính hãng, giao hàng nhanh. Kỹ thuật viên đến lắp đặt rất chuyên nghiệp và nhiệt tình. Sẽ ủng hộ HomeCare dài dài!",
    product: "Điều hòa Daikin 1.5HP",
    avatar: "H",
  },
  {
    name: "Trần Văn Bình",
    rating: 5,
    text: "Mua tủ lạnh Samsung, được bảo hành 2 năm. Sau khi mua có vấn đề nhỏ, gọi hotline là có kỹ thuật đến nhà ngay trong ngày. Rất hài lòng!",
    product: "Tủ lạnh Samsung 382L",
    avatar: "B",
  },
  {
    name: "Lê Thị Lan",
    rating: 4,
    text: "Máy giặt LG dùng rất êm, tiết kiệm điện. Giá tốt hơn chỗ khác, lại còn được tặng nước giặt. Dịch vụ sau bán hàng chu đáo.",
    product: "Máy giặt LG 9kg",
    avatar: "L",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const orderService = useOrderService();
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [cartMessage, setCartMessage] = useState("");
  const [cartError, setCartError] = useState(false);
  const [addingProductId, setAddingProductId] = useState("");

  useEffect(() => {
    let active = true;
    listProducts({ is_active: 1 })
      .then((result) => {
        if (!Array.isArray(result)) throw new Error("Danh sách sản phẩm không đúng định dạng.");
        if (active) setProducts(result.filter((item) => Number(item.variant_count) > 0).map((item) => ({
          ...item,
          id: String(item.id),
          brand: item.brand_name,
          image: !item.primary_image ? "" : /^https?:\/\//i.test(item.primary_image) ? item.primary_image : `${API_URL}${item.primary_image.startsWith("/") ? item.primary_image : `/${item.primary_image}`}`,
          price: Number(item.min_price),
          rating: null,
          reviews: 0,
          inStock: Number(item.total_stock) > 0,
          variant_count: Number(item.variant_count),
        })));
      })
      .catch((error) => { if (active) setCartMessage(error.message || "Không thể tải sản phẩm."); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  const featured = products.slice(0, 4);
  const bestsellers = products.slice(4, 8);
  const categories = useMemo(() => {
    const grouped = new Map();
    products.forEach((product) => {
      const key = String(product.category_id);
      if (!grouped.has(key)) grouped.set(key, { id: key, name: product.category_name, count: 0, icon: /tủ lạnh/i.test(product.category_name) ? "🧊" : /máy giặt/i.test(product.category_name) ? "🧺" : /lạnh|điều hòa/i.test(product.category_name) ? "❄️" : "📦" });
      grouped.get(key).count += 1;
    });
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, "vi"));
  }, [products]);

  const goProducts = () => {
    navigate("/products");
  };

  const goProductDetail = (id) => {
    navigate(`/products/${id}`);
  };

  const addToCart = async (product) => {
    setCartMessage("");
    setCartError(false);
    if (!product.inStock) {
      setCartError(true);
      setCartMessage("Sản phẩm hiện đã hết hàng.");
      return;
    }
    if (product.variant_count !== 1) {
      goProductDetail(product.id);
      return;
    }
    setAddingProductId(product.id);
    try {
      const detail = await getProduct(product.id);
      const variant = detail.variants?.find((item) => Number(item.stock_quantity) > 0);
      if (!variant) throw new Error("SKU của sản phẩm hiện đã hết hàng.");
      await orderService.addCartItem(String(variant.id), 1);
      setCartMessage(`Đã thêm ${product.name} vào giỏ hàng.`);
    } catch (error) {
      setCartError(true);
      setCartMessage(error.message || "Không thể thêm sản phẩm vào giỏ hàng.");
    } finally {
      setAddingProductId("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F5F73] via-[#0F5F73] to-[#0B4E60]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#64CCC5] blur-3xl" />

          <div className="absolute bottom-0 left-1/3 h-64 w-64 translate-y-1/2 rounded-full bg-[#64CCC5] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* LEFT */}
            <div className="text-white">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-sm backdrop-blur-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#64CCC5]" />

                Khuyến mãi lớn – Giảm đến 30%
              </div>

              <h1
                className="mb-5 text-4xl font-bold leading-tight lg:text-5xl"
                style={{
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                }}
              >
                Thiết bị gia dụng
                <br />
                <span className="text-[#64CCC5]">
                  chính hãng
                </span>
                , bảo hành
                <br />
                tận tâm
              </h1>

              <p className="mb-8 text-lg leading-relaxed text-white/80">
                Hơn 500 sản phẩm từ các thương hiệu hàng đầu
                thế giới. Bảo hành chính hãng, lắp đặt tại nhà,
                kỹ thuật viên chuyên nghiệp.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={goProducts}
                  className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-[#0F5F73] transition-all hover:bg-[#0B4E60] hover:text-white"
                >
                  Khám phá sản phẩm
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => {
                    alert("Trang tra cứu bảo hành");
                  }}
                  className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/25"
                >
                  <Shield size={16} />
                  Tra cứu bảo hành
                </button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <Award
                    size={14}
                    className="text-[#64CCC5]"
                  />
                  <span>10.000+ khách hàng tin dùng</span>
                </div>

                <div className="flex items-center gap-2">
                  <Shield
                    size={14}
                    className="text-[#64CCC5]"
                  />
                  <span>Bảo hành chính hãng</span>
                </div>
              </div>
            </div>

            {/* RIGHT IMAGES */}
            <div className="hidden grid-cols-2 gap-4 lg:grid">
              <img
                src="https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=300&h=360&fit=crop&auto=format"
                alt="Tủ lạnh"
                className="mt-8 h-72 w-full rounded-2xl object-cover shadow-xl"
              />

              <div className="space-y-4">
                <img
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=220&fit=crop&auto=format"
                  alt="Máy giặt"
                  className="h-44 w-full rounded-2xl object-cover shadow-xl"
                />

                <img
                  src="https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=300&h=200&fit=crop&auto=format"
                  alt="Điều hòa"
                  className="h-36 w-full rounded-2xl object-cover shadow-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= VALUE PROPS ================= */}
      <section className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                icon: <Truck size={20} />,
                title: "Giao hàng miễn phí",
                sub: "Đơn từ 500.000₫",
              },
              {
                icon: <Shield size={20} />,
                title: "Bảo hành chính hãng",
                sub: "Đến 36 tháng",
              },
              {
                icon: <Headphones size={20} />,
                title: "Hỗ trợ 24/7",
                sub: "Hotline 1800 6868",
              },
              {
                icon: <Award size={20} />,
                title: "100% chính hãng",
                sub: "Cam kết hoàn tiền",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 py-2"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#eaf4f6] text-[#0F5F73]">
                  {item.icon}
                </div>

                <div>
                  <div className="text-sm font-semibold text-[#1F2937]">
                    {item.title}
                  </div>

                  <div className="text-xs text-[#667085]">
                    {item.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#1F2937]">
            Danh mục sản phẩm
          </h2>

          <button
            onClick={goProducts}
            className="flex items-center gap-1 text-sm font-medium text-[#0F5F73] hover:underline"
          >
            Xem tất cả
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={goProducts}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-3 transition-all hover:border-[#0F5F73] hover:shadow-md"
            >
              <span className="text-2xl">
                {category.icon}
              </span>

              <span className="text-center text-xs font-medium leading-tight text-[#1F2937] transition-colors group-hover:text-[#0F5F73]">
                {category.name}
              </span>

              <span className="text-xs text-[#667085]">
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ================= PRODUCT COMPARISON ================= */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="flex flex-col gap-6 rounded-2xl border border-[#B6DBE4] bg-[#EAF4F6] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F5F73] text-white"><ArrowLeftRight size={23} /></span>
            <div>
              <h2 className="text-xl font-bold text-[#1F2937]">So sánh sản phẩm</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#667085]">Chọn hai sản phẩm cùng loại để xem giá, hãng và các thông số cạnh nhau.</p>
            </div>
          </div>
          <Link to="/compare" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0F5F73] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B4E60]">Bắt đầu so sánh <ArrowRight size={16} /></Link>
        </div>
      </section>

      {/* ================= FEATURED PRODUCTS ================= */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1F2937]">
              Sản phẩm mới
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Sản phẩm hiện đang được niêm yết
            </p>
          </div>

          <button
            onClick={goProducts}
            className="flex items-center gap-1 text-sm font-medium text-[#0F5F73] hover:underline"
          >
            Xem thêm
            <ChevronRight size={14} />
          </button>
        </div>

        {catalogLoading ? <p className="py-10 text-center text-sm text-[#667085]" role="status">Đang tải sản phẩm…</p> : featured.length ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              navigate={goProductDetail}
              onAddToCart={addToCart}
              adding={addingProductId === product.id}
            />
          ))}
        </div> : <p className="py-10 text-center text-sm text-[#667085]">Chưa có sản phẩm đang bán.</p>}
      </section>

      {/* ================= PROMO ================= */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative flex min-h-36 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-[#0F5F73] to-[#0B4E60] p-6 text-white">
            <div className="absolute bottom-0 right-0 opacity-20">
              <div className="h-32 w-32 -translate-x-4 translate-y-4 rounded-full bg-white" />
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64CCC5]">
                Ưu đãi đặc biệt
              </div>

              <div className="text-xl font-bold">
                Giảm đến 30%
                <br />
                Tủ lạnh & Máy giặt
              </div>
            </div>

            <button
              onClick={goProducts}
              className="mt-4 w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0F5F73] transition-all hover:bg-[#0B4E60] hover:text-white"
            >
              Mua ngay →
            </button>
          </div>

          <div className="relative flex min-h-36 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-[#0B4E60] to-[#1F2937] p-6 text-white">
            <div className="absolute bottom-0 right-0 opacity-20">
              <div className="h-32 w-32 -translate-x-4 translate-y-4 rounded-full bg-[#64CCC5]" />
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64CCC5]">
                Dịch vụ
              </div>

              <div className="text-xl font-bold">
                Đặt lịch sửa chữa
                <br />
                tại nhà – Nhanh chóng
              </div>
            </div>

            <button
              onClick={() =>
                alert("Trang đặt lịch sửa chữa")
              }
              className="mt-4 w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0F5F73] transition-all hover:bg-[#EAF4F6]"
            >
              Đặt lịch ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ================= BEST SELLERS ================= */}
      <section className="border-y border-[#E5E7EB] bg-white py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937]">
                Thêm lựa chọn
              </h2>

              <p className="mt-1 text-sm text-[#667085]">
                Một số sản phẩm khác đang được niêm yết
              </p>
            </div>

            <button
              onClick={goProducts}
              className="flex items-center gap-1 text-sm font-medium text-[#0F5F73] hover:underline"
            >
              Xem thêm
              <ChevronRight size={14} />
            </button>
          </div>

          {catalogLoading ? <p className="py-10 text-center text-sm text-[#667085]" role="status">Đang tải sản phẩm…</p> : bestsellers.length > 0 && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bestsellers.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                navigate={goProductDetail}
                onAddToCart={addToCart}
                adding={addingProductId === product.id}
              />
            ))}
          </div>}
        </div>
      </section>

      {/* ================= WARRANTY ================= */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="rounded-3xl bg-[#eaf4f6] p-8 lg:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0F5F73] px-4 py-1 text-xs font-semibold text-white">
                <Shield size={12} />
                Dịch vụ bảo hành & sửa chữa
              </div>

              <h2 className="mb-4 text-3xl font-bold text-[#1F2937]">
                Bảo hành tự động.
                <br />
                <span className="text-[#0F5F73]">
                  Sửa chữa nhanh chóng.
                </span>
              </h2>

              <p className="mb-6 leading-relaxed text-[#667085]">
                Mọi sản phẩm mua tại HomeCare đều được đăng
                ký bảo hành tự động. Khi có sự cố, đội ngũ kỹ
                thuật viên chuyên nghiệp sẽ đến nhà bạn trong
                vòng 24 giờ.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    alert("Trang tra cứu bảo hành")
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#0F5F73] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#0B4E60]"
                >
                  <Shield size={15} />
                  Tra cứu bảo hành
                </button>

                <button
                  onClick={() =>
                    alert("Trang đặt lịch sửa chữa")
                  }
                  className="rounded-xl border border-[#0F5F73] bg-white px-5 py-2.5 font-semibold text-[#0F5F73] transition-colors hover:bg-[#eaf4f6]"
                >
                  Đặt lịch sửa chữa
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: "🔍",
                  title: "Tra cứu bảo hành",
                  desc: "Kiểm tra tình trạng bảo hành nhanh chóng theo mã đơn hàng hoặc serial sản phẩm",
                },
                {
                  icon: "🔧",
                  title: "Yêu cầu sửa chữa",
                  desc: "Gửi yêu cầu sửa chữa online, kỹ thuật viên đến nhà trong 24h",
                },
                {
                  icon: "📍",
                  title: "Theo dõi tiến độ",
                  desc: "Cập nhật trạng thái sửa chữa theo từng bước quy trình",
                },
                {
                  icon: "📋",
                  title: "Lịch sử bảo hành",
                  desc: "Xem toàn bộ lịch sử bảo hành và sửa chữa của thiết bị",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-4"
                >
                  <div className="mb-2 text-2xl">
                    {item.icon}
                  </div>

                  <div className="mb-1 text-sm font-semibold text-[#1F2937]">
                    {item.title}
                  </div>

                  <div className="text-xs leading-relaxed text-[#667085]">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= REVIEWS ================= */}
      <section className="border-y border-[#E5E7EB] bg-white py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-[#1F2937]">
              Khách hàng nói gì về HomeCare?
            </h2>

            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((item) => (
                  <Star
                    key={item}
                    size={16}
                    className="fill-[#F59E0B] text-[#F59E0B]"
                  />
                ))}
              </div>

              <span className="ml-1 text-sm text-[#667085]">
                4.8/5 từ 2.300+ đánh giá
              </span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {reviews.map((review, index) => (
              <div
                key={index}
                className="rounded-2xl border border-[#E5E7EB] bg-[#F7FAFC] p-5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F5F73] font-bold text-white">
                    {review.avatar}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[#1F2937]">
                      {review.name}
                    </div>

                    <div className="text-xs text-[#667085]">
                      {review.product}
                    </div>
                  </div>

                  <div className="ml-auto flex">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <Star
                        key={item}
                        size={12}
                        className={
                          item <= review.rating
                            ? "fill-[#F59E0B] text-[#F59E0B]"
                            : "text-gray-200"
                        }
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-[#667085]">
                  "{review.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {cartMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${cartError ? "border-[#FECACA] bg-[#FEF2F2] text-[#B42318]" : "border-[#A6D4BD] bg-[#F2FAF5] text-[#216444]"}`}
          role={cartError ? "alert" : "status"}
        >
          {cartMessage}{!cartError && <Link to="/checkout" className="ml-2 font-semibold text-[#0F5F73]">Thanh toán</Link>}
        </div>
      )}
    </div>
  );
}
