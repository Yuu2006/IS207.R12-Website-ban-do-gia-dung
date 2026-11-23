import { requestApi } from './http-client.js';

// The server derives the customer from the session, including when no room has been selected.
export const getInstallationChecklist = (productId, roomProfileId, { signal } = {}) => requestApi(`/api/installation-checklists?${new URLSearchParams({ productId, ...(roomProfileId ? { roomProfileId } : {}) })}`, { signal });
// Carry the caller's version/key unchanged so retrying a submission cannot create another revision.
export const saveInstallationChecklist = (body, { signal } = {}) => requestApi('/api/installation-checklists', { method: 'POST', body, signal });
