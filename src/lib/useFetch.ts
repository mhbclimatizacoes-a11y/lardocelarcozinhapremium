import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path != null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN((v) => v + 1), []);

  useEffect(() => {
    if (path == null) return;
    let alive = true;
    setLoading(true);
    api<T>(path)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError({ message: e.message, status: e.status ?? 0 }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path, n]);

  return { data, loading, error, reload };
}
