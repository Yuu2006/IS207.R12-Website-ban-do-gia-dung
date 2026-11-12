import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';
import { getCustomerOrders, initialOrders } from '../src/services/order-ui-data.js';
import { customerReturnPath, isCustomerUser } from '../src/utils/customer-session.js';

const owner = { id: 'preview:nguyen.minh@example.com', role: 'CUSTOMER', fullName: 'Nguyễn Minh' };
const other = { id: 'preview:khach.khac@example.com', role: 'CUSTOMER', fullName: 'Khách khác' };
const fixtures = initialOrders();
const storage = new Map();
const originalStorage = globalThis.sessionStorage;
const originalFetch = globalThis.fetch;
let vite;
let productionVite;
let defaultVite;
let Workspace;
let AuthContext;
let SharedAuthContext;
let ServiceContext;
let mockService;
let orderProvider;
let productionOrderProvider;
let productionOrderHook;
let orderHook;
let ApiState;
let AppRoutes;
let SharedAuthProvider;
let defaultOrderProvider;
let defaultOrderHook;

// Dùng SSR để kiểm tra component thật mà không thêm test runner hoặc trình duyệt vào repo.
before(async () => {
  globalThis.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = { root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' };
  vite = await createServer({ ...config, define: { 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_AUTH_DEMO': '"true"', 'import.meta.env.VITE_ORDER_API_MODE': '"mock"' } });
  Workspace = (await vite.ssrLoadModule('/src/pages/customer/OrderWorkspace.jsx')).default;
  AuthContext = (await vite.ssrLoadModule('/src/context/CustomerAuthContext.jsx')).CustomerAuthContext;
  SharedAuthContext = (await vite.ssrLoadModule('/src/context/auth-context.js')).AuthContext;
  SharedAuthProvider = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).AuthProvider;
  ServiceContext = (await vite.ssrLoadModule('/src/context/OrderServiceContext.jsx')).OrderServiceContext;
  ({ OrderServiceProvider: orderProvider, useOrderService: orderHook } = await vite.ssrLoadModule('/src/context/OrderServiceContext.jsx'));
  ApiState = (await vite.ssrLoadModule('/src/components/order/OrderApiState.jsx')).default;
  AppRoutes = (await vite.ssrLoadModule('/src/routes/AppRoutes.jsx')).default;
  mockService = (await vite.ssrLoadModule('/src/services/order-mock-service.js')).createMockOrderService({ getCustomer: async () => owner, delayMs: 0 });
  productionVite = await createServer({ ...config, define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ORDER_API_MODE': '"mock"' } });
  ({ OrderServiceProvider: productionOrderProvider, useOrderService: productionOrderHook } = await productionVite.ssrLoadModule('/src/context/OrderServiceContext.jsx'));
  defaultVite = await createServer({ ...config, define: { 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_ORDER_API_MODE': 'undefined' } });
  ({ OrderServiceProvider: defaultOrderProvider, useOrderService: defaultOrderHook } = await defaultVite.ssrLoadModule('/src/context/OrderServiceContext.jsx'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = originalStorage;
  await Promise.all([vite?.close(), productionVite?.close(), defaultVite?.close()]);
});

function renderWorkspace(path, user = owner, status = 'authenticated') {
  const value = { user, status, error: 'Mất kết nối', refreshSession: async () => null, signOut: async () => {} };
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(AuthContext.Provider, { value }, createElement(ServiceContext.Provider, { value: mockService }, createElement(Routes, null,
      createElement(Route, { path: '/orders', element: createElement(Workspace, { orders: fixtures, setOrders() {}, cart: [], setCart() {} }) }),
      createElement(Route, { path: '/orders/:orderId', element: createElement(Workspace, { orders: fixtures, setOrders() {}, cart: [], setCart() {} }) }),
      createElement(Route, { path: '/checkout', element: createElement(Workspace, { orders: fixtures, setOrders() {}, cart: [], setCart() {} }) }),
      createElement(Route, { path: '/sales/orders', element: createElement(Workspace, { orders: fixtures, setOrders() {}, cart: [], setCart() {} }) }),
    )))));
}

test('customer identity rejects missing ID, invalid ID and staff roles', () => {
  assert.equal(isCustomerUser(owner), true);
  assert.equal(isCustomerUser({ id: 1, role: 'CUSTOMER' }), true);
  for (const user of [null, {}, { ...owner, id: '' }, { ...owner, id: 0 }, { ...owner, id: {} }, { ...owner, role: 'SALES' }]) {
    assert.equal(isCustomerUser(user), false);
  }
});

test('return action is visible only on delivered paid owner detail, not shipping/pending/list', () => {
  assert.match(renderWorkspace('/orders/HC2026100001'), /Yêu cầu trả hàng/);
  for (const path of ['/orders', '/orders/HC2026100002', '/orders/HC2026100003']) assert.doesNotMatch(renderWorkspace(path), /Yêu cầu trả hàng/);
  assert.doesNotMatch(renderWorkspace('/orders/HC2026100001', other), /Yêu cầu trả hàng/);
});

test('return URL keeps own order/detail and rejects external, staff and malformed URLs', () => {
  for (const path of ['/orders', '/orders/HC2026100002', '/orders/HC2026100002?view=tracking#history', '/checkout']) assert.equal(customerReturnPath(path), path);
  for (const path of [undefined, 'https://example.com', '//example.com', '/sales/orders', '/login', '/orders/../sales', '/orders\\example.com', '/orders-malicious']) assert.equal(customerReturnPath(path), '/orders');
});

test('order selection never falls back to all orders for anonymous or another account', () => {
  assert.equal(getCustomerOrders(fixtures, owner.id).length, 4);
  for (const id of [null, undefined, '', other.id]) assert.deepEqual(getCustomerOrders(fixtures, id), []);
  assert.deepEqual(getCustomerOrders([{ id: 'unowned' }, { id: 'own', customerId: 7 }, { id: 'other', customerId: 8 }], '7').map(order => order.id), ['own']);
});

test('anonymous, loading, invalid identity and session errors do not render any order', () => {
  for (const [user, status] of [[null, 'anonymous'], [null, 'loading'], [null, 'error'], [{ ...owner, role: 'SALES' }, 'authenticated']]) {
    const html = renderWorkspace('/orders', user, status);
    assert.doesNotMatch(html, /HC2026100001|HC2026100002|090 123 4567/);
    assert.doesNotMatch(html, /class="oc-order-card"/);
  }
  assert.match(renderWorkspace('/orders', null, 'error'), /Chưa thể tải đơn hàng|Thử lại/);
});

test('customer page uses storefront header/footer with status tabs and no workspace tabs', () => {
  const html = renderWorkspace('/orders');
  assert.match(html, /Đơn hàng của tôi/);
  assert.match(html, /Trang chủ/);
  assert.match(html, /cskh@homecare.vn/);
  assert.match(html, /Chờ xác nhận/);
  assert.match(html, /Đang giao/);
  assert.equal((html.match(/class="oc-card oc-order-card"/g) || []).length, 4);
  assert.doesNotMatch(html, /oc-nav-indicator|oc-announcement|Không gian nhân viên|href="\/sales\/orders"/);
  assert.doesNotMatch(html, />Thanh toán<\/a>/);
  assert.match(html, /aria-label="Giỏ hàng"[^>]*href="\/cart"/);
  assert.match(html, /href="\/wishlist"/);
  assert.match(html, /aria-label="Mở menu"/);
});

test('warranty route renders a real public page with working navigation, not a 404 or repair form', () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/warranty'] },
    createElement(SharedAuthContext.Provider, { value: { user: null, loading: false, error: '' } },
      // App.jsx always mounts OrderServiceProvider above the routes; the public chatbot uses it for "Thêm giỏ".
      createElement(orderProvider, null, createElement(AppRoutes)))));
  assert.match(html, /Thông tin bảo hành/);
  assert.match(html, /href="\/orders"/);
  assert.match(html, /href="\/products"/);
  assert.match(html, /id="prepare"/);
  assert.match(html, /cskh@homecare.vn/);
  assert.doesNotMatch(html, /Không tìm thấy trang|Bảo hành &amp; Sửa chữa|Yêu cầu sửa chữa|Đặt lịch kỹ thuật viên|<form/);
  assert.doesNotMatch(html, /href="#(?:repair|technician|tracking|register-warranty|warranty|history)"/);
});

test('session failure is identified before order loading and never reveals customer data', () => {
  const html = renderWorkspace('/orders', null, 'error');
  assert.match(html, /Chưa thể kiểm tra đăng nhập/);
  assert.match(html, /Đơn hàng chỉ hiển thị sau khi xác minh tài khoản/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /Thử lại/);
  assert.doesNotMatch(html, /HC2026100001|Hành trình đơn hàng|class="oc-order-card"/);
});

test('another account sees empty state, not the fixture customer or order IDs', () => {
  const html = renderWorkspace('/orders', other);
  assert.match(html, /Bạn chưa có đơn hàng/);
  assert.match(html, /Khám phá sản phẩm/);
  assert.doesNotMatch(html, /HC2026|Nguyễn Minh|090 123 4567/);
});

test('detail route displays owner timeline but hides foreign/unknown order details', () => {
  const own = renderWorkspace('/orders/HC2026100002');
  assert.match(own, /Hành trình đơn hàng/);
  assert.match(own, /Nguyễn Minh/);
  assert.match(own, /Đang giao/);
  for (const html of [renderWorkspace('/orders/HC2026100002', other), renderWorkspace('/orders/not-found')]) {
    assert.match(html, /Đang tải dữ liệu/);
    assert.doesNotMatch(html, /090 123 4567|Hành trình đơn hàng|Thông tin giao hàng/);
  }
});

test('checkout and staff processing remain separate routes', () => {
  assert.match(renderWorkspace('/checkout'), /Giỏ hàng của bạn đang trống/);
  const staff = renderWorkspace('/sales/orders');
  assert.match(staff, /Xử lý đơn hàng/);
  assert.match(staff, /Không gian nhân viên/);
  assert.doesNotMatch(staff, /Đơn hàng của tôi/);
});

// Ứng dụng thật chỉ có AuthProvider; CustomerAuthContext là adapter, không phải phiên khách riêng.
test('order pages read the shared AuthProvider session through the adapter', () => {
  const render = auth => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/orders'] },
    createElement(SharedAuthContext.Provider, { value: auth }, createElement(ServiceContext.Provider, { value: mockService },
      createElement(Routes, null, createElement(Route, { path: '/orders', element: createElement(Workspace, { orders: fixtures }) }))))));
  assert.equal((render({ user: owner, loading: false, error: '', refreshSession: async () => null, signOut: async () => {} }).match(/class="oc-card oc-order-card"/g) || []).length, 4);
  assert.match(render({ user: null, loading: true, error: '' }), /Đang kiểm tra đăng nhập/);
  assert.doesNotMatch(render({ user: { ...owner, role: 'SALES' }, loading: false, error: '' }), /HC2026100001/);
});

test('development provider uses mock but production forces HTTP even when env requests mock', () => {
  function DevMode() { return createElement('span', null, orderHook().mode); }
  function ProductionMode() { return createElement('span', null, productionOrderHook().mode); }
  assert.equal(renderToStaticMarkup(createElement(orderProvider, null, createElement(DevMode))), '<span>mock</span>');
  assert.equal(renderToStaticMarkup(createElement(productionOrderProvider, null, createElement(ProductionMode))), '<span>http</span>');
});

test('development defaults to real HTTP when no mock flag is configured', () => {
  function DefaultMode() { return createElement('span', null, defaultOrderHook().mode); }
  assert.equal(renderToStaticMarkup(createElement(defaultOrderProvider, null, createElement(DefaultMode))), '<span>http</span>');
});

test('session retry coalesces repeated clicks and releases the request after a network failure', async () => {
  const { useAuth } = await vite.ssrLoadModule('/src/context/auth-context.js');
  let auth;
  let release;
  let calls = 0;
  function Probe() { auth = useAuth(); return null; }
  renderToStaticMarkup(createElement(SharedAuthProvider, null, createElement(Probe)));
  const savedFetch = globalThis.fetch;
  globalThis.fetch = () => { calls++; return new Promise((resolve, reject) => { release = { resolve, reject }; }); };
  try {
    const first = auth.refreshSession();
    const repeated = auth.refreshSession();
    assert.equal(calls, 1);
    const failures = Promise.all([assert.rejects(first, /Không thể kết nối/), assert.rejects(repeated, /Không thể kết nối/)]);
    release.reject(new Error('Network unavailable'));
    await failures;
    const retry = auth.refreshSession();
    assert.equal(calls, 2);
    release.resolve(new Response(JSON.stringify({ success: true, data: { user: null, expiresAt: null, csrfToken: 'test-token' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    assert.equal((await retry).user, null);
  } finally { globalThis.fetch = savedFetch; }
});

test('cart and payment return retain a safe login return path', () => {
  assert.equal(customerReturnPath('/cart'), '/cart');
  assert.equal(customerReturnPath('/payment/result?vnp_TxnRef=VNPAY-HC123'), '/payment/result?vnp_TxnRef=VNPAY-HC123');
  assert.equal(customerReturnPath('//example.com/payment/result'), '/orders');
});

test('unseeded orders render loading, not empty or sample customer data', () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/orders'] },
    createElement(AuthContext.Provider, { value: { user: owner, status: 'authenticated' } },
      createElement(ServiceContext.Provider, { value: mockService },
        createElement(Routes, null, createElement(Route, { path: '/orders', element: createElement(Workspace) }))))));
  assert.match(html, /Đang tải dữ liệu/);
  assert.doesNotMatch(html, /Bạn chưa có đơn hàng|HC2026100001|090 123 4567/);
});

test('API loading/error are visible; 401 links customer and sales to their own login', () => {
  const render = (path, props) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ApiState, props)));
  assert.match(render('/orders', { loading: true }), /role="status"/);
  assert.match(render('/orders', { error: { status: 503, message: 'Mất kết nối' }, retry() {} }), /role="alert"|Thử lại/);
  assert.match(render('/orders', { error: { status: 401, message: 'Hết phiên' } }), /href="\/login"/);
  assert.match(render('/sales/orders', { error: { status: 401, message: 'Hết phiên' } }), /href="\/internal\/login"/);
});
