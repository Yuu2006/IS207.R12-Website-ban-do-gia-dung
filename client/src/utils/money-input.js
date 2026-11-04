// Giá trị chuẩn của ô tiền là chuỗi DECIMAL '1500.5' (tối đa 2 số lẻ), không qua Number/float. Hiển thị theo vi-VN: 1.500,5.

// Bỏ số 0 thừa của DECIMAL từ server ('1500.50' → '1500.5', '1000.00' → '1000'); chuỗi không có dấu chấm giữ nguyên ('1000').
export const toMoneyValue = value => value === null || value === undefined || value === '' ? '' : String(value).includes('.') ? String(value).replace(/\.?0+$/, '') : String(value);

// Chuỗi chuẩn → chuỗi hiển thị ('1500.5' → '1.500,5'; '1500.' đang gõ dở → '1.500,').
export function formatMoneyInput(value) {
  if (!value) return '';
  const [whole, fraction] = String(value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

// Chuỗi người dùng gõ → chuỗi chuẩn: dấu chấm là phân cách nghìn (bỏ), dấu phẩy là phần thập phân.
export function parseMoneyInput(text) {
  const [whole, ...rest] = String(text).replace(/[^\d,]/g, '').split(',');
  const digits = whole.replace(/^0+(?=\d)/, '');
  return rest.length ? `${digits || '0'}.${rest.join('').slice(0, 2)}` : digits;
}
