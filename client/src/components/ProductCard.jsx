import {
  ShoppingCart,
  Star,
  ArrowRight,
  Heart,
} from "lucide-react";

import { formatPrice } from "../data";

export default function ProductCard({
  product,
  navigate,
  onAddToCart,
  adding = false,
  favorite = false,
  onToggleWishlist,
  wishlistBusy = false,
}) {
  return (
    <div className="group bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-lg hover:border-[#0F5F73] transition-all">
      {/* IMAGE */}
      <div className="relative">
      <button
        type="button"
        onClick={() => navigate(product.id)}
        className="w-full text-left"
      >
        <div className="relative aspect-square bg-[#F7FAFC] overflow-hidden">
          {product.image ? <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(event) => { event.currentTarget.hidden = true; }}
          /> : <span className="flex h-full items-center justify-center text-sm text-[#94A3B8]">Chưa có hình ảnh</span>}

          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-[#0F5F73]">
            {product.brand}
          </div>
        </div>
      </button>
      {/* Wishlist heart sits beside (not inside) the image button; shown only where the page wires CUS-11. */}
      {onToggleWishlist && <button
        type="button"
        onClick={() => onToggleWishlist(product)}
        disabled={wishlistBusy}
        aria-pressed={favorite}
        aria-label={favorite ? `Bỏ yêu thích ${product.name}` : `Thêm ${product.name} vào yêu thích`}
        className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center transition-colors disabled:opacity-50 ${favorite ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}
        title={favorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
      </button>}
      </div>

      {/* CONTENT */}
      <div className="p-4">
        <button
          type="button"
          onClick={() => navigate(product.id)}
          className="text-left"
        >
          <h3 className="font-semibold text-sm text-[#1F2937] leading-snug line-clamp-2 min-h-[40px] hover:text-[#0F5F73] transition-colors">
            {product.name}
          </h3>
        </button>

        {/* RATING */}
        {Number.isFinite(Number(product.rating)) && product.rating !== null ? <div className="flex items-center gap-1 mt-2">
          <Star size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
          <span className="text-xs font-medium text-[#1F2937]">{product.rating}</span>
          <span className="text-xs text-[#94A3B8]">({product.reviews})</span>
        </div> : <div className="mt-2 text-xs text-[#667085]">Chưa có đánh giá</div>}

        {/* PRICE + CART */}
        <div className="flex items-end justify-between gap-2 mt-3">
          <div>
            <div className="text-lg font-bold text-[#0F5F73]">
              {formatPrice(product.price)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={adding || !product.inStock}
            className="w-9 h-9 rounded-lg bg-[#0F5F73] text-white flex items-center justify-center hover:bg-[#0B4E60] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title={!product.inStock ? "Sản phẩm hết hàng" : product.variant_count > 1 ? "Chọn SKU trên trang chi tiết" : "Thêm vào giỏ hàng"}
            aria-label={!product.inStock ? `Hết hàng: ${product.name}` : `Thêm ${product.name} vào giỏ hàng`}
          >
            {adding ? <span className="text-xs" aria-hidden="true">…</span> : <ShoppingCart size={16} />}
          </button>
        </div>

        {/* DETAIL */}
        <button
          type="button"
          onClick={() => navigate(product.id)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs font-medium text-[#667085] hover:text-[#0F5F73] transition-colors"
        >
          Xem chi tiết
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
