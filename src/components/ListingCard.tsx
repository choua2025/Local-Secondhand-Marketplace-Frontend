import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Listing } from '../types';
import { formatPrice } from '../lib/format';


interface ListingCardProps {
  listing: Listing;
  /**
   * Slice 4 passes this to wire up the heart. Until then the prop is absent and
   * no heart renders — a button that does nothing is worse than no button.
   */
  onToggleFavorite?: (listingId: number) => void;
  isFavorited?: boolean;
}

export function ListingCard({
  listing,
  onToggleFavorite,
  isFavorited = false,
}: ListingCardProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 transition hover:shadow-md hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {t('listing.noPhoto')}
          </div>
        )}
      </div>

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={isFavorited ? t('listing.remove') : t('listing.save')}
          aria-pressed={isFavorited}
          onClick={(event) => {
            // The card is a <Link>. Without these the click would navigate away
            // the instant you try to save something.
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite(listing.id);
          }}
          className={`absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur transition hover:bg-white hover:text-rose-600 ${
            isFavorited ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill={isFavorited ? 'currentColor' : 'none'}
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
        </button>
      )}

      <div className="flex flex-1 flex-col p-4">
        <p className="text-lg font-semibold text-slate-900">{formatPrice(listing.price)}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">{listing.title}</h3>

        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-slate-500">
          <span>{listing.city ?? t('listing.unknownLocation')}</span>
          <span aria-hidden="true">·</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
            {t(`condition.${listing.condition}`)}
          </span>
        </div>
        
      </div>
    </Link>
  );
}
