// Dữ liệu thử nghiệm chỉ lưu trong trình duyệt, không phải cơ chế xác thực thật.
export const demoAccounts = [
  { id: 'demo-customer', fullName: 'Nguyễn Minh', email: 'customer@example.test', phone: '0901234567', role: 'CUSTOMER' },
  { id: 'demo-admin', fullName: 'Quản trị viên demo', email: 'admin@example.test', phone: '', role: 'ADMIN' },
  { id: 'demo-sales', fullName: 'Nhân viên bán hàng demo', email: 'sales@example.test', phone: '', role: 'SALES' },
  { id: 'demo-warehouse', fullName: 'Nhân viên kho demo', email: 'warehouse@example.test', phone: '', role: 'WAREHOUSE' },
];
export const demoPassword = 'Demo@1234567890!';
const DATA_KEY = 'homecare.demo.users.v1';
const SESSION_KEY = 'homecare.demo.session.v1';
const CHALLENGE_KEY = 'homecare.demo.challenge.v1';
const roles = demoAccounts.map(user => user.role);

// Gắn lỗi theo trường vào Error để form và API adapter xử lý cùng một kiểu.
function fail(message, status = 422, errors = {}) {
  throw Object.assign(new Error(message), { status, errors });
}

// Mock nhận cùng whitelist/type với API, tránh che lỗi contract trong lúc dựng UI.
function onlyFields(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(field => !fields.includes(field))) fail('Request có trường không được phép.');
}

// Merge trường PATCH còn thiếu, kiểm tra kiểu trước khi chuẩn hóa khoảng trắng.
function textInput(input, field, current = '') {
  const value = input[field] === undefined ? current : input[field];
  if (typeof value !== 'string') fail('Giá trị phải là chuỗi.', 422, { [field]: 'Giá trị phải là chuỗi.' });
  return value.trim();
}

function read(key, storage = localStorage) {
  try { return JSON.parse(storage.getItem(key) || 'null'); }
  catch { fail('Dữ liệu demo bị lỗi. Hãy xóa dữ liệu demo của trang trong trình duyệt.', 500); }
}

function write(key, value, storage = localStorage) {
  try { storage.setItem(key, JSON.stringify(value)); }
  catch { fail('Không thể lưu dữ liệu demo trong trình duyệt.', 500); }
}

function database() {
  return read(DATA_KEY) || { users: demoAccounts.map(user => ({ ...user })), addresses: [] };
}

// Chuẩn hóa email/số điện thoại cho việc đăng nhập và kiểm tra liên hệ trùng.
export function normalizeContact(value) {
  const contact = String(value ?? '').trim();
  return contact.includes('@') ? contact.toLowerCase() : contact.replace(/[\s.\-]/g, '').replace(/^\+84/, '0');
}

// Giữ tên/email/điện thoại theo contract hồ sơ; không cho thay ID hoặc role.
export function profileErrors(values) {
  const errors = {};
  if (!values.fullName?.trim() || values.fullName.trim().length > 150) errors.fullName = 'Họ và tên bắt buộc, tối đa 150 ký tự.';
  if (values.email && (values.email.trim().length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))) errors.email = 'Email chưa hợp lệ hoặc vượt quá 255 ký tự.';
  if (values.phone && !/^0\d{9}$/.test(normalizeContact(values.phone))) errors.phone = 'Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.';
  if (!values.email?.trim() && !values.phone?.trim()) errors.email = 'Cần ít nhất email hoặc số điện thoại.';
  return errors;
}

export function addressErrors(values) {
  const errors = {};
  for (const [field, label, limit] of [['recipientName', 'Tên người nhận', 150], ['addressLine', 'Địa chỉ cụ thể', 255], ['province', 'Tỉnh / thành phố', 100]]) {
    if (!values[field]?.trim() || values[field].trim().length > limit) errors[field] = `${label} bắt buộc, tối đa ${limit} ký tự.`;
  }
  if (!/^0\d{9}$/.test(normalizeContact(values.phone))) errors.phone = 'Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.';
  for (const field of ['district', 'ward']) if (String(values[field] || '').length > 100) errors[field] = 'Tối đa 100 ký tự.';
  if (typeof values.isDefault !== 'boolean') errors.isDefault = 'Giá trị địa chỉ mặc định chưa hợp lệ.';
  return errors;
}

function validate(errors) {
  if (Object.keys(errors).length) fail('Hãy kiểm tra thông tin đã nhập.', 422, errors);
}

// Phiên demo hết hạn sau một giờ và chỉ tồn tại trong tab trình duyệt.
export async function getDemoSession() {
  const session = read(SESSION_KEY, sessionStorage);
  const user = session && database().users.find(item => item.id === session.userId);
  if (!user || session.expiresAt <= Date.now() || !roles.includes(user.role)) {
    sessionStorage.removeItem(SESSION_KEY);
    return { user: null, expiresAt: null, demo: true };
  }
  return { user: { ...user }, expiresAt: session.expiresAt, demo: true };
}

async function principal(customerOnly = false) {
  const session = await getDemoSession();
  if (!session.user) fail('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 401);
  if (customerOnly && session.user.role !== 'CUSTOMER') fail('Bạn không có quyền quản lý địa chỉ khách hàng.', 403);
  return session.user;
}

async function establish(user) {
  write(SESSION_KEY, { userId: user.id, expiresAt: Date.now() + 60 * 60 * 1000 }, sessionStorage);
  return getDemoSession();
}

export async function loginDemoStaff(input) {
  onlyFields(input, ['identifier', 'password']);
  const identifier = textInput(input, 'identifier');
  const password = input.password;
  if (typeof password !== 'string' || !password || new TextEncoder().encode(password).length > 200) fail('Mật khẩu bắt buộc, tối đa 200 byte.', 422, { password: 'Mật khẩu chưa hợp lệ.' });
  const user = database().users.find(item => item.email === normalizeContact(identifier) && item.role !== 'CUSTOMER');
  if (!user || password !== demoPassword) fail('Tài khoản hoặc mật khẩu chưa đúng.', 401);
  return establish(user);
}

// Mock OTP giữ cooldown, giới hạn thử, dữ liệu đăng ký và vô hiệu hóa mã đã dùng.
export async function requestDemoOtp(input) {
  onlyFields(input, ['flow', 'contact', 'fullName']);
  const flow = input.flow;
  const contact = normalizeContact(textInput(input, 'contact'));
  const fullName = flow === 'register' ? textInput(input, 'fullName') : undefined;
  if (!['login', 'register'].includes(flow)) fail('Luồng xác thực chưa hợp lệ.');
  validate(profileErrors({ fullName: flow === 'register' ? fullName : 'Demo', email: contact.includes('@') ? contact : '', phone: contact.includes('@') ? '' : contact }));
  const data = database();
  const existing = data.users.find(user => user.email === contact || user.phone === contact);
  if (flow === 'login' && (!existing || existing.role !== 'CUSTOMER')) fail('Chưa có tài khoản khách hàng này. Hãy đăng ký hoặc dùng tài khoản demo.', 404);
  if (flow === 'register' && existing) fail('Email hoặc số điện thoại đã được đăng ký.', 409);
  const previous = read(CHALLENGE_KEY, sessionStorage);
  if (previous && previous.createdAt + 30000 > Date.now()) fail('Hãy chờ 30 giây trước khi yêu cầu mã mới.', 429);
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  const challenge = { challengeId: crypto.randomUUID(), code: String(bytes[0] % 1000000).padStart(6, '0'), flow, contact, fullName: fullName?.trim(), createdAt: Date.now(), expiresAt: Date.now() + 300000, attempts: 0 };
  write(CHALLENGE_KEY, challenge, sessionStorage);
  return { challengeId: challenge.challengeId, previewCode: challenge.code, retryAfterSeconds: 30, expiresInSeconds: 300, demo: true };
}

export async function verifyDemoOtp(input) {
  onlyFields(input, ['challengeId', 'code']);
  const challengeId = textInput(input, 'challengeId');
  const code = textInput(input, 'code');
  if (!/^\d{6}$/.test(code)) fail('Mã xác nhận cần có 6 chữ số.');
  const challenge = read(CHALLENGE_KEY, sessionStorage);
  if (!challenge || challenge.challengeId !== challengeId || challenge.expiresAt <= Date.now()) fail('Mã xác nhận đã hết hạn hoặc không còn hiệu lực.');
  challenge.attempts += 1;
  write(CHALLENGE_KEY, challenge, sessionStorage);
  if (challenge.attempts > 5) { sessionStorage.removeItem(CHALLENGE_KEY); fail('Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.'); }
  if (challenge.code !== code) fail('Mã xác nhận chưa đúng.');
  const data = database();
  let user = data.users.find(item => item.email === challenge.contact || item.phone === challenge.contact);
  if (challenge.flow === 'register') {
    if (user) fail('Thông tin liên hệ đã được đăng ký.', 409);
    user = { id: crypto.randomUUID(), fullName: challenge.fullName, email: challenge.contact.includes('@') ? challenge.contact : '', phone: challenge.contact.includes('@') ? '' : challenge.contact, role: 'CUSTOMER' };
    data.users.push(user);
    write(DATA_KEY, data);
  }
  if (!user || user.role !== 'CUSTOMER') fail('Tài khoản không còn khả dụng.', 401);
  sessionStorage.removeItem(CHALLENGE_KEY);
  return establish(user);
}

export async function logoutDemo() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(CHALLENGE_KEY);
}

export async function getDemoProfile() { return principal(); }

export async function updateDemoProfile(input) {
  const user = await principal();
  onlyFields(input, ['fullName', 'email', 'phone']);
  const data = database();
  const values = { fullName: textInput(input, 'fullName', user.fullName), email: normalizeContact(textInput(input, 'email', user.email)), phone: normalizeContact(textInput(input, 'phone', user.phone)) };
  validate(profileErrors(values));
  if (data.users.some(item => item.id !== user.id && ((values.email && item.email === values.email) || (values.phone && item.phone === values.phone)))) fail('Email hoặc số điện thoại đã được sử dụng.', 409);
  const updated = { ...user, ...values };
  data.users = data.users.map(item => item.id === user.id ? updated : item);
  write(DATA_KEY, data);
  return { ...updated };
}

export async function listDemoAddresses() {
  const user = await principal(true);
  return database().addresses.filter(item => item.userId === user.id && !item.isDeleted).map(({ userId, isDeleted, ...address }) => address);
}

// Mọi thao tác đều tìm địa chỉ bằng cả ID và chủ sở hữu của phiên hiện tại.
export async function saveDemoAddress(id, input) {
  const user = await principal(true);
  onlyFields(input, ['recipientName', 'phone', 'addressLine', 'province', 'district', 'ward', 'isDefault']);
  const data = database();
  const own = data.addresses.filter(item => item.userId === user.id && !item.isDeleted);
  const current = id ? own.find(item => item.id === id) : null;
  if (id && !current) fail('Không tìm thấy địa chỉ.', 404);
  const values = Object.fromEntries(['recipientName', 'phone', 'addressLine', 'province', 'district', 'ward'].map(field => [field, field === 'phone' ? normalizeContact(textInput(input, field, current?.[field])) : textInput(input, field, current?.[field])]));
  values.isDefault = input.isDefault === undefined ? current?.isDefault ?? false : input.isDefault;
  validate(addressErrors(values));
  if (current?.isDefault && !values.isDefault) fail('Hãy chọn địa chỉ khác làm mặc định trước.', 422, { isDefault: 'Cần giữ một địa chỉ mặc định.' });
  if (!own.length) values.isDefault = true;
  if (values.isDefault) data.addresses.forEach(item => { if (item.userId === user.id) item.isDefault = false; });
  const address = { ...values, id: id || crypto.randomUUID(), userId: user.id, isDeleted: false };
  if (id) data.addresses = data.addresses.map(item => item.id === id && item.userId === user.id ? address : item);
  else data.addresses.push(address);
  write(DATA_KEY, data);
  return listDemoAddresses();
}

export async function deleteDemoAddress(id) {
  const user = await principal(true);
  const data = database();
  const address = data.addresses.find(item => item.id === id && item.userId === user.id && !item.isDeleted);
  if (!address) fail('Không tìm thấy địa chỉ.', 404);
  address.isDeleted = true;
  if (address.isDefault) {
    address.isDefault = false;
    const replacement = data.addresses.find(item => item.userId === user.id && !item.isDeleted);
    if (replacement) replacement.isDefault = true;
  }
  write(DATA_KEY, data);
  return listDemoAddresses();
}
