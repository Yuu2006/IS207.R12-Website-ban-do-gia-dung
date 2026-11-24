import { requestApi } from './http-client.js';

// Calculates a comparison from server catalog prices/specifications and records one deduplicated TCO event.
export const calculateTco = (values, { signal } = {}) => requestApi('/api/tco/calculate', { method: 'POST', body: values, ...(signal ? { signal } : {}) });
