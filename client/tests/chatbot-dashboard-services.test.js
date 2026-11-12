import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatbotFaq, sendChatbotMessage, updateChatbotFaq } from '../src/services/chatbot-service.js';
import { getDashboard } from '../src/services/reports-service.js';

test('chatbot messages send only text and server-issued context, with CSRF on writes', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url));
    calls.push({ url: parsed, options });
    if (parsed.pathname.endsWith('/auth/me')) return new Response(JSON.stringify({ success: true, data: { csrfToken: 'bot-csrf' } }), { status: 200 });
    if (parsed.pathname.endsWith('/faqs/7')) return new Response(JSON.stringify({ success: false, message: 'FAQ đã được người khác cập nhật.' }), { status: 409 });
    return new Response(JSON.stringify({ success: true, data: { intent: 'RECOMMEND', state: 'ANSWERED', recommendations: [], context: {} } }), { status: 200 });
  };
  try {
    const context = { category: 'may-giat', budgetMin: null, budgetMax: 10000000, brandIds: [], criteria: ['energy'], roomAreaM2: null };
    await sendChatbotMessage('hãng LG', context);
    const message = calls.find(call => call.url.pathname.endsWith('/api/chatbot/messages'));
    assert.equal(message.options.method, 'POST');
    assert.deepEqual(JSON.parse(message.options.body), { message: 'hãng LG', context });
    assert.equal(message.options.headers['X-CSRF-Token'], 'bot-csrf');

    await sendChatbotMessage('xin chào');
    assert.deepEqual(JSON.parse(calls.filter(call => call.url.pathname.endsWith('/api/chatbot/messages'))[1].options.body), { message: 'xin chào' });

    await createChatbotFaq({ question: 'Q', answer: 'A', keywords: 'đổi trả', status: 'DRAFT', sortOrder: 0 });
    assert.equal(calls.at(-1).url.pathname, '/api/admin/chatbot/faqs');
    await assert.rejects(updateChatbotFaq('7', { expectedVersion: 1 }), error => error.status === 409);
    assert.equal(calls.at(-1).options.method, 'PATCH');
  } finally { globalThis.fetch = originalFetch; }
});

test('dashboard requests the inclusive range and rejects responses outside the contract', async () => {
  const seen = [];
  const request = async path => { seen.push(path); return { sales: {}, ordersByStatus: [], topProducts: [], lowStock: { total: 0, items: [] } }; };
  const data = await getDashboard('2026-10-01', '2026-10-31', { request });
  assert.equal(seen[0], '/admin/dashboard?from=2026-10-01&to=2026-10-31');
  assert.equal(data.lowStock.total, 0);
  await assert.rejects(getDashboard('2026-10-01', '2026-10-31', { request: async () => ({ sales: {} }) }), error => error.code === 'INVALID_API_RESPONSE');
});
