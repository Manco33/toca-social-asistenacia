import { useEffect, useRef } from 'react';

export function usePolling(url: string, intervalMs: number, onData: (data: any)=>void) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) onData(data);
      } catch (e) {
        // swallow errors; caller can decide
        console.error('Polling error', e);
      }
    };

    // immediate first run
    poll();
    timerRef.current = window.setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [url, intervalMs, onData]);
}
