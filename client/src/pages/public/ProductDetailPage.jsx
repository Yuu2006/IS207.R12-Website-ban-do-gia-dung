import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Star,
  Shield,
  Truck,
  ChevronLeft,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
} from "lucide-react";

import { products, formatPrice } from "../../data";

const reviews = [
  {
    name: "Nguyễn Thị Hoa",
    rating: 5,
    date: "10/11/2024",
    text: "Sản phẩm tốt, đúng như mô tả. Giao hàng nhanh, đóng gói cẩn thận. Kỹ thuật viên đến lắp đặt rất chuyên nghiệp.",
    verified: true,
  },
  {
    name: "Phạm Minh Khoa",
    rating: 4,
    date: "05/11/2024",
    text: "Máy chạy êm, tiết kiệm điện. Dung tích phù hợp với gia đình 4 người. Hài lòng với sản phẩm này.",
    verified: true,
  },
  {
    name: "Lê Thị Thu",
    rating: 5,
    date: "28/10/2024",
    text: "Thiết kế đẹp, tính năng hiện đại. Đã dùng 2 tuần thấy rất ổn định. Giá tốt so với thị trường.",
    verified: false,
  },
];

export default function ProductDetailPage() {
  const { id } = useParams();

const product = products.find(
  (item) => String(item.id) === String(id)
);

if (!product) {
  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-16">
      <div className="mx-auto max-w-7xl text-center">
        <h1 className="text-2xl font-bold text-[#1F2937]">
          Không tìm thấy sản phẩm
        </h1>

        <Link
          to="/products"
          className="mt-4 inline-block text-[#176B87]"
        >
          ← Quay lại danh sách sản phẩm
        </Link>
      </div>
    </main>
  );
}
  const [selectedImg, setSelectedImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("specs");

  const images =
    product.images?.length > 0
      ? product.images
      : [product.image];

  const addToCart = () => {
    console.log("Thêm vào giỏ:", product, "Số lượng:", qty);
  };

  const buyNow = () => {
    console.log("Mua ngay:", product, "Số lượng:", qty);
  };

  return (
    <main className="min-h-screen bg-[#F7FAFC]">
      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* BACK */}
        <Link
          to="/products"
          className="mb-6 flex w-fit items-center gap-1 text-sm text-[#64748B] hover:text-[#176B87]"
        >
          <ChevronLeft size={14} />
          Quay lại danh sách sản phẩm
        </Link>

        {/* ================= PRODUCT ================= */}
        <div className="mb-10 grid gap-10 lg:grid-cols-2">

          {/* IMAGE GALLERY */}
          <div>
            <div className="mb-3 aspect-square overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
              <img
                src={images[selectedImg]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex gap-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedImg(index)}
                  className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors ${
                    selectedImg === index
                      ? "border-[#176B87]"
                      : "border-[#E2E8F0]"
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* PRODUCT INFORMATION */}
          <div>

            {/* BRAND */}
            <div className="mb-1 text-sm font-semibold text-[#176B87]">
              {product.brand}
            </div>

            {/* NAME */}
            <h1
              className="mb-3 text-2xl font-bold leading-snug text-[#1F2937]"
              style={{
                fontFamily: "'Be Vietnam Pro', sans-serif",
              }}
            >
              {product.name}
            </h1>

            {/* RATING */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className={
                      star <= Math.floor(product.rating)
                        ? "fill-[#F59E0B] text-[#F59E0B]"
                        : "fill-gray-200 text-gray-200"
                    }
                  />
                ))}
              </div>

              <span className="text-sm font-semibold">
                {product.rating}
              </span>

              <span className="text-sm text-[#64748B]">
                ({product.reviewCount} đánh giá)
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  product.inStock
                    ? "bg-[#dcfce7] text-[#15803d]"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {product.inStock
                  ? "✓ Còn hàng"
                  : "Hết hàng"}
              </span>
            </div>

            {/* PRICE */}
            <div className="mb-5 rounded-2xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div
                  className="text-3xl font-bold text-[#176B87]"
                  style={{
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                  }}
                >
                  {formatPrice(product.price)}
                </div>

                {product.discount > 0 && (
                  <>
                    <div className="mb-0.5 text-lg text-[#64748B] line-through">
                      {formatPrice(product.originalPrice)}
                    </div>

                    <div className="mb-0.5 rounded-lg bg-[#EF4444] px-2 py-0.5 text-sm font-bold text-white">
                      -{product.discount}%
                    </div>
                  </>
                )}
              </div>

              {product.discount > 0 && (
                <div className="mt-1 text-sm font-medium text-[#22C55E]">
                  Tiết kiệm{" "}
                  {formatPrice(
                    product.originalPrice - product.price
                  )}
                </div>
              )}
            </div>

            {/* SERVICE INFORMATION */}
            <div className="mb-5 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield
                  size={16}
                  className="flex-shrink-0 text-[#22C55E]"
                />

                <span className="text-[#1F2937]">
                  Bảo hành chính hãng{" "}
                  <strong>{product.warranty}</strong>{" "}
                  tại HomeCare
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Truck
                  size={16}
                  className="flex-shrink-0 text-[#176B87]"
                />

                <span className="text-[#1F2937]">
                  Giao hàng miễn phí – Dự kiến{" "}
                  <strong>2–3 ngày</strong>
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Zap
                  size={16}
                  className="flex-shrink-0 text-[#F59E0B]"
                />

                <span className="text-[#1F2937]">
                  Lắp đặt tại nhà miễn phí trong 24h
                </span>
              </div>
            </div>

            {/* QUANTITY */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setQty((value) => Math.max(1, value - 1))
                  }
                  className="px-3 py-2 text-[#1F2937] hover:bg-gray-50"
                >
                  <Minus size={14} />
                </button>

                <span className="flex w-10 items-center justify-center text-sm font-medium">
                  {qty}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQty((value) => Math.min(5, value + 1))
                  }
                  className="px-3 py-2 text-[#1F2937] hover:bg-gray-50"
                >
                  <Plus size={14} />
                </button>
              </div>

              <span className="text-xs text-[#64748B]">
                Tối đa 5 sản phẩm/đơn hàng
              </span>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={addToCart}
                disabled={!product.inStock}
                className="flex-1 rounded-xl border border-[#176B87] bg-[#e8f4f8] py-3 font-semibold text-[#176B87] transition-all hover:bg-[#176B87] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  <ShoppingCart size={16} />
                  Thêm vào giỏ
                </span>
              </button>

              <button
                type="button"
                onClick={buyNow}
                disabled={!product.inStock}
                className="flex-1 rounded-xl bg-[#176B87] py-3 font-semibold text-white transition-all hover:bg-[#0f4f65] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mua ngay
              </button>
            </div>
          </div>
        </div>

        {/* ================= TABS ================= */}
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">

          {/* TAB HEADER */}
          <div className="flex overflow-x-auto border-b border-[#E2E8F0]">
            {[
              ["specs", "Thông số kỹ thuật"],
              ["warranty", "Bảo hành"],
              [
                "reviews",
                `Đánh giá (${product.reviewCount})`,
              ],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`whitespace-nowrap px-5 py-3.5 text-sm font-medium transition-colors ${
                  tab === value
                    ? "border-b-2 border-[#176B87] text-[#176B87]"
                    : "text-[#64748B] hover:text-[#1F2937]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="p-6">

            {/* SPECS */}
            {tab === "specs" && (
              <table className="w-full">
                <tbody>
                  {Object.entries(product.specs || {}).map(
                    ([key, value]) => (
                      <tr
                        key={key}
                        className="border-b border-[#E2E8F0] last:border-0"
                      >
                        <td className="w-40 py-3 text-sm text-[#64748B]">
                          {key}
                        </td>

                        <td className="py-3 text-sm font-medium text-[#1F2937]">
                          {value}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}

            {/* WARRANTY */}
            {tab === "warranty" && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-[#dcfce7] p-4">
                  <Shield
                    size={18}
                    className="mt-0.5 flex-shrink-0 text-[#15803d]"
                  />

                  <div>
                    <div className="text-sm font-semibold text-[#15803d]">
                      Bảo hành chính hãng{" "}
                      {product.warranty}
                    </div>

                    <div className="mt-1 text-sm leading-relaxed text-[#166534]">
                      Sản phẩm được bảo hành chính hãng
                      tại hệ thống trung tâm bảo hành
                      HomeCare toàn quốc. Kỹ thuật viên
                      đến nhà trong vòng 24h kể từ khi
                      tiếp nhận yêu cầu.
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-[#1F2937]">
                  <p>
                    • Bảo hành miễn phí linh kiện và công
                    lao động trong thời hạn bảo hành
                  </p>

                  <p>
                    • Phạm vi bảo hành: lỗi kỹ thuật do
                    nhà sản xuất
                  </p>

                  <p>
                    • Không bảo hành: hư hỏng do tác động
                    bên ngoài, sử dụng sai cách
                  </p>

                  <p>
                    • Đăng ký bảo hành tự động khi mua tại
                    HomeCare
                  </p>
                </div>

                <button
                  type="button"
                  className="rounded-xl bg-[#176B87] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4f65]"
                >
                  Tra cứu bảo hành
                </button>
              </div>
            )}

            {/* REVIEWS */}
            {tab === "reviews" && (
              <div>
                {/* SUMMARY */}
                <div className="mb-6 flex gap-8 rounded-2xl bg-[#F7FAFC] p-4">
                  <div className="text-center">
                    <div
                      className="text-4xl font-bold text-[#176B87]"
                      style={{
                        fontFamily:
                          "'Be Vietnam Pro', sans-serif",
                      }}
                    >
                      {product.rating}
                    </div>

                    <div className="my-1 flex justify-center">
                      {[1, 2, 3, 4, 5].map(
                        (star) => (
                          <Star
                            key={star}
                            size={14}
                            className="fill-[#F59E0B] text-[#F59E0B]"
                          />
                        )
                      )}
                    </div>

                    <div className="text-xs text-[#64748B]">
                      {product.reviewCount} đánh giá
                    </div>
                  </div>

                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map(
                      (star) => {
                        const percentage =
                          star === 5
                            ? 70
                            : star === 4
                              ? 20
                              : 6;

                        return (
                          <div
                            key={star}
                            className="flex items-center gap-2"
                          >
                            <span className="w-4 text-xs">
                              {star}★
                            </span>

                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full rounded-full bg-[#F59E0B]"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>

                            <span className="w-8 text-xs text-[#64748B]">
                              {percentage}%
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* REVIEW LIST */}
                <div className="space-y-4">
                  {reviews.map((review, index) => (
                    <div
                      key={index}
                      className="border-b border-[#E2E8F0] pb-4 last:border-0"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#176B87] text-xs font-bold text-white">
                            {review.name[0]}
                          </div>

                          <div>
                            <div className="text-sm font-medium text-[#1F2937]">
                              {review.name}
                            </div>

                            {review.verified && (
                              <div className="text-xs text-[#22C55E]">
                                ✓ Đã mua hàng
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="text-xs text-[#64748B]">
                          {review.date}
                        </span>
                      </div>

                      <div className="mb-1 flex">
                        {[1, 2, 3, 4, 5].map(
                          (star) => (
                            <Star
                              key={star}
                              size={12}
                              className={
                                star <= review.rating
                                  ? "fill-[#F59E0B] text-[#F59E0B]"
                                  : "fill-gray-200 text-gray-200"
                              }
                            />
                          )
                        )}
                      </div>

                      <p className="text-sm leading-relaxed text-[#64748B]">
                        {review.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}