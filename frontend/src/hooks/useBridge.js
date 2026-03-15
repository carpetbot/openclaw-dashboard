// useBridge.js — WebSocket hook for real-time bridge connection
import { useState, useEffect, useRef, useCallback } from 'react';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

export function useBridge(wsUrl) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef(null);
  const reconnectDelay = useRef(RECONNECT_DELAY);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[bridge] Connected');
        setConnected(true);
        setReconnecting(false);
        reconnectDelay.current = RECONNECT_DELAY;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot' || msg.type === 'state') {
            setState(msg.data);
          }
        } catch (err) {
          console.error('[bridge] Parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[bridge] Disconnected');
        setConnected(false);
        setReconnecting(true);
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.error('[bridge] Connection failed:', err);
      setReconnecting(true);
      scheduleReconnect();
    }
  }, [wsUrl]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => {
      console.log(`[bridge] Reconnecting (delay: ${reconnectDelay.current}ms)...`);
      connect();
      reconnectDelay.current = Math.min(
        reconnectDelay.current * 1.5,
        MAX_RECONNECT_DELAY
      );
    }, reconnectDelay.current);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { state, connected, reconnecting };
}
