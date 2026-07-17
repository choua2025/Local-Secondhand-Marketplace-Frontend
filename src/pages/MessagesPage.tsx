import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { useUnread } from '../context/UnreadContext';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import type { Message, Presence, ThreadSummary } from '../types';

/**
 * The open conversation, identified by the URL: /messages?listingId=4&otherUserId=2
 *
 * Keying off the URL rather than component state means the "Message seller"
 * button on a listing page can deep-link straight into a conversation that does
 * not exist yet — one with no messages, waiting for the first.
 */
interface OpenThread {
  listingId: number;
  otherUserId: number;
}

/**
 * The other person's photo, or the first letter of their name when they have
 * none. `alt=""` throughout: the name is always rendered as text right beside
 * it, so describing the image again would just make a screen reader say it twice.
 */
function Avatar({
  url,
  name,
  className = '',
}: {
  url: string | null;
  name: string;
  className?: string;
}): React.JSX.Element {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        // object-cover, or a non-square photo is squashed rather than cropped.
        className={`shrink-0 rounded-full bg-slate-200 object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-300 font-semibold text-slate-700 ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * "Active now" or "Last seen 5 minutes ago", under the name in a conversation.
 * Renders nothing until presence is known, so the line does not flash a wrong
 * state on the way in.
 */
function PresenceLine({ presence }: { presence: Presence | null }): React.JSX.Element | null {
  const { t } = useTranslation();
  if (presence === null) return null;

  if (presence.online) {
    return <p className="text-xs font-medium text-emerald-600">{t('messages.activeNow')}</p>;
  }

  const label =
    presence.last_seen_at === null
      ? t('messages.offline')
      : t('messages.lastSeen', { time: formatRelativeTime(presence.last_seen_at) });
  return <p className="truncate text-xs text-slate-400">{label}</p>;
}

/**
 * The read receipt on a message I sent: one tick for delivered, two blue ticks
 * once the other person has read it. The colour change is the signal; the
 * second tick and the aria-label make it legible without relying on colour
 * alone (a red/green-blind reader still sees "Read" and a different glyph).
 */
function ReadReceipt({ read }: { read: boolean }): React.JSX.Element {
  const { t } = useTranslation();
  const label = read ? t('messages.receiptRead') : t('messages.receiptSent');
  return (
    <span
      className={`inline-flex items-center ${read ? 'text-sky-400' : 'text-slate-400'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 20 12" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M1 6.5 4.5 10 11 2.5" />
        {/* The second tick only appears once read — delivered is a single check. */}
        {read && <path strokeLinecap="round" strokeLinejoin="round" d="M8 9.5 9 10.5 15.5 3" />}
      </svg>
    </span>
  );
}

export function MessagesPage(): React.JSX.Element {
  const { user } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  /** The counterparty's name and the listing title, for a thread with no messages yet. */
  const [placeholderHeader, setPlaceholderHeader] = useState<{
    listingTitle: string;
    otherUserName: string;
    otherUserAvatarUrl: string | null;
  } | null>(null);

  /** The open thread's other person: online now, or last seen when. null while unknown. */
  const [presence, setPresence] = useState<Presence | null>(null);

  const listingIdParam = Number(searchParams.get('listingId'));
  const otherUserIdParam = Number(searchParams.get('otherUserId'));
  const open: OpenThread | null =
    Number.isInteger(listingIdParam) &&
    listingIdParam > 0 &&
    Number.isInteger(otherUserIdParam) &&
    otherUserIdParam > 0
      ? { listingId: listingIdParam, otherUserId: otherUserIdParam }
      : null;

  const loadThreads = useCallback(async (): Promise<void> => {
    try {
      setThreads(await api.listThreads());
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('messages.loadError'));
    }
  }, [t]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Load the open thread, then mark it read. Both keyed on the URL, so clicking
  // a different conversation re-runs the whole thing.
  useEffect(() => {
    if (!open) {
      setMessages(null);
      return;
    }

    let cancelled = false;
    setMessages(null);

    api
      .getThread(open.listingId, open.otherUserId)
      .then(async (result) => {
        if (cancelled) return;
        setMessages(result);

        // Only bother the server if there is something unread to clear.
        const hasUnread = result.some((m) => m.recipient_id === user?.id && !m.is_read);
        if (hasUnread) {
          await api.markThreadRead(open.listingId, open.otherUserId).catch(() => undefined);
          if (!cancelled) {
            await refreshUnread();
            await loadThreads();
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('messages.threadLoadError'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open?.listingId, open?.otherUserId, user?.id, refreshUnread, loadThreads, t]);

  // A brand-new conversation has no thread row yet, so the header has nothing
  // to read from. Fetch the listing to name it.
  useEffect(() => {
    if (!open) {
      setPlaceholderHeader(null);
      return;
    }
    const known = threads?.find(
      (t) => t.listing_id === open.listingId && t.other_user_id === open.otherUserId,
    );
    if (known || !threads) {
      setPlaceholderHeader(null);
      return;
    }

    let cancelled = false;
    void api
      .getListing(open.listingId)
      .then((listing) => {
        if (!cancelled) {
          // A conversation with no messages yet is always one a buyer just
          // opened from a listing page, so the other party is that seller.
          setPlaceholderHeader({
            listingTitle: listing.title,
            otherUserName: listing.seller.display_name,
            otherUserAvatarUrl: listing.seller.avatar_url,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open?.listingId, open?.otherUserId, threads]);

  // The other person's presence, fetched once per thread opened. It then stays
  // current through live `presence` events in the realtime handler below — the
  // fetch is only the starting value for a thread we just switched to.
  useEffect(() => {
    if (!open) {
      setPresence(null);
      return;
    }
    let cancelled = false;
    setPresence(null);
    void api
      .getPresence(open.otherUserId)
      .then((result) => {
        if (!cancelled) setPresence(result);
      })
      .catch(() => undefined); // A missing presence line is not worth an error.
    return () => {
      cancelled = true;
    };
  }, [open?.otherUserId]);

  // Keep the newest message in view as the conversation grows.
  //
  // `block: 'nearest'` scrolls the message list and stops there. The default,
  // 'start', walks every scrollable ancestor up to the document — so a new
  // message would yank the whole page down to align the sentinel at the top.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  /**
   * Everything the server pushes down the socket, dispatched by type.
   *
   * The callback closes over the latest `open`, `user` etc. on every render —
   * useRealtimeEvent keeps the newest version in a ref — so there is no stale
   * closure to work around.
   */
  useRealtimeEvent((event) => {
    if (!user) return;

    switch (event.type) {
      case 'message:new': {
        const message = event.payload;

        // Which conversation is this, from my side? The other party is whoever
        // I am not. It belongs to the open thread when that party and the
        // listing both match what the URL has open.
        const otherParty =
          message.sender_id === user.id ? message.recipient_id : message.sender_id;
        const inOpenThread =
          open !== null && message.listing_id === open.listingId && otherParty === open.otherUserId;

        if (inOpenThread) {
          setMessages((current) => {
            if (current === null) return current; // Still loading; the fetch will include it.
            if (current.some((m) => m.id === message.id)) return current; // Already have it.
            return [...current, message];
          });
        }

        // An inbound message in the thread I am looking at is read on arrival:
        // mark it (which pushes a read receipt back to the sender), then refresh
        // the badge and the reordered sidebar.
        if (inOpenThread && message.recipient_id === user.id) {
          void api
            .markThreadRead(open.listingId, open.otherUserId)
            .then(() => Promise.all([refreshUnread(), loadThreads()]))
            .catch(() => void loadThreads());
        } else {
          void loadThreads(); // Any other thread, or my own echo: just bump the sidebar.
        }
        break;
      }

      case 'message:read': {
        // The other person read messages I sent them in this listing. Flip my
        // own sent, still-unread bubbles to read so the receipt turns blue.
        const { listing_id, reader_id } = event.payload;
        setMessages((current) =>
          current === null
            ? current
            : current.map((m) =>
                m.listing_id === listing_id &&
                m.sender_id === user.id &&
                m.recipient_id === reader_id &&
                !m.is_read
                  ? { ...m, is_read: true }
                  : m,
              ),
        );
        break;
      }

      case 'presence': {
        // Only the person in the thread I have open is worth reacting to.
        if (open !== null && event.payload.user_id === open.otherUserId) {
          setPresence({ online: event.payload.online, last_seen_at: event.payload.last_seen_at });
        }
        break;
      }
    }
  });

  async function handleSend(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!open || draft.trim().length === 0) return;

    setIsSending(true);
    setError(null);
    try {
      const sent = await api.sendMessage({
        recipient_id: open.otherUserId,
        listing_id: open.listingId,
        body: draft.trim(),
      });
      // Dedup by id, exactly as the realtime handler does. The server echoes
      // this message back over the socket (to sync our other tabs), and that
      // echo can beat this HTTP response — in which case it is already here and
      // appending again would show the message twice.
      setMessages((current) => {
        const base = current ?? [];
        return base.some((m) => m.id === sent.id) ? base : [...base, sent];
      });
      setDraft('');
      await loadThreads();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('messages.sendError'));
    } finally {
      setIsSending(false);
    }
  }

  const activeThread = threads?.find(
    (thread) =>
      open && thread.listing_id === open.listingId && thread.other_user_id === open.otherUserId,
  );
  const header = activeThread
    ? {
        listingTitle: activeThread.listing_title,
        otherUserName: activeThread.other_user_name,
        otherUserAvatarUrl: activeThread.other_user_avatar_url,
      }
    : placeholderHeader;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('messages.title')}</h1>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {/*
       * A scrollable pane needs a parent that has decided how tall it is —
       * `overflow-y-auto` on a box free to grow just makes the box grow. So on
       * large screens this row is pinned to the viewport (minus the navbar,
       * heading and padding above it), and each pane scrolls inside its share.
       *
       * Below `lg` the grid stacks into one column and the row height goes back
       * to auto, so each pane caps itself instead. See their own classes.
       */}
      <div className="mt-6 grid gap-6 lg:h-[calc(100vh-11rem)] lg:grid-cols-[320px_1fr]">
        {/* ---- conversation list ---- */}
        {/*
         * `min-h-0` is the load-bearing class, here and on the section below. A
         * flex/grid child defaults to `min-height: auto`, which refuses to
         * shrink below its content — so without it the list would push past the
         * row it was given and the page would scroll instead of the list.
         */}
        <aside className="max-h-[60vh] min-h-0 overflow-y-auto rounded-xl bg-white ring-1 ring-slate-200 lg:max-h-none">
          {threads === null && <div className="h-64 animate-pulse rounded-xl bg-slate-100" />}

          {threads?.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">{t('messages.emptyThreads')}</p>
          )}

          {threads && threads.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {threads.map((thread) => {
                const isOpen =
                  open?.listingId === thread.listing_id &&
                  open?.otherUserId === thread.other_user_id;
                return (
                  <li key={`${thread.listing_id}-${thread.other_user_id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setSearchParams({
                          listingId: String(thread.listing_id),
                          otherUserId: String(thread.other_user_id),
                        })
                      }
                      aria-current={isOpen ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 p-3 text-left transition ${
                        isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Two facts, one thumbnail: the item this thread is
                          about, and who you're talking to. The avatar is badged
                          onto the corner rather than replacing the cover —
                          people scan for the item first. */}
                      <div className="relative shrink-0">
                        {thread.listing_cover_url ? (
                          <img
                            src={thread.listing_cover_url}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-slate-100" />
                        )}
                        <Avatar
                          url={thread.other_user_avatar_url}
                          name={thread.other_user_name}
                          // ring-white cuts the badge out of the cover behind it,
                          // so it stays legible against a busy photo.
                          className="absolute -bottom-1 -right-1 h-6 w-6 text-[10px] ring-2 ring-white"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {thread.other_user_name}
                          </p>
                          <span className="shrink-0 text-xs text-slate-400">
                            {formatRelativeTime(thread.last_message_at)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-500">{thread.listing_title}</p>
                        <p
                          className={`truncate text-xs ${
                            thread.unread_count > 0
                              ? 'font-semibold text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {thread.last_message_mine && t('messages.youPrefix')}
                          {thread.last_message_body}
                        </p>
                      </div>

                      {thread.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">
                          {thread.unread_count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ---- open conversation ---- */}
        {/*
         * `overflow-hidden` keeps the scrolling message list from painting over
         * the rounded corners. `h-[32rem]` gives the flex column something to
         * divide up on a stacked layout; on `lg` the grid row does that instead.
         */}
        <section className="flex h-[32rem] min-h-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 lg:h-auto">
          {!open && (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-slate-500">{t('messages.selectConversation')}</p>
            </div>
          )}

          {open && (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 p-4">
                <div className="relative shrink-0">
                  <Avatar
                    url={header?.otherUserAvatarUrl ?? null}
                    name={header?.otherUserName ?? '?'}
                    className="h-9 w-9 text-sm"
                  />
                  {/* The green dot only when we actually know they are online.
                      ring-white cuts it cleanly out of the avatar behind it. */}
                  {presence?.online && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {header?.otherUserName ?? t('messages.conversation')}
                  </p>
                  <PresenceLine presence={presence} />
                  <Link
                    to={`/listing/${open.listingId}`}
                    className="block truncate text-xs text-slate-500 hover:underline"
                  >
                    {header?.listingTitle ?? t('messages.listingFallback', { id: open.listingId })}
                  </Link>
                </div>
              </header>

              {/* The one pane that scrolls: it takes the space the fixed-height
                  header and composer leave, and never more. */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages === null && <p className="text-sm text-slate-400">{t('common.loading')}</p>}

                {messages?.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    {t('messages.noMessages')}
                  </p>
                )}

                {messages?.map((message) => {
                  const mine = message.sender_id === user?.id;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                          mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                        <div
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            mine ? 'justify-end text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {/* <time> rather than <p>: `dateTime` carries the exact
                              UTC instant the server sent, so the precise value
                              survives even though the text is rounded to a minute
                              and rendered in the reader's own timezone. */}
                          <time
                            dateTime={message.created_at}
                            title={formatRelativeTime(message.created_at)}
                          >
                            {formatDateTime(message.created_at)}
                          </time>
                          {/* Only on my own messages: whether the other person
                              has read them yet. Their reads of my messages are
                              the receipt I care about, not the reverse. */}
                          {mine && <ReadReceipt read={message.is_read} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={(event) => void handleSend(event)}
                className="flex shrink-0 gap-2 border-t border-slate-100 p-3"
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t('messages.writeMessage')}
                  aria-label={t('messages.messageLabel')}
                  maxLength={2000}
                  className="flex-1 rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSending || draft.trim().length === 0}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {isSending ? t('messages.sending') : t('messages.send')}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
