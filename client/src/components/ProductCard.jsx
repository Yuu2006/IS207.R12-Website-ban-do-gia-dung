import {
  ShoppingCart,
  Star,
  ArrowRight,
} from "lucide-react";

import { formatPrice } from "../data";

export default function ProductCard({
  product,
  navigate,
  onAddToCart,
}) {
  return (
    <div className="group bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden hover:shadow-lg hover:border-[#64CCC5] transition-all">
      {/* IMAGE */}
      <button
        type="button"
        onClick={() => navigate(product.id)}
        className="w-full text-left"
      >
        <div className="relative aspect-square bg-[#F7FAFC] overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-[#176B87]">
            {product.brand}
          </div>
        </div>
      </button>

      {/* CONTENT */}
      <div className="p-4">
        <button
          type="button"
          onClick={() => navigate(product.id)}
          className="text-left"
        >
          <h3 className="font-semibold text-sm text-[#1F2937] leading-snug line-clamp-2 min-h-[40px] hover:text-[#176B87] transition-colors">
            {product.name}
          </h3>
        </button>

        {/* RATING */}
        <div className="flex items-center gap-1 mt-2">
          <Star
            size={13}
            className="fill-[#F59E0B] text-[#F59E0B]"
          />

          <span className="text-xs font-medium text-[#1F2937]">
            {product.rating}
          </span>

          <span className="text-xs text-[#94A3B8]">
            ({product.reviews})
          </span>
        </div>

        {/* PRICE + CART */}
        <div className="flex items-end justify-between gap-2 mt-3">
          <div>
            <div className="text-lg font-bold text-[#176B87]">
              {formatPrice(product.price)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="w-9 h-9 rounded-xl bg-[#176B87] text-white flex items-center justify-center hover:bg-[#0f4f65] transition-colors"
            title="Thêm vào giỏ hàng"
          >
            <ShoppingCart size={16} />
          </button>
        </div>

        {/* DETAIL */}
        <button
          type="button"
          onClick={() => navigate(product.id)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs font-medium text-[#64748B] hover:text-[#176B87] transition-colors"
        >
          Xem chi tiết
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}