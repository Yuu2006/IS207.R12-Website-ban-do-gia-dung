import { API_URL, requestApi, uploadImage } from './http-client.js';

// The server derives the customer from the session, including when no room has been selected.
export const getInstallationChecklist = (productId, roomProfileId, { signal } = {}) => requestApi(`/api/installation-checklists?${new URLSearchParams({ productId, ...(roomProfileId ? { roomProfileId } : {}) })}`, { signal });
// Carry the caller's version/key unchanged so retrying a submission cannot create another revision.
export const saveInstallationChecklist = (body, { signal } = {}) => requestApi('/api/installation-checklists', { method: 'POST', body, signal });

export async function uploadChecklistReferencePhoto(file) {
  const uploaded = await uploadImage(file, 'checklists');
  const target = new URL(uploaded, API_URL);
  if (target.origin !== new URL(API_URL).origin) throw new Error('Ảnh tham khảo phải được tải lên máy chủ HomeCare.');
  return target.pathname;
}
