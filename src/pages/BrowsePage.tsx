import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ListingCard } from '../components/ListingCard';
import { SearchBar } from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import type { BrowseFilters, Category, Listing } from '../types';

const EMPTY_FILTERS: BrowseFilters = { q: '', category: null, city: null };

export function BrowsePage(): React.JSX.Element {
  const { user } = useAuth();
  const { isFavorited, toggle } = useFavorites();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter chrome: fetched once, never refetched.
  useEffect(() => {
    void Promise.all([api.listCategories(), api.listCities()])
      .then(([nextCategories, nextCities]) => {
        setCategories(nextCategories);
        setCities(nextCities);
      })
      .catch(() => {
        // Non-fatal. The grid still works without chips; don't blank the page.
      });
  }, []);

  /**
   * Guards against a stale response overwriting a fresh one. Type "ip", then
   * "iphone": if the first request resolves second, the grid would show results
   * for "ip". Each fetch takes a ticket; only the newest is allowed to write.
   */
  const requestIdRef = useRef(0);

  const loadFirstPage = useCallback(async (activeFilters: BrowseFilters): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.browseListings({ ...activeFilters, page: 1 });
      if (requestId !== requestIdRef.current) return;

      setListings(result.items);
      setHasMore(result.hasMore);
      setPage(1);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
      setListings([]);
      setHasMore(false);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFirstPage(filters);
  }, [filters, loadFirstPage]);

  async function loadMore(): Promise<void> {
    setIsLoadingMore(true);
    try {
      const next = page + 1;
      const result = await api.browseListings({ ...filters, page: next });
      setListings((current) => [...current, ...result.items]);
      setHasMore(result.hasMore);
      setPage(next);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('browse.loadMoreError'));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const isFiltered = filters.q !== '' || filters.category !== null || filters.city !== null;

  /**
   * Saving requires a session. Rather than hiding the heart from logged-out
   * visitors — which makes the feature invisible — we show it and send them to
   * log in, remembering where they came from so they land back here.
   */
  function handleToggleFavorite(listingId: number): void {
    if (!user) {
      navigate('/login', { state: { from: '/' } });
      return;
    }
    void toggle(listingId).catch(() => {
      setError(t('browse.favoriteError'));
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('browse.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('browse.subtitle')}</p>
      </header>

      <SearchBar filters={filters} categories={categories} cities={cities} onChange={setFilters} />

      <div className="mt-8">
        {isLoading && <SkeletonGrid />}

        {!isLoading && error && (
          <div className="rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              type="button"
              onClick={() => void loadFirstPage(filters)}
              className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        )}

        {!isLoading && !error && listings.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
            <p className="text-sm font-medium text-slate-900">{t('browse.noneFoundTitle')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {isFiltered ? t('browse.widenSearch') : t('browse.nothingPosted')}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                {t('browse.clearFilters')}
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && listings.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorited={isFavorited(listing.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={isLoadingMore}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {isLoadingMore ? t('common.loading') : t('browse.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Placeholder cards sized like the real ones, so the grid doesn't jump on load. */
function SkeletonGrid(): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading listings"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <div className="aspect-[4/3] animate-pulse bg-slate-200" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
