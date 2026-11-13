import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '../api/client';

/**
 * Persistent WebSocket hook with exponential-backoff reconnect.
 * Connects to /ws?token=<JWT> so the backend can authenticate the connection.
 * onMessage(event) is called for every raw MessageEvent.
 * Returns { connected }.
 */
export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const wsRef      = useRef(null);
  const retryDelay = useRef(1000);
  const retryTimer = useRef(null);
  const destroyed  = useRef(false);
  const onMsgRef   = useRef(onMessage);
  onMsgRef.current = onMessage;

  const connect = useCallback(() => {
    if (destroyed.current) return;
    // api.wsUrl() returns ws://localhost:3001/ws?token=<JWT>
    const url = api.wsUrl();
    console.log('🔌 WebSocket connecting to:', url);
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      setConnected(true);
      retryDelay.current = 1000;
    };

    ws.onmessage = (evt) => {
      console.log('📩 WebSocket message received:', evt.data.substring(0, 100));
      onMsgRef.current?.(evt);
    };

    ws.onclose = (evt) => {
      console.log('❌ WebSocket closed:', evt.code, evt.reason);
      setConnected(false);
      if (!destroyed.current) {
        retryTimer.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30000);
          connect();
        }, retryDelay.current);
      }
    };

    ws.onerror = (err) => {
      console.error('⚠️ WebSocket error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    destroyed.current = false;
    connect();
    return () => {
      destroyed.current = true;
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
