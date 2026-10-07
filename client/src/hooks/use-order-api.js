import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isUncertainApiError } from '../services/api-client.js';

// Hủy request cũ, không hiển thị kết quả của tab/từ khóa/tài khoản trước.
export function useOrderQuery(load, dependencies, { initialData = null, enabled = true } = {}) {
  const [revision, setRevision] = useState(0);
  const identity = useMemo(() => ({}), [...dependencies, enabled, revision]);
  const [state, setState] = useState({ identity, data: initialData, loading: enabled && initialData === null, error: null });
  const loader = useRef(load);
  loader.current = load;
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) { setState({ identity, data: null, loading: false, error: null }); return undefined; }
    const controller = new AbortController();
    const currentLoad = loader.current;
    setState({ identity, data: null, loading: true, error: null });
    Promise.resolve().then(() => currentLoad(controller.signal)).then(data => {
      if (!controller.signal.aborted) setState({ identity, data, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ identity, data: null, loading: false, error });
    });
    return () => controller.abort();
  }, [identity, enabled]);
  const visible = state.identity === identity ? state : { data: null, loading: enabled, error: null };
  return { ...visible, reload, setData: data => setState({ identity, data, loading: false, error: null }) };
}

// Một request tại một thời điểm; timeout/response sai giữ key cho lần thử lại.
export function useOrderAction({ onUnauthorized } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(false);
  const attempt = useRef(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function run(operation, payload, action) {
    if (pending.current) return null;
    const fingerprint = JSON.stringify([operation, payload]);
    if (attempt.current?.uncertain && attempt.current.fingerprint !== fingerprint) {
      setError(new Error('Hãy thử lại yêu cầu trước để xác định kết quả trước khi thay đổi thao tác.'));
      return null;
    }
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const data = await action({ idempotencyKey: attempt.current.key });
      if (!live.current) return null;
      attempt.current = null;
      return data;
    } catch (failure) {
      if (isUncertainApiError(failure)) attempt.current.uncertain = true;
      else attempt.current = null;
      if (live.current) setError(failure);
      if (failure.status === 401) onUnauthorized?.();
      return null;
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  return { busy, error, run, uncertain: Boolean(attempt.current?.uncertain) };
}
