import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Star,
  Shield,
  Truck,
  ChevronLeft,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
  ArrowLeftRight,
} from "lucide-react";

import { formatPrice } from "../../data";
import { useProductDetail } from "../../hooks/use-storefront";

export default function ProductDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: product, error, loading } = useProductDetail(id);

  const [selectedImg, setSelectedImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("specs");

  if (!product) {
    return (
      <main className="min-h-screen bg-[#F7FAFC] px-4 py-16">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-2xl font-bold text-[#1F2937]">
            {loading ? "Đang tải sản phẩm..." : error?.status === 404 ? "Không tìm thấy sản phẩm" : error?.message}
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

  const images = product.images;
  const comparisonUrl = `/compare?${new URLSearchParams({ product: String(product.id), name: product.name, category: product.category })}`;

  const addToCart = () => {
    navigate('/cart');
  };

  const buyNow = () => {
    navigate('/cart');
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
              {product.rating != null ? (
                <>
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
                </>
              ) : (
                <span className="text-sm text-[#64748B]">
                  Chưa có đánh giá
                </span>
              )}

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
                  Chọn phiên bản để mua
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
            <Link
              to={comparisonUrl}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#176B87] px-4 py-3 text-sm font-semibold text-[#176B87] transition-colors hover:bg-[#E8F4F7]"
            >
              <ArrowLeftRight size={17} /> So sánh với sản phẩm cùng loại
            </Link>
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
              <div className="py-8 text-center text-sm text-[#64748B]">
                Chưa có đánh giá cho sản phẩm này.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
