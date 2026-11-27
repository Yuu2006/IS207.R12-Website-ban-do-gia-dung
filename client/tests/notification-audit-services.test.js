import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
let vite;
let notificationService;
let auditService;
let adminUserService;
let NotificationsPage;
let AuditLogPage;
let UserAdminPage;
let Header;
let loginPathFor;
let CustomerAuthContext;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

before(async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  notificationService = await vite.ssrLoadModule('/src/services/notification-service.js');
  auditService = await vite.ssrLoadModule('/src/services/audit-service.js');
  adminUserService = await vite.ssrLoadModule('/src/services/admin-user-service.js');
  NotificationsPage = (await vite.ssrLoadModule('/src/pages/customer/NotificationsPage.jsx')).default;
  AuditLogPage = (await vite.ssrLoadModule('/src/pages/admin/AuditLogPage.jsx')).default;
  UserAdminPage = (await vite.ssrLoadModule('/src/pages/admin/UserAdminPage.jsx')).default;
  Header = (await vite.ssrLoadModule('/src/components/Header.jsx')).default;
  ({ loginPathFor } = await vite.ssrLoadModule('/src/routes/ProtectedRoute.jsx'));
  CustomerAuthContext = (await vite.ssrLoadModule('/src/context/CustomerAuthContext.jsx')).CustomerAuthContext;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

test('notification service encodes query, validates response contract and sends CSRF on writes', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
    if (String(url).endsWith('/auth/me')) {
      return jsonResponse({ success: true, data: { user: { id: '7', role: 'CUSTOMER' }, csrfToken: 'csrf-token-1' } });
    }
    if (String(url).includes('/notifications?')) {
      return jsonResponse({
        success: true,
        data: {
          items: [{ id: '42', type: 'ORDER', title: 'Cập nhật đơn', message: 'Đang giao', targetUrl: '/orders/9', readAt: null, createdAt: '2026-11-20 09:00:00' }],
          unreadCount: 1,
          pagination: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
        },
      });
    }
    if (String(url).endsWith('/notifications/42/read')) {
      return jsonResponse({ success: true, data: { id: '42', readAt: '2026-11-20 09:05:00' } });
    }
    if (String(url).endsWith('/notifications/read-all')) {
      return jsonResponse({ success: true, data: { updatedCount: 1 } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const inbox = await notificationService.getNotifications({ page: 2, pageSize: 10, unreadOnly: true });
  assert.equal(inbox.unreadCount, 1);
  assert.equal(inbox.items[0].targetUrl, '/orders/9');
  assert.match(calls[0].url, /\/notifications\?page=2&pageSize=10&unreadOnly=true$/);

  const read = await notificationService.markNotificationRead('42');
  assert.equal(read.id, '42');
  const patchCall = calls.find(entry => entry.method === 'PATCH');
  assert.equal(patchCall.headers['X-CSRF-Token'], 'csrf-token-1');

  const readAll = await notificationService.markAllNotificationsRead();
  assert.equal(readAll.updatedCount, 1);

  globalThis.fetch = async () => jsonResponse({ success: true, data: { items: 'bad' } });
  await assert.rejects(() => notificationService.getNotifications(), /hợp đồng API/);
});

test('audit service encodes only allowlisted non-empty filters and rejects malformed payloads', async () => {
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return jsonResponse({
      success: true,
      data: {
        items: [{ id: '1', actorId: '4', actorName: 'Admin', actorRole: 'ADMIN', action: 'USER_DISABLE', entityType: 'user', entityId: '9', details: { reason: 'Test' }, createdAt: '2026-11-20 09:00:00' }],
        pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      },
    });
  };

  const page = await auditService.getAuditLogs({ action: 'USER_DISABLE', entityType: 'user', actorId: '', ignored: 'x', page: 1, pageSize: 25 });
  assert.equal(page.items.length, 1);
  assert.match(urls[0], /\/admin\/audit-logs\?action=USER_DISABLE&entityType=user&page=1&pageSize=25$/);

  globalThis.fetch = async () => jsonResponse({ success: true, data: { items: [] } });
  await assert.rejects(() => auditService.getAuditLogs(), /hợp đồng API/);
});

test('admin user service forwards filters and status mutation payloads through shared session client', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body });
    if (String(url).endsWith('/auth/me')) {
      return jsonResponse({ success: true, data: { user: { id: '4', role: 'ADMIN' }, csrfToken: 'csrf-admin' } });
    }
    return jsonResponse({ success: true, data: { items: [], pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 } } });
  };

  await adminUserService.listManagedUsers({ q: 'lan', role: 'CUSTOMER', status: '', page: 1, perPage: 10 });
  assert.match(calls[0].url, /\/admin\/users\?q=lan&role=CUSTOMER&page=1&perPage=10$/);

  await adminUserService.setManagedUserStatus('9', 'DISABLED', 'Vi phạm chính sách');
  const patch = calls.find(entry => entry.method === 'PATCH');
  assert.match(patch.url, /\/admin\/users\/9\/status$/);
  assert.deepEqual(JSON.parse(patch.body), { status: 'DISABLED', reason: 'Vi phạm chính sách' });
});

test('notification, audit, user pages and storefront header render valid button classes and accessibility elements', () => {
  const notificationsHtml = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(NotificationsPage)));
  assert.match(notificationsHtml, /hc-button hc-button--outline/);
  assert.doesNotMatch(notificationsHtml, /hc-button--secondary|hc-button--primary/);

  const auditHtml = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AuditLogPage)));
  assert.match(auditHtml, /hc-button--outline/);
  assert.match(auditHtml, /id="hc-audit-actions"/);
  assert.match(auditHtml, /CATALOG_PRODUCT_ATTRIBUTES_UPDATED/);
  assert.match(auditHtml, /CARE_RULE_CREATED/);
  assert.doesNotMatch(auditHtml, /hc-button--secondary|hc-button--primary/);

  const userAdminHtml = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(UserAdminPage)));
  assert.match(userAdminHtml, /Quản lý tài khoản và bốn vai trò cố định/);

  const signedInHeader = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(CustomerAuthContext.Provider, { value: { user: { id: '7', role: 'CUSTOMER', fullName: 'Minh' }, signOut: async () => {} } },
      createElement(Header))));
  assert.match(signedInHeader, /href="\/notifications"/);

  const guestHeader = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(CustomerAuthContext.Provider, { value: { user: null, signOut: async () => {} } },
      createElement(Header))));
  assert.doesNotMatch(guestHeader, /href="\/notifications"/);

  assert.equal(loginPathFor(undefined, '/admin/audit-logs'), '/internal/login');
  assert.equal(loginPathFor(undefined, '/admin/users'), '/internal/login');
  assert.equal(loginPathFor(undefined, '/sales/returns'), '/internal/login');
  assert.equal(loginPathFor(undefined, '/warehouse/returns'), '/internal/login');
  assert.equal(loginPathFor(['ADMIN'], '/notifications'), '/internal/login');
  assert.equal(loginPathFor(undefined, '/notifications'), '/login');
  assert.equal(loginPathFor(['CUSTOMER'], '/orders'), '/login');
});
