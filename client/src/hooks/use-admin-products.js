import { useCallback, useEffect, useState } from 'react';
import { listProducts } from '../services/catalog-service.js';

// Danh sách sản phẩm cho quản trị (kể cả ẩn); bỏ phản hồi cũ khi bộ lọc đổi trước khi request trước trả về.
export function useAdminProducts(filters) {
  const [state, setState] = useState({ items: null, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    setState({ items: null, error: '' });
    listProducts(JSON.parse(key)).then(items => { if (active) setState({ items, error: '' }); }).catch(error => { if (active) setState({ items: null, error: error.message }); });
    return () => { active = false; };
  }, [key, version]);
  const reload = useCallback(() => setVersion(current => current + 1), []);
  return { ...state, loading: !state.items && !state.error, reload };
}
