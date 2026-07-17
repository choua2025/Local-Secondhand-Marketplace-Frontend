import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ListingForm } from '../components/ListingForm';

export function CreateListingPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('create.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('create.subtitle')}</p>

      <ListingForm
        submitLabel={t('create.submit')}
        submittingLabel={t('create.submitting')}
        onSubmit={async (input) => {
          const created = await api.createListing(input);
          navigate(`/listing/${created.id}`, { replace: true });
        }}
      />
    </div>
  );
}
