// Tóm tắt danh sách SKU sắp hết (đã lọc ở server) cho khối cảnh báo: tổng, số hết hàng, `limit` SKU ít tồn nhất.
export function summarizeLowStock(items, limit = 5) {
  const sorted = [...items].sort((a, b) => a.stock_quantity - b.stock_quantity);
  return { total: items.length, outOfStock: items.filter(item => item.stock_quantity === 0).length, top: sorted.slice(0, limit) };
}
