// Phiếu kho nhiều dòng. API chỉ nhận một SKU mỗi lần POST (mỗi lần một transaction riêng) nên phiếu không atomic:
// gửi tuần tự, dừng ở dòng lỗi đầu tiên, gửi lại bỏ qua dòng đã ghi và giữ nguyên mã chứng từ từng dòng.

// PN-/PX-/DC-<thời gian>-<ngẫu nhiên>; mã từng dòng thêm -<số dòng cố định>, tối đa 100 ký tự theo API.
export const sheetCode = (prefix, now = new Date(), random = crypto.getRandomValues(new Uint16Array(1))[0]) => `${prefix}-${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${random.toString(16).padStart(4, '0')}`;
export const lineCode = (code, key) => `${code}-${key}`;

// API không có loại "adjust": chênh lệch dương gửi import, âm gửi export, dòng không lệch không gửi (null).
export function adjustmentRequest({ sku, system, actual, reference_code, note }) {
  const difference = actual - system;
  return difference === 0 ? null : { sku, movement_type: difference > 0 ? 'import' : 'export', quantity: Math.abs(difference), reference_code, note };
}

const conflictMessage = 'Mã chứng từ của dòng này đã tồn tại: lần gửi trước có thể đã ghi. Hãy kiểm tra Nhật ký kho trước khi gửi lại.';
// Mất kết nối hoặc 5xx không chứng minh phiếu chưa ghi; gửi lại cùng mã sẽ báo trùng (409) nếu đã ghi.
const isUncertain = error => !error.status || error.status >= 500;

// lines: [{ key, request, result? }]; trả { results: { [key]: dữ liệu server }, failure: { key, message } | null }.
export async function submitStockLines(lines, post) {
  const results = {};
  for (const line of lines) {
    if (line.result) continue;
    try { results[line.key] = await post(line.request); }
    catch (error) {
      const message = error.status === 409 ? conflictMessage : isUncertain(error) ? `${error.message} Dòng này có thể đã được ghi: kiểm tra Nhật ký kho nếu gửi lại báo trùng mã.` : error.message;
      return { results, failure: { key: line.key, message } };
    }
  }
  return { results, failure: null };
}
