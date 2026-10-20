// Chỉ dùng trong bản mẫu giao diện; không phải sản phẩm, giá hoặc lời khuyên từ catalog.
export const demoProducts = [
  { id: 'sample-a', name: 'Máy giặt mẫu A', categoryId: 'sample-washer', priceVnd: 7900000, capacityKg: 8, usage: '2–3 người', warrantyMonths: 24 },
  { id: 'sample-b', name: 'Máy giặt mẫu B', categoryId: 'sample-washer', priceVnd: 8900000, capacityKg: 9, usage: '3–4 người', warrantyMonths: 24 },
  { id: 'sample-c', name: 'Máy giặt mẫu C', categoryId: 'sample-washer', priceVnd: 10500000, capacityKg: 10, usage: '4–5 người', warrantyMonths: 36 },
  { id: 'sample-d', name: 'Máy giặt mẫu D', categoryId: 'sample-washer', priceVnd: 11900000, capacityKg: 11, usage: '5 người trở lên', warrantyMonths: 36 },
];

export const demoComparisonFields = [
  { id: 'price', label: 'Giá', display: product => new Intl.NumberFormat('vi-VN').format(product.priceVnd) + ' ₫' },
  { id: 'performance', label: 'Khối lượng giặt', display: product => `${product.capacityKg} kg` },
  { id: 'usage', label: 'Nhu cầu sử dụng', display: product => product.usage },
  { id: 'warranty', label: 'Bảo hành', display: product => `${product.warrantyMonths} tháng` },
];
