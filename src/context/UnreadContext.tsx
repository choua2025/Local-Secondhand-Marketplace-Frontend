import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { useRealtimeEvent } from './RealtimeContext';

interface UnreadContextValue {
  unreadCount: number;
  /** Re-fetch from the server. Call after reading or sending. */
  refresh: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

/**
 * The navbar's unread badge.
 *
 * Now driven by the WebSocket. It fetches once at login for the starting count,
 * then re-fetches whenever a message arrives addressed to this user — no polling
 * timer, and no staleness between a message landing and the badge showing it.
 * MessagesPage still calls refresh() when it marks a thread read, which is the
 * count going *down*.
 *
 * A re-fetch, rather than an optimistic +1, because the true number is "unread
 * messages from other people" and only the server knows it: a message for a
 * thread the user is actively reading gets marked read almost immediately, so a
 * naive increment would flicker up and back down. One request per received
 * message is event-driven, not polling, and always correct.
 */
export function UnreadProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async (): Promise<void> => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await api.unreadCount();
      setUnreadCount(count);
    } catch {
      // Non-fatal. A stale badge is better than a broken navbar.
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A message the server pushed to us. Only inbound ones move the unread count —
  // our own sent messages come down the same socket (to sync other tabs) and
  // must not bump our badge.
  useRealtimeEvent((event) => {
    if (event.type === 'message:new' && user && event.payload.recipient_id === user.id) {
      void refresh();
    }
  });

  const value = useMemo<UnreadContextValue>(
    () => ({ unreadCount, refresh }),
    [unreadCount, refresh],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadContextValue {
  const context = useContext(UnreadContext);
  if (context === null) {
    throw new Error('useUnread must be used inside an <UnreadProvider>');
  }
  return context;
}
