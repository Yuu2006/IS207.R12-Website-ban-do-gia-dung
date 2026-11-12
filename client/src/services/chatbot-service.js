import { requestApi } from './http-client.js';

// Searches active catalog SKUs and returns stock and price measured by the API at request time.
export const searchChatbotCatalog = (query, options = {}) => {
  const parameters = new URLSearchParams({ q: query, limit: String(options.limit || 8) });
  if (options.categoryId) parameters.set('categoryId', options.categoryId);
  return requestApi(`/api/chatbot/catalog-search?${parameters}`);
};

// Rule-based reply; `context` is the slot state the previous reply returned (category, budget, brands, criteria).
export const sendChatbotMessage = (message, context = null) => requestApi('/api/chatbot/messages', { method: 'POST', body: context ? { message, context } : { message } });

// Only ADMIN-approved ACTIVE FAQ questions are offered as quick chips.
export const getChatbotQuickQuestions = () => requestApi('/api/chatbot/quick-questions');

export const listChatbotFaqs = () => requestApi('/api/admin/chatbot/faqs');
export const createChatbotFaq = faq => requestApi('/api/admin/chatbot/faqs', { method: 'POST', body: faq });
export const updateChatbotFaq = (id, faq) => requestApi(`/api/admin/chatbot/faqs/${encodeURIComponent(id)}`, { method: 'PATCH', body: faq });
