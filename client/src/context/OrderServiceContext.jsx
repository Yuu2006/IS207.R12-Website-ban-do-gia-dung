import { createContext, useContext, useState } from 'react';
import { getSession } from '../services/auth-service.js';
import { createOrderService } from '../services/order-service.js';
import { createMockOrderService } from '../services/order-mock-service.js';

export const OrderServiceContext = createContext(null);

// Mặc định dùng HTTP thật; fixture chỉ được bật rõ ràng trong development, không fallback khi API lỗi.
export function OrderServiceProvider({ children }) {
  const [service] = useState(() => import.meta.env.DEV && import.meta.env.VITE_ORDER_API_MODE === 'mock'
    ? createMockOrderService({ getCustomer: async () => (await getSession())?.user })
    : createOrderService());
  return <OrderServiceContext.Provider value={service}>{children}</OrderServiceContext.Provider>;
}

export function useOrderService() {
  const service = useContext(OrderServiceContext);
  if (!service) throw new Error('OrderServiceProvider is required.');
  return service;
}
