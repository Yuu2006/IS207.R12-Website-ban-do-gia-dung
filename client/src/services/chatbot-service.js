import { requestApi } from './http-client.js';

// Searches active catalog SKUs and returns stock and price measured by the API at request time.
export const searchChatbotCatalog = (query, options = {}) => {
  const parameters = new URLSearchParams({ q: query, limit: String(options.limit || 8) });
  if (options.categoryId) parameters.set('categoryId', options.categoryId);
  return requestApi(`/api/chatbot/catalog-search?${parameters}`);
};
