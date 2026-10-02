import {
  ArrowRight,
  Star,
  Shield,
  Truck,
  Headphones,
  Award,
  ChevronRight,
} from "lucide-react";

import { categories, products } from "../../data";
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
  const featured = products.slice(0, 4);
  const bestsellers = products.slice(2, 6);

  const goProducts = () => {
    window.location.href = "/products";
  };

  const goProductDetail = (id) => {
    window.location.href = `/products/${id}`;
  };

  const addToCart = (product) => {
    console.log("Add to cart:", product);
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#176B87] via-[#176B87] to-[#0f4f65]">
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
                  className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-[#176B87] transition-all hover:bg-[#64CCC5] hover:text-white"
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
      <section className="border-b border-[#E2E8F0] bg-white">
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
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#e8f4f8] text-[#176B87]">
                  {item.icon}
                </div>

                <div>
                  <div className="text-sm font-semibold text-[#1F2937]">
                    {item.title}
                  </div>

                  <div className="text-xs text-[#64748B]">
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
            className="flex items-center gap-1 text-sm font-medium text-[#176B87] hover:underline"
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
              className="group flex flex-col items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-3 transition-all hover:border-[#176B87] hover:shadow-md"
            >
              <span className="text-2xl">
                {category.icon}
              </span>

              <span className="text-center text-xs font-medium leading-tight text-[#1F2937] transition-colors group-hover:text-[#176B87]">
                {category.name}
              </span>

              <span className="text-xs text-[#64748B]">
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ================= FEATURED PRODUCTS ================= */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1F2937]">
              Sản phẩm nổi bật
            </h2>

            <p className="mt-1 text-sm text-[#64748B]">
              Được khách hàng yêu thích nhất
            </p>
          </div>

          <button
            onClick={goProducts}
            className="flex items-center gap-1 text-sm font-medium text-[#176B87] hover:underline"
          >
            Xem thêm
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              navigate={goProductDetail}
              onAddToCart={addToCart}
            />
          ))}
        </div>
      </section>

      {/* ================= PROMO ================= */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#176B87] to-[#0f4f65] p-6 text-white">
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
              className="mt-4 w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#176B87] transition-all hover:bg-[#64CCC5] hover:text-white"
            >
              Mua ngay →
            </button>
          </div>

          <div className="relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f4f65] to-[#1F2937] p-6 text-white">
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
              className="mt-4 w-fit rounded-xl bg-[#64CCC5] px-4 py-2 text-sm font-semibold text-[#1F2937] transition-all hover:opacity-90"
            >
              Đặt lịch ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ================= BEST SELLERS ================= */}
      <section className="border-y border-[#E2E8F0] bg-white py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937]">
                Bán chạy nhất
              </h2>

              <p className="mt-1 text-sm text-[#64748B]">
                Top sản phẩm được mua nhiều nhất tháng này
              </p>
            </div>

            <button
              onClick={goProducts}
              className="flex items-center gap-1 text-sm font-medium text-[#176B87] hover:underline"
            >
              Xem thêm
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bestsellers.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                navigate={goProductDetail}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ================= WARRANTY ================= */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="rounded-3xl bg-[#e8f4f8] p-8 lg:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#176B87] px-4 py-1 text-xs font-semibold text-white">
                <Shield size={12} />
                Dịch vụ bảo hành & sửa chữa
              </div>

              <h2 className="mb-4 text-3xl font-bold text-[#1F2937]">
                Bảo hành tự động.
                <br />
                <span className="text-[#176B87]">
                  Sửa chữa nhanh chóng.
                </span>
              </h2>

              <p className="mb-6 leading-relaxed text-[#64748B]">
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
                  className="flex items-center gap-2 rounded-xl bg-[#176B87] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#0f4f65]"
                >
                  <Shield size={15} />
                  Tra cứu bảo hành
                </button>

                <button
                  onClick={() =>
                    alert("Trang đặt lịch sửa chữa")
                  }
                  className="rounded-xl border border-[#176B87] bg-white px-5 py-2.5 font-semibold text-[#176B87] transition-colors hover:bg-[#e8f4f8]"
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
                  className="rounded-2xl border border-[#E2E8F0] bg-white p-4"
                >
                  <div className="mb-2 text-2xl">
                    {item.icon}
                  </div>

                  <div className="mb-1 text-sm font-semibold text-[#1F2937]">
                    {item.title}
                  </div>

                  <div className="text-xs leading-relaxed text-[#64748B]">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= REVIEWS ================= */}
      <section className="border-y border-[#E2E8F0] bg-white py-12">
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

              <span className="ml-1 text-sm text-[#64748B]">
                4.8/5 từ 2.300+ đánh giá
              </span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {reviews.map((review, index) => (
              <div
                key={index}
                className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC] p-5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#176B87] font-bold text-white">
                    {review.avatar}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[#1F2937]">
                      {review.name}
                    </div>

                    <div className="text-xs text-[#64748B]">
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

                <p className="text-sm leading-relaxed text-[#64748B]">
                  "{review.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}