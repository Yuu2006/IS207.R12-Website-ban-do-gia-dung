import { requestApi } from './http-client.js';

// HOME-01/FIT-01: phiên và quyền sở hữu do PHP kiểm tra.
export const listRooms = () => requestApi('/api/room-profiles');
export const saveRoom = (id, values) => requestApi(`/api/room-profiles${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: values });
export const deleteRoom = id => requestApi(`/api/room-profiles/${id}`, { method: 'DELETE' });
export const runFitCheck = (productId, roomProfileId) => requestApi('/api/fit-checks', { method: 'POST', body: { productId, roomProfileId, requestKey: crypto.randomUUID() } });
