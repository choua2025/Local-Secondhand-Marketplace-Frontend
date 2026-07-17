import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

interface FavoritesContextValue {
  /** Listing ids the current user has saved. The source of truth for every heart. */
  favoriteIds: ReadonlySet<number>;
  count: number;
  isFavorited: (listingId: number) => boolean;
  /** Optimistic. Flips immediately, reverts if the server disagrees. */
  toggle: (listingId: number) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Holds only the *ids*, not the listing objects.
 *
 * The hearts on the browse grid, the button on the detail page and the navbar
 * count all need to answer one question — "is this saved?" — and a Set of ids
 * answers it in O(1) from one request. The dashboard's Favorites tab, which
 * needs the full listing objects, fetches them itself.
 */
export function FavoritesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(new Set());

  // Reload on login; clear on logout. Keying the effect on user.id means
  // switching accounts never leaves the previous user's hearts on screen.
  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }

    let cancelled = false;
    api
      .listFavorites()
      .then((listings) => {
        if (!cancelled) setFavoriteIds(new Set(listings.map((listing) => listing.id)));
      })
      .catch(() => {
        // Non-fatal: hearts render empty rather than blanking the page.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const isFavorited = useCallback(
    (listingId: number): boolean => favoriteIds.has(listingId),
    [favoriteIds],
  );

  /**
   * Optimistic: the heart fills the instant you click it, because a 200ms wait
   * for a round-trip reads as a broken button. If the request fails we put the
   * old state back, so the UI never lies for longer than the request takes.
   *
   * Both endpoints are idempotent, so a double-click that races itself cannot
   * leave the server in a state the client did not ask for.
   */
  const toggle = useCallback(
    async (listingId: number): Promise<void> => {
      const wasFavorited = favoriteIds.has(listingId);

      setFavoriteIds((current) => {
        const next = new Set(current);
        if (wasFavorited) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      try {
        if (wasFavorited) await api.removeFavorite(listingId);
        else await api.addFavorite(listingId);
      } catch (error: unknown) {
        setFavoriteIds((current) => {
          const reverted = new Set(current);
          if (wasFavorited) reverted.add(listingId);
          else reverted.delete(listingId);
          return reverted;
        });
        throw error;
      }
    },
    [favoriteIds],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favoriteIds, count: favoriteIds.size, isFavorited, toggle }),
    [favoriteIds, isFavorited, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (context === null) {
    throw new Error('useFavorites must be used inside a <FavoritesProvider>');
  }
  return context;
}
