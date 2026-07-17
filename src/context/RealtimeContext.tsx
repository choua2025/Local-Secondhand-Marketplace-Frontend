/**
 * The single WebSocket the app holds while someone is logged in, and a way for
 * components to subscribe to what comes down it.
 *
 * One connection for the whole tab, not one per page: the socket outlives any
 * route, so a message that arrives while you are on the browse page still bumps
 * the unread badge. Components register a listener with `subscribe` and get the
 * events they care about; the socket itself is an implementation detail none of
 * them touch.
 *
 * Sending is NOT here. Messages are sent over the REST API, which already
 * validates and persists them; this socket is receive-only. The server pushes
 * each new message to both participants, so the sender's other tabs stay in
 * sync too — which is why listeners must dedupe by message id.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { RealtimeEvent } from '../types';

type Listener = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  /** Registers a listener and returns an unsubscribe. Stable across renders. */
  subscribe: (listener: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/** Reconnect backoff: 1s, 2s, 4s… capped, so a downed server is not hammered. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Turns the HTTP API base into the WebSocket URL, token attached.
 *
 * The token rides in the query string because a browser's native WebSocket
 * cannot set headers. See the server's socketServer for the tradeoff that
 * carries; it mirrors the choice already made for the stored auth token.
 */
function socketUrl(token: string): string {
  const apiBase = import.meta.env['VITE_API_URL'] ?? 'http://localhost:4000/api';
  const url = new URL(apiBase);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  // Drop the trailing `/api` and mount the socket at `/ws` on the same origin.
  url.pathname = `${url.pathname.replace(/\/api\/?$/, '')}/ws`;
  url.search = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

export function RealtimeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, token } = useAuth();

  // The live set of listeners, in a ref so subscribing does not re-render the
  // provider or re-run the connection effect.
  const listeners = useRef<Set<Listener>>(new Set());

  const subscribe = useCallback((listener: Listener): (() => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  /**
   * The connection lives entirely inside this effect. It reruns only when the
   * session changes — a login, a logout, a token swap — because that is the
   * only time the socket must be torn down and rebuilt.
   *
   * Gated on BOTH `user` and `token`: on a page reload the token is restored
   * from storage before `/auth/me` has confirmed it is still valid, and
   * connecting with a since-revoked token would just reconnect-loop against a
   * 401. Waiting for `user` means we only dial once the token is known good.
   */
  useEffect(() => {
    if (!token || !user) return;

    let closedByUs = false;
    let attempt = 0;
    let reconnectTimer: number | undefined;
    let socket: WebSocket | null = null;

    function connect(): void {
      socket = new WebSocket(socketUrl(token as string));

      socket.onopen = () => {
        attempt = 0; // A clean connection resets the backoff.
      };

      socket.onmessage = (event: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data as string);
        } catch {
          return; // Not JSON we sent. Ignore rather than crash the handler.
        }
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          typeof (parsed as { type?: unknown }).type === 'string'
        ) {
          const realtimeEvent = parsed as RealtimeEvent;
          // Copy first: a listener that unsubscribes itself mid-iteration would
          // otherwise mutate the set we are looping over.
          for (const listener of [...listeners.current]) listener(realtimeEvent);
        }
      };

      socket.onclose = () => {
        socket = null;
        if (closedByUs) return; // A logout or unmount; do not reconnect.
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // onerror is followed by onclose, which owns the reconnect. Closing here
        // just makes sure a half-open socket actually reaches that close.
        socket?.close();
      };
    }

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token, user]);

  const value = useMemo<RealtimeContextValue>(() => ({ subscribe }), [subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Subscribe to realtime events for the lifetime of a component.
 *
 * A thin hook over `subscribe` that also keeps the latest callback in a ref, so
 * a handler closing over changing state does not need a stable identity and does
 * not churn the subscription on every render.
 */
export function useRealtimeEvent(onEvent: Listener): void {
  const context = useContext(RealtimeContext);
  if (context === null) {
    throw new Error('useRealtimeEvent must be used inside a <RealtimeProvider>');
  }

  const handler = useRef(onEvent);
  handler.current = onEvent;

  const { subscribe } = context;
  useEffect(() => subscribe((event) => handler.current(event)), [subscribe]);
}
