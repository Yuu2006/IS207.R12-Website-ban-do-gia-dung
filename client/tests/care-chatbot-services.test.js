import test from 'node:test';
import assert from 'node:assert/strict';
import { careService } from '../src/services/care-service.js';
import { searchChatbotCatalog } from '../src/services/chatbot-service.js';

test('care and chatbot services use the API contract and preserve server errors', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(String(url));
    calls.push({ url: parsedUrl, options });
    if (parsedUrl.pathname.endsWith('/auth/me')) {
      return new Response(JSON.stringify({ success: true, data: { csrfToken: 'care-test-csrf' } }), { status: 200 });
    }
    if (parsedUrl.pathname.endsWith('/care-tasks/42/complete')) {
      return new Response(JSON.stringify({ success: false, message: 'Thiết bị đã lưu trữ.', errors: { code: 'DEVICE_ARCHIVED' } }), { status: 409 });
    }
    return new Response(JSON.stringify({ success: true, data: { items: [], checkedAt: '2026-11-08T00:00:00Z' } }), { status: 200 });
  };

  try {
    await careService.listDevices({ status: 'ARCHIVED', page: 2, pageSize: 10 });
    const listing = calls.find(call => call.url.pathname.endsWith('/api/owned-devices'));
    assert.equal(listing.url.searchParams.get('status'), 'ARCHIVED');
    assert.equal(listing.url.searchParams.get('page'), '2');
    assert.equal(listing.url.searchParams.get('pageSize'), '10');

    await careService.postponeTask('41', { newDueDate: '2026-12-01', reason: 'Bận lịch' });
    const postpone = calls.find(call => call.url.pathname.endsWith('/care-tasks/41/postpone'));
    assert.equal(postpone.options.method, 'POST');
    assert.deepEqual(JSON.parse(postpone.options.body), { newDueDate: '2026-12-01', reason: 'Bận lịch' });
    assert.equal(postpone.options.headers['X-CSRF-Token'], 'care-test-csrf');

    await assert.rejects(careService.completeTask('42'), error => error.status === 409 && error.message === 'Thiết bị đã lưu trữ.');

    const catalog = await searchChatbotCatalog('máy giặt LG', { limit: 4, categoryId: '7' });
    assert.equal(catalog.items.length, 0);
    const search = calls.find(call => call.url.pathname.endsWith('/api/chatbot/catalog-search'));
    assert.deepEqual(Object.fromEntries(search.url.searchParams), { q: 'máy giặt LG', limit: '4', categoryId: '7' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
