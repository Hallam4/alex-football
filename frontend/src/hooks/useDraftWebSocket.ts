import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftState } from "../api/football";

type Status = "connecting" | "connected" | "disconnected" | "error";

function buildWsUrl(code: string, token: string): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Turn http(s)://host into ws(s)://host
    const wsBase = apiUrl.replace(/^http/, "ws");
    return `${wsBase}/ws/draft/${code}?token=${token}`;
  }
  // Dev: derive from current page host
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/draft/${code}?token=${token}`;
}

export function useDraftWebSocket(code: string | null, token: string | null) {
  const [state, setState] = useState<DraftState | null>(null);
  const [status, setStatus] = useState<Status>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const pingTimer = useRef<ReturnType<typeof setInterval>>();

  const connect = useCallback(() => {
    if (!code || !token) return;

    setStatus("connecting");
    setError(null);

    const ws = new WebSocket(buildWsUrl(code, token));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20_000);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "state") {
        setState(msg.data);
      } else if (msg.type === "error") {
        setError(msg.message);
      }
    };

    ws.onclose = (e) => {
      clearInterval(pingTimer.current);
      wsRef.current = null;
      setStatus("disconnected");
      // Don't reconnect on auth rejection
      if (e.code === 4003 || e.code === 4004) {
        setError(e.reason || "Access denied");
        return;
      }
      // Auto-reconnect after 2s
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, [code, token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      clearInterval(pingTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const pick = useCallback((playerId: number) => {
    wsRef.current?.send(JSON.stringify({ type: "pick", player_id: playerId }));
  }, []);

  return { state, status, error, pick };
}
