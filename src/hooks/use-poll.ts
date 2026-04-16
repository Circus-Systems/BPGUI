"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UsePollOptions<T> {
  intervalMs?: number;
  enabled?: boolean;
  stopWhen?: (data: T) => boolean;
}

export function usePoll<T>(
  fetcher: () => Promise<T>,
  options: UsePollOptions<T> = {}
) {
  const { intervalMs = 2000, enabled = true, stopWhen } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
      if (stopWhen?.(result)) {
        setStopped(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poll failed");
    }
    setLoading(false);
    if (enabled && !stopped) {
      timerRef.current = setTimeout(poll, intervalMs);
    }
  }, [fetcher, intervalMs, enabled, stopped, stopWhen]);

  useEffect(() => {
    if (!enabled || stopped) return;
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, stopped, poll]);

  return { data, loading, error, stopped };
}
