import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ListingCard } from '../components/ListingCard';
import { StarPicker } from '../components/StarRating';
import { ViewCount } from '../components/ViewCount';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { formatPrice, formatRelativeTime } from '../lib/format';
import { isReviewable } from '../types';
import type {
  Listing,
  ListingStatus,
  OrderRole,
  OrderStatus,
  OrderSummary,
  OwnListing,
} from '../types';

type Tab = 'listings' | 'orders' | 'favorites';

function isTab(value: string | null): value is Tab {
  return value === 'listings' || value === 'orders' || value === 'favorites';
}

const TABS: readonly Tab[] = ['listings', 'orders', 'favorites'];

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();
  const { count } = useFavorites();
  const { t } = useTranslation();

  // The tab lives in the URL so that buying an item can land you on
  // /dashboard?tab=orders, and so a refresh keeps you where you were.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'listings';
  const setTab = (next: Tab): void => setSearchParams({ tab: next }, { replace: true });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {user?.display_name ?? t('dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{user?.city ?? t('dashboard.noCity')}</p>
      </header>

      <div className="mt-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Dashboard sections">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
                tab === id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {t(`dashboard.tabs.${id}`)}
              {id === 'favorites' && count > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-8">
        {tab === 'listings' && <MyListingsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'favorites' && <FavoritesTab />}
      </div>
    </div>
  );
}

function MyListingsTab(): React.JSX.Element {
  const { t } = useTranslation();
  const [listings, setListings] = useState<OwnListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listMyListings()
      .then((result) => {
        if (!cancelled) setListings(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('dashboard.listings.loadError'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleDelete(id: number): Promise<void> {
    setDeletingId(id);
    setError(null);
    try {
      await api.deleteListing(id);
      // The row still exists server-side (status='removed'); it just leaves
      // this list. Drop it locally rather than refetching the whole set.
      setListings((current) => current?.filter((listing) => listing.id !== id) ?? null);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('dashboard.listings.removeError'));
    } finally {
      setDeletingId(null);
    }
  }

  if (error && listings === null) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (listings === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
        <p className="text-sm font-medium text-slate-900">{t('dashboard.listings.emptyTitle')}</p>
        <Link
          to="/sell"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t('dashboard.listings.sellCta')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {listings.map((listing) => (
          <li
            key={listing.id}
            className="flex items-center gap-4 rounded-xl bg-white p-3 ring-1 ring-slate-200"
          >
            <Link to={`/listing/${listing.id}`} className="shrink-0">
              {listing.cover_image_url ? (
                <img
                  src={listing.cover_image_url}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                  No photo
                </div>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                to={`/listing/${listing.id}`}
                className="block truncate text-sm font-medium text-slate-900 hover:underline"
              >
                {listing.title}
              </Link>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {formatPrice(listing.price)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <StatusBadge status={listing.status} />
                <span>{t(`condition.${listing.condition}`)}</span>
                <span aria-hidden="true">·</span>
                <span>{t('dashboard.listings.listed', { time: formatRelativeTime(listing.created_at) })}</span>
                <span aria-hidden="true">·</span>
                <ViewCount count={listing.view_count} />
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <Link
                to={`/listing/${listing.id}/edit`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {t('dashboard.listings.edit')}
              </Link>
              <button
                type="button"
                onClick={() => void handleDelete(listing.id)}
                disabled={deletingId === listing.id}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                {deletingId === listing.id
                  ? t('dashboard.listings.removing')
                  : t('dashboard.listings.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The client's mirror of the server's transition table. It decides which
 * buttons to render; the server decides what is actually allowed. If the two
 * ever disagree the server wins — this list is a convenience, not a guard.
 */
const ACTIONS: ReadonlyArray<{
  from: OrderStatus;
  to: OrderStatus;
  who: OrderRole;
  /** A key under dashboard.actions.* — the visible label is translated at render. */
  labelKey: 'markPaid' | 'markCompleted' | 'cancel' | 'refund';
  tone: 'primary' | 'neutral' | 'danger';
}> = [
  { from: 'pending', to: 'paid', who: 'buyer', labelKey: 'markPaid', tone: 'primary' },
  { from: 'paid', to: 'completed', who: 'seller', labelKey: 'markCompleted', tone: 'primary' },
  { from: 'pending', to: 'cancelled', who: 'buyer', labelKey: 'cancel', tone: 'danger' },
  { from: 'pending', to: 'cancelled', who: 'seller', labelKey: 'cancel', tone: 'danger' },
  { from: 'paid', to: 'cancelled', who: 'buyer', labelKey: 'cancel', tone: 'danger' },
  { from: 'paid', to: 'cancelled', who: 'seller', labelKey: 'cancel', tone: 'danger' },
  { from: 'completed', to: 'refunded', who: 'seller', labelKey: 'refund', tone: 'neutral' },
];

function OrdersTab(): React.JSX.Element {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** The order whose review form is open, if any. */
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listOrders()
      .then((result) => {
        if (!cancelled) setOrders(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t('dashboard.orders.loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function act(orderId: number, status: OrderStatus): Promise<void> {
    setBusyId(orderId);
    setError(null);
    try {
      const updated = await api.updateOrderStatus(orderId, status);
      setOrders(
        (current) =>
          current?.map((order) =>
            order.id === orderId
              ? { ...order, status: updated.status, completed_at: updated.completed_at }
              : order,
          ) ?? null,
      );
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('dashboard.orders.updateError'));
      // Our view of the order is stale — reload rather than guess.
      await api.listOrders().then(setOrders).catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  if (error && orders === null) return <p className="text-sm text-red-700">{error}</p>;

  if (orders === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
        <p className="text-sm font-medium text-slate-900">{t('dashboard.orders.emptyTitle')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('dashboard.orders.emptyBody')}</p>
      </div>
    );
  }

  const toneClass: Record<'primary' | 'neutral' | 'danger', string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700',
    neutral: 'text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
    danger: 'text-red-700 ring-1 ring-red-200 hover:bg-red-50',
  };

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {orders.map((order) => {
          const actions = ACTIONS.filter((a) => a.from === order.status && a.who === order.role);
          return (
            <li
              key={order.id}
              className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-3 ring-1 ring-slate-200"
            >
              <Link to={`/listing/${order.listing_id}`} className="shrink-0">
                {order.listing_cover_url ? (
                  <img
                    src={order.listing_cover_url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                    No photo
                  </div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/listing/${order.listing_id}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:underline"
                >
                  {order.listing_title}
                </Link>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {formatPrice(order.amount)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <OrderStatusBadge status={order.status} />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {order.role === 'buyer' ? t('dashboard.orders.buying') : t('dashboard.orders.selling')}
                  </span>
                  <span>
                    {order.role === 'buyer' ? t('dashboard.orders.from') : t('dashboard.orders.to')}{' '}
                    {order.counterparty_name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRelativeTime(order.created_at)}</span>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {actions.map((action) => (
                  <button
                    key={`${action.to}-${action.who}`}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => void act(order.id, action.to)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                      toneClass[action.tone]
                    }`}
                  >
                    {t(`dashboard.actions.${action.labelKey}`)}
                  </button>
                ))}

                {isReviewable(order.status) && !order.reviewed_by_me && reviewingId !== order.id && (
                  <button
                    type="button"
                    onClick={() => setReviewingId(order.id)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
                  >
                    {t('dashboard.orders.leaveReview')}
                  </button>
                )}

                {isReviewable(order.status) && order.reviewed_by_me && (
                  <span className="self-center text-xs text-slate-400">
                    {t('dashboard.orders.reviewed')}
                  </span>
                )}
              </div>

              {reviewingId === order.id && (
                <div className="w-full border-t border-slate-100 pt-3">
                  <ReviewForm
                    counterpartyName={order.counterparty_name}
                    orderId={order.id}
                    onCancel={() => setReviewingId(null)}
                    onDone={() => {
                      setReviewingId(null);
                      // Flip the flag locally; the server is the source of truth
                      // but it just told us this succeeded.
                      setOrders(
                        (current) =>
                          current?.map((o) =>
                            o.id === order.id ? { ...o, reviewed_by_me: true } : o,
                          ) ?? null,
                      );
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

interface ReviewFormProps {
  orderId: number;
  counterpartyName: string;
  onCancel: () => void;
  onDone: () => void;
}

function ReviewForm({
  orderId,
  counterpartyName,
  onCancel,
  onDone,
}: ReviewFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (rating < 1) {
      setError(t('dashboard.review.needRating'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createReview({ order_id: orderId, rating, body: body.trim() || null });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('dashboard.review.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <p className="text-sm font-medium text-slate-900">
        {t('dashboard.review.prompt', { name: counterpartyName })}
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <StarPicker value={rating} onChange={setRating} />

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t('dashboard.review.placeholder')}
        aria-label={t('dashboard.review.label')}
        className="w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {isSubmitting ? t('dashboard.review.posting') : t('dashboard.review.post')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          {t('dashboard.review.cancel')}
        </button>
      </div>
    </form>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }): React.JSX.Element {
  const { t } = useTranslation();
  const styles: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    paid: 'bg-sky-100 text-sky-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-500',
    refunded: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${styles[status]}`}>
      {t(`orderStatus.${status}`)}
    </span>
  );
}

function FavoritesTab(): React.JSX.Element {
  const { t } = useTranslation();
  const { favoriteIds, isFavorited, toggle } = useFavorites();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetched once. The rendered set is then derived from the context's ids, so
  // un-hearting a card removes it from this grid immediately — the optimistic
  // update in the context is the single source of truth, and there is nothing
  // to keep in sync here.
  useEffect(() => {
    let cancelled = false;
    api
      .listFavorites()
      .then((result) => {
        if (!cancelled) setListings(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('dashboard.favorites.loadError'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) return <p className="text-sm text-red-700">{error}</p>;

  if (listings === null) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const visible = listings.filter((listing) => favoriteIds.has(listing.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
        <p className="text-sm font-medium text-slate-900">{t('dashboard.favorites.emptyTitle')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('dashboard.favorites.emptyBody')}</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t('dashboard.favorites.browseCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          isFavorited={isFavorited(listing.id)}
          onToggleFavorite={(listingId) => void toggle(listingId)}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ListingStatus }): React.JSX.Element {
  const { t } = useTranslation();
  const styles: Record<ListingStatus, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    sold: 'bg-slate-900 text-white',
    removed: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${styles[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}
