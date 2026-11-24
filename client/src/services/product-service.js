import { addProductImage, adjustStock, products, saveVariant, uploadImage } from './catalog-service.js';

// Tạo sản phẩm nhiều bước vì API hiện tại chỉ nhận một SKU đầu tiên khi tạo sản phẩm:
// 1) sản phẩm + SKU đầu, 2) SKU còn lại, 3) tải ảnh, 4) tồn ban đầu bằng phiếu nhập (có log người/lý do theo quy tắc kho).
// Bước sau lỗi thì sản phẩm đã tồn tại: lỗi ném ra mang `partial = { id, step }` để giao diện báo cần bổ sung ở Sửa sản phẩm.
export async function createProduct({ product, variants, images }) {
  const [first, ...rest] = variants;
  const saved = await products.save(null, { ...product, sku: first.sku, variant_name: first.variant_name, price: first.price });
  const step = async (label, run) => {
    try { return await run(); } catch (error) { error.partial = { id: saved.id, step: label }; throw error; }
  };
  for (const variant of rest) await step(`SKU ${variant.sku}`, () => saveVariant(saved.id, null, { sku: variant.sku, variant_name: variant.variant_name, price: variant.price }));
  for (const [index, image] of images.entries()) {
    await step(`ảnh ${index + 1}`, async () => addProductImage(saved.id, { image_url: await uploadImage(image.file, 'products'), sort_order: index * 10, is_primary: image.primary }));
  }
  for (const variant of variants) {
    if (Number(variant.stock) > 0) await step(`tồn kho ${variant.sku}`, () => adjustStock({ sku: variant.sku, movement_type: 'import', quantity: Number(variant.stock), reference_code: `INIT-${variant.sku}`.slice(0, 100), note: 'Tồn kho ban đầu khi tạo sản phẩm' }));
  }
  return saved;
}

// Ẩn/hiện = đổi is_active; PUT cần đủ trường bắt buộc nên gửi lại từ dòng danh sách.
export const setProductActive = (item, active) => products.save(item.id, {
  category_id: Number(item.category_id), brand_id: Number(item.brand_id), product_code: item.product_code, name: item.name, slug: item.slug,
  description: item.description || '', warranty_months: Number(item.warranty_months), is_active: active ? 1 : 0,
});
