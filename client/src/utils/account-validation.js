// Kiểm tra form tài khoản phía giao diện; backend luôn kiểm tra lại cùng quy tắc.
export function normalizeContact(value) {
  const contact = String(value ?? '').trim();
  return contact.includes('@') ? contact.toLowerCase() : contact.replace(/[\s.\-]/g, '').replace(/^\+84/, '0');
}

const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isPhone = value => /^0\d{9}$/.test(normalizeContact(value));

// Cùng quy tắc CUS-01 với PHP: 8–200 ký tự, có chữ và số.
export function passwordError(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 && /\p{L}/u.test(value) && /\d/.test(value)
    ? '' : 'Mật khẩu cần 8–200 ký tự, gồm cả chữ và số.';
}

export function registerErrors(values) {
  const errors = {};
  if (!values.fullName?.trim() || values.fullName.trim().length > 150) errors.fullName = 'Hãy nhập họ và tên (tối đa 150 ký tự).';
  if (!isEmail(values.email?.trim() || '')) errors.email = 'Hãy nhập email hợp lệ.';
  if (values.phone?.trim() && !isPhone(values.phone)) errors.phone = 'Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.';
  const password = passwordError(values.password);
  if (password) errors.password = password;
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  return errors;
}

// Email đăng nhập không sửa ở hồ sơ; ngày sinh dạng YYYY-MM-DD, không ở tương lai.
export function profileErrors(values, today = new Date().toISOString().slice(0, 10)) {
  const errors = {};
  if (!values.fullName?.trim() || values.fullName.trim().length > 150) errors.fullName = 'Họ và tên bắt buộc, tối đa 150 ký tự.';
  if (values.phone?.trim() && !isPhone(values.phone)) errors.phone = 'Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.';
  if (values.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate) || values.birthDate > today || values.birthDate < '1900-01-01')) errors.birthDate = 'Ngày sinh chưa hợp lệ.';
  return errors;
}

export function addressErrors(values) {
  const errors = {};
  for (const [field, label, limit] of [['recipientName', 'Tên người nhận', 150], ['addressLine', 'Địa chỉ cụ thể', 255], ['province', 'Tỉnh / thành phố', 100]]) {
    if (!values[field]?.trim() || values[field].trim().length > limit) errors[field] = `${label} bắt buộc, tối đa ${limit} ký tự.`;
  }
  if (!isPhone(values.phone)) errors.phone = 'Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.';
  for (const field of ['district', 'ward']) if (String(values[field] || '').length > 100) errors[field] = 'Tối đa 100 ký tự.';
  if (typeof values.isDefault !== 'boolean') errors.isDefault = 'Giá trị địa chỉ mặc định chưa hợp lệ.';
  return errors;
}

// Chỉ quay lại đường dẫn nội bộ cùng site sau đăng nhập, không nhận URL ngoài.
export function safeReturnPath(path) {
  return typeof path === 'string' && /^\/(?![/\\])[^\s\\]*$/.test(path) && !path.includes('/../') ? path : '';
}
