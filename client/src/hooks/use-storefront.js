import { useEffect, useState } from 'react';
import { loadProductDetail, loadStorefront } from '../services/storefront-service.js';

// { data, error, loading } cho một lần tải; `load` phải ổn định theo `key`.
function useLoad(load, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    setState({ data: null, error: null, loading: true });
    load().then(data => live && setState({ data, error: null, loading: false }), error => live && setState({ data: null, error, loading: false }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export const useStorefront = () => useLoad(loadStorefront, 'list');
export const useProductDetail = id => useLoad(() => loadProductDetail(id), id);
