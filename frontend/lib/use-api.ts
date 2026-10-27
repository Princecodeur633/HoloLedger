"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type Query } from "./api";

/** Minimal GET hook: refetches whenever `path` or `query` change. Pass null to skip. */
export function useApi<T>(path: string | null, query?: Query) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);
  const queryKey = JSON.stringify(query ?? {});
  // Loading is derived: the request for the current key hasn't settled yet.
  const requestKey = `${path}|${queryKey}|${version}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = path !== null && settledKey !== requestKey;

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    api<T>(path, { query: JSON.parse(queryKey) })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err : new ApiError(0, null));
      })
      .finally(() => {
        if (!cancelled) setSettledKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [path, queryKey, requestKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, error, loading, reload };
}
