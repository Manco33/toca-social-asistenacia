"use client";

import { useEffect, useRef } from 'react';

type MessageHandler = (data: any) => void;

export function useSSE(url: string, onMessage: MessageHandler) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onMessage(parsed);
      } catch (err) {
        console.warn('Failed to parse SSE data', err);
      }
    };

    es.onerror = (err) => {
      console.warn('SSE error', err);
      // reconnect logic could be added here
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [url, onMessage]);
}
