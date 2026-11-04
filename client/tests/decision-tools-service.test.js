import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTco } from '../src/services/decision-tools-service.js';

test('TCO service sends the request to the API and surfaces API failures', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/me')) {
      return new Response(JSON.stringify({ success: true, data: { csrfToken: 'tco-csrf' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { requestKey: 'key', products: [] } }), { status: 200 });
  };

  try {
    const payload = { productIds: [20, 21], variantIds: [30, 31], years: 3 };
    const result = await calculateTco(payload);
    assert.equal(result.requestKey, 'key');
    assert.equal(calls[1].url.endsWith('/api/tco/calculate'), true);
    assert.equal(calls[1].options.method, 'POST');
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'tco-csrf');
    assert.deepEqual(JSON.parse(calls[1].options.body), payload);

    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: 'Chọn sản phẩm cùng danh mục.' }), { status: 422 });
    await assert.rejects(calculateTco(payload), error => error.status === 422 && error.message === 'Chọn sản phẩm cùng danh mục.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
