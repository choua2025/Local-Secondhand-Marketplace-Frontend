import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Stars } from '../components/StarRating';
import { ViewCount } from '../components/ViewCount';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useCategoryLabel } from '../lib/categoryLabel';
import type { ListingDetail, Review } from '../types';
import { formatPrice, formatRelativeTime } from '../lib/format';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; listing: ListingDetail };

export function ListingDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isFavorited, toggle } = useFavorites();
  const categoryLabel = useCategoryLabel();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeImage, setActiveImage] = useState(0);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // The live view count, updated by the register-view call below. Starts from
  // the loaded listing and becomes the post-view total the server returns.
  const [viewCount, setViewCount] = useState<number | null>(null);
  // Which id we have already counted, so a re-render or StrictMode's double
  // effect run does not register the same visit twice.
  const viewedIdRef = useRef<number | null>(null);

  useEffect(() => {
    const listingId = Number(id);
    if (!Number.isInteger(listingId) || listingId < 1) {
      setState({ status: 'error', message: 'That listing id is not valid.', notFound: true });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    setActiveImage(0);

    api
      .getListing(listingId)
      .then((listing) => {
        if (cancelled) return;
        setState({ status: 'ready', listing });
        setViewCount(listing.view_count);

        // Count this open exactly once per id. Registering here — not on every
        // getListing — means the refetch after a 409 in handleBuy does not
        // inflate the count. The server ignores the owner's own views.
        if (viewedIdRef.current !== listingId) {
          viewedIdRef.current = listingId;
          void api
            .registerListingView(listingId)
            .then(({ view_count }) => {
              if (!cancelled) setViewCount(view_count);
            })
            .catch(() => undefined); // A missed count is not worth an error.
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const isApiError = err instanceof ApiError;
        setState({
          status: 'error',
          message: isApiError ? err.message : 'Something went wrong.',
          notFound: isApiError && err.status === 404,
        });
      });

    // If the user navigates away mid-flight, don't let the late response
    // write into an unmounted component's state.
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-slate-200" />
          <div className="space-y-4">
            <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          {state.notFound ? t('listingDetail.notFoundTitle') : t('listingDetail.errorTitle')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {state.notFound ? t('listingDetail.notFoundBody') : state.message}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t('listingDetail.backToBrowse')}
        </Link>
      </div>
    );
  }

  const { listing } = state;
  const images = listing.images;
  const cover = images[activeImage] ?? images[0];
  const isSold = listing.status === 'sold';
  const isPending = listing.status === 'pending';

  const isOwnListing = user?.id === listing.seller.id;

  // Logged-out visitors see the button too — clicking it sends them to log in.
  // Hiding it would make the whole point of the page invisible to a stranger.
  const canBuy = listing.status === 'active' && !isOwnListing;

  async function handleBuy(listingId: number): Promise<void> {
    if (!user) {
      navigate('/login', { state: { from: `/listing/${listingId}` } });
      return;
    }

    setBuyError(null);
    setIsBuying(true);
    try {
      await api.placeOrder(listingId);
      navigate('/dashboard?tab=orders');
    } catch (err: unknown) {
      // 409 means somebody bought it between the page load and the click. The
      // stale page is now lying, so refetch rather than just showing a message.
      if (err instanceof ApiError && err.status === 409) {
        setBuyError(t('listingDetail.someoneBought'));
        const fresh = await api.getListing(listingId).catch(() => null);
        if (fresh) setState({ status: 'ready', listing: fresh });
      } else {
        setBuyError(err instanceof ApiError ? err.message : t('listingDetail.couldNotOrder'));
      }
    } finally {
      setIsBuying(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← {t('listingDetail.backToBrowse')}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
            {cover ? (
              <img src={cover.url} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                {t('listing.noPhoto')}
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={t('listingDetail.viewImage', { index: index + 1 })}
                  aria-current={index === activeImage}
                  className={`h-20 w-20 overflow-hidden rounded-lg ring-2 transition ${
                    index === activeImage ? 'ring-slate-900' : 'ring-transparent hover:ring-slate-300'
                  }`}
                >
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {(isSold || isPending) && (
            <span
              className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                isSold ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isSold ? t('status.sold') : t('status.pending')}
            </span>
          )}

          <p className="text-3xl font-bold text-slate-900">{formatPrice(listing.price)}</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">{listing.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
              {t(`condition.${listing.condition}`)}
            </span>
            <span>{listing.city ?? t('listing.unknownLocation')}</span>
            <span aria-hidden="true">·</span>
            <span>{t('listingDetail.listed', { time: formatRelativeTime(listing.created_at) })}</span>
            <span aria-hidden="true">·</span>
            <ViewCount count={viewCount ?? listing.view_count} />
          </div>

          {listing.category && (
            <p className="mt-2 text-sm font-medium text-slate-700">
              {t('listingDetail.inCategory', { category: categoryLabel(listing.category) })}
            </p>
          )}

          {listing.description && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-900">{t('listingDetail.description')}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {listing.description}
              </p>
            </div>
          )}

          {buyError && (
            <div role="alert" className="mt-6 rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
              <p className="text-sm font-medium text-red-800">{buyError}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {canBuy && (
              <button
                type="button"
                disabled={isBuying}
                onClick={() => void handleBuy(listing.id)}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {isBuying
                  ? t('listingDetail.placingOrder')
                  : t('listingDetail.buyFor', { price: formatPrice(listing.price) })}
              </button>
            )}

            {!isOwnListing && (
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    navigate('/login', { state: { from: `/listing/${listing.id}` } });
                    return;
                  }
                  navigate(`/messages?listingId=${listing.id}&otherUserId=${listing.seller.id}`);
                }}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
              >
                {t('listingDetail.messageSeller')}
              </button>
            )}

            {isOwnListing && (
              <Link
                to={`/listing/${listing.id}/edit`}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
              >
                {t('listingDetail.editListing')}
              </Link>
            )}

            {!isOwnListing && listing.status === 'pending' && (
              <p className="self-center text-sm text-amber-700">
                {t('listingDetail.pendingByOther')}
              </p>
            )}

            <button
              type="button"
              aria-pressed={isFavorited(listing.id)}
              onClick={() => {
                if (!user) {
                  navigate('/login', { state: { from: `/listing/${listing.id}` } });
                  return;
                }
                void toggle(listing.id);
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-auto ${
                isFavorited(listing.id)
                  ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100'
                  : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill={isFavorited(listing.id) ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                />
              </svg>
              {isFavorited(listing.id) ? t('listingDetail.saved') : t('listingDetail.save')}
            </button>
          </div>

          <SellerCard seller={listing.seller} />

          {/* Buy (Slice 5) and Message (Slice 6) land here. */}
        </div>
      </div>
    </div>
  );
}

function SellerCard({ seller }: { seller: ListingDetail['seller'] }): React.JSX.Element {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Only fetch the review bodies if there are any. The average and count
  // already arrived with the listing.
  useEffect(() => {
    if (seller.rating_count === 0) {
      setReviews([]);
      return;
    }
    let cancelled = false;
    api
      .getUserReviews(seller.id)
      .then((result) => {
        if (!cancelled) setReviews(result.reviews);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [seller.id, seller.rating_count]);

  const visible = showAll ? reviews : reviews?.slice(0, 3);

  return (
    <div className="mt-8 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('listingDetail.seller')}
      </h2>
      <div className="mt-3 flex items-center gap-3">
        {seller.avatar_url ? (
          <img src={seller.avatar_url} alt="" className="h-11 w-11 rounded-full bg-slate-200" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-slate-700">
            {seller.display_name.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-900">{seller.display_name}</p>
          {seller.rating_average === null ? (
            <p className="text-xs text-slate-500">{t('listingDetail.noReviewsYet')}</p>
          ) : (
            <div className="mt-0.5 flex items-center gap-1.5">
              <Stars rating={seller.rating_average} />
              <span className="text-xs text-slate-500">
                {seller.rating_average.toFixed(1)} ·{' '}
                {t('listingDetail.reviewCount', { count: seller.rating_count })}
              </span>
            </div>
          )}
        </div>
      </div>

      {visible && visible.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          {visible.map((review) => (
            <li key={review.id}>
              <div className="flex items-center gap-2">
                <Stars rating={review.rating} className="h-3.5 w-3.5" />
                <span className="text-xs font-medium text-slate-700">{review.reviewer_name}</span>
                <span className="text-xs text-slate-400">
                  {formatRelativeTime(review.created_at)}
                </span>
              </div>
              {review.body && (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{review.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {reviews && reviews.length > 3 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-medium text-slate-700 hover:underline"
        >
          {t('listingDetail.showAllReviews', { count: reviews.length })}
        </button>
      )}
    </div>
  );
}
