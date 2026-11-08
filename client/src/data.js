export function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN").format(price) + "₫";
}
