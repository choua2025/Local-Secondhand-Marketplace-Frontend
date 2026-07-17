import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ListingForm } from '../components/ListingForm';
import type { ListingFormInitial } from '../components/ListingForm';
import { useAuth } from '../context/AuthContext';
import type { ListingDetail } from '../types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; listing: ListingDetail };

/** Turns a loaded listing into the form's prefill shape. */
function toInitial(listing: ListingDetail): ListingFormInitial {
  return {
    title: listing.title,
    price: listing.price,
    condition: listing.condition,
    categoryId: listing.category ? String(listing.category.id) : '',
    description: listing.description ?? '',
    // The current gallery, in order; the uploader lets the seller add, remove
    // and reorder from here.
    imageUrls: listing.images.map((image) => image.url),
  };
}

export function EditListingPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const listingId = Number(id);
    if (!Number.isInteger(listingId) || listingId < 1) {
      setState({ status: 'error', message: t('edit.invalidId') });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    api
      .getListing(listingId)
      .then((listing) => {
        if (cancelled) return;
        // Only the owner may edit. The server enforces this too (a PATCH from
        // anyone else is a 403); checking here just shows an honest page rather
        // than a form that will fail on submit.
        if (listing.seller.id !== user?.id) {
          setState({ status: 'error', message: t('edit.notOwner') });
          return;
        }
        setState({ status: 'ready', listing });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const notFound = err instanceof ApiError && err.status === 404;
        setState({
          status: 'error',
          message: notFound
            ? t('edit.notFound')
            : err instanceof ApiError
              ? err.message
              : t('common.somethingWrong'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id, user?.id, t]);

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 space-y-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{t('edit.loadErrorTitle')}</h1>
        <p className="mt-2 text-sm text-slate-500">{state.message}</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t('edit.backToListings')}
        </Link>
      </div>
    );
  }

  const { listing } = state;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('edit.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('edit.subtitle')}</p>

      <ListingForm
        initial={toInitial(listing)}
        submitLabel={t('edit.submit')}
        submittingLabel={t('edit.submitting')}
        onSubmit={async (input) => {
          await api.updateListing(listing.id, input);
          navigate(`/listing/${listing.id}`);
        }}
      />
    </div>
  );
}
