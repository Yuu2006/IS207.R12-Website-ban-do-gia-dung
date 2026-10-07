import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';
import { getCustomerOrders, initialOrders } from '../src/services/order-ui-data.js';
import { customerReturnPath, isCustomerUser, parsePreviewSession } from '../src/utils/customer-session.js';

const owner = { id: 'preview:nguyen.minh@example.com', role: 'CUSTOMER', fullName: 'Nguyễn Minh' };
const other = { id: 'preview:khach.khac@example.com', role: 'CUSTOMER', fullName: 'Khách khác' };
const fixtures = initialOrders();
const storage = new Map();
const originalStorage = globalThis.sessionStorage;
const originalFetch = globalThis.fetch;
let vite;
let productionVite;
let Workspace;
let AuthContext;
let authClient;
let productionAuth;
let ServiceContext;
let mockService;
let orderProvider;
let productionOrderProvider;
let productionOrderHook;
let orderHook;
let ApiState;

// Dùng SSR để kiểm tra component thật mà không thêm test runner hoặc trình duyệt vào repo.
before(async () => {
  globalThis.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = { root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' };
  vite = await createServer({ ...config, define: { 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_AUTH_DEMO': '"true"' } });
  Workspace = (await vite.ssrLoadModule('/src/pages/customer/OrderWorkspace.jsx')).default;
  AuthContext = (await vite.ssrLoadModule('/src/context/CustomerAuthContext.jsx')).CustomerAuthContext;
  authClient = await vite.ssrLoadModule('/src/pages/login-form/auth-client.js');
  ServiceContext = (await vite.ssrLoadModule('/src/context/OrderServiceContext.jsx')).OrderServiceContext;
  ({ OrderServiceProvider: orderProvider, useOrderService: orderHook } = await vite.ssrLoadModule('/src/context/OrderServiceContext.jsx'));
  ApiState = (await vite.ssrLoadModule('/src/components/order/OrderApiState.jsx')).default;
  mockService = (await vite.ssrLoadModule('/src/services/order-mock-service.js')).createMockOrderService({ getCustomer: async () => owner, delayMs: 0 });
  productionVite = await createServer({ ...config, define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ORDER_API_MODE': '"mock"' } });
  productionAuth = await productionVite.ssrLoadModule('/src/pages/login-form/auth-client.js');
  ({ OrderServiceProvider: productionOrderProvider, useOrderService: productionOrderHook } = await productionVite.ssrLoadModule('/src/context/OrderServiceContext.jsx'));
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = originalStorage;
  await Promise.all([vite?.close(), productionVite?.close()]);
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

test('return URL keeps own order/detail and rejects external, staff and malformed URLs', () => {
  for (const path of ['/orders', '/orders/HC2026100002', '/orders/HC2026100002?view=tracking#history', '/checkout']) assert.equal(customerReturnPath(path), path);
  for (const path of [undefined, 'https://example.com', '//example.com', '/sales/orders', '/login', '/orders/../sales', '/orders\\example.com', '/orders-malicious']) assert.equal(customerReturnPath(path), '/orders');
});

test('order selection never falls back to all orders for anonymous or another account', () => {
  assert.equal(getCustomerOrders(fixtures, owner.id).length, 4);
  for (const id of [null, undefined, '', other.id]) assert.deepEqual(getCustomerOrders(fixtures, id), []);
  assert.deepEqual(getCustomerOrders([{ id: 'unowned' }, { id: 'own', customerId: 7 }, { id: 'other', customerId: 8 }], '7').map(order => order.id), ['own']);
});

test('preview session rejects malformed, expired and non-preview data', () => {
  const session = { mode: 'preview', user: owner, expiresAt: 1001 };
  assert.deepEqual(parsePreviewSession(JSON.stringify(session), 1000), session);
  for (const value of ['invalid', 'null', JSON.stringify({ ...session, expiresAt: 1000 }), JSON.stringify({ ...session, mode: 'production' }), JSON.stringify({ ...session, user: { ...owner, id: 1 } })]) assert.equal(parsePreviewSession(value, 1000), null);
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
  assert.match(html, /aria-label="Giỏ hàng và thanh toán"/);
  assert.match(html, /aria-label="Mở menu"/);
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

test('development OTP creates account-specific session only after correct verification and supports logout', async () => {
  assert.equal(authClient.isDemoAuth(), true);
  await authClient.signOutCustomer();
  assert.equal(await authClient.getCustomerSession(), null);
  const challenge = await authClient.requestCustomerOtp({ flow: 'login', contact: 'NGUYEN.MINH@example.com' });
  await assert.rejects(authClient.verifyCustomerOtp({ challengeId: challenge.challengeId, code: 'wrong' }));
  assert.equal(await authClient.getCustomerSession(), null);
  await authClient.verifyCustomerOtp({ challengeId: challenge.challengeId, code: challenge.previewCode });
  assert.equal((await authClient.getCustomerSession()).user.id, owner.id);
  assert.equal(getCustomerOrders(fixtures, (await authClient.getCustomerSession()).user.id).length, 4);
  await assert.rejects(authClient.verifyCustomerOtp({ challengeId: challenge.challengeId, code: challenge.previewCode }));
  await authClient.signOutCustomer();
  assert.equal(await authClient.getCustomerSession(), null);
  assert.equal(storage.size, 0);
  const next = await authClient.requestCustomerOtp({ flow: 'register', contact: 'khach.khac@example.com', fullName: 'Khách khác' });
  await authClient.verifyCustomerOtp({ challengeId: next.challengeId, code: next.previewCode });
  assert.deepEqual(getCustomerOrders(fixtures, (await authClient.getCustomerSession()).user.id), []);
  await authClient.signOutCustomer();
});

test('production ignores preview storage and accepts only a server-confirmed CUSTOMER session', async () => {
  assert.equal(productionAuth.isDemoAuth(), false);
  storage.set('homecare:preview-customer-session', JSON.stringify({ mode: 'preview', user: owner, expiresAt: Date.now() + 60000 }));
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  assert.equal(await productionAuth.getCustomerSession(), null);
  for (const body of [{ success: true }, { success: true, sessionEstablished: true, user: { id: 1, role: 'SALES' } }]) {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(productionAuth.getCustomerSession());
  }
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/auth\/customer\/session$/);
    assert.equal(options.credentials, 'include');
    return Response.json({ success: true, sessionEstablished: true, user: { id: 7, role: 'CUSTOMER', fullName: 'Khách thật' } });
  };
  assert.equal((await productionAuth.getCustomerSession()).user.id, 7);
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(productionAuth.getCustomerSession());
  globalThis.fetch = originalFetch;
  storage.clear();
});

test('development provider uses mock but production forces HTTP even when env requests mock', () => {
  function DevMode() { return createElement('span', null, orderHook().mode); }
  function ProductionMode() { return createElement('span', null, productionOrderHook().mode); }
  assert.equal(renderToStaticMarkup(createElement(orderProvider, null, createElement(DevMode))), '<span>mock</span>');
  assert.equal(renderToStaticMarkup(createElement(productionOrderProvider, null, createElement(ProductionMode))), '<span>http</span>');
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
