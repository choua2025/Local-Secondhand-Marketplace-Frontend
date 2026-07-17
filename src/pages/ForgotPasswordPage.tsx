import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import {
  AuthFooterLink,
  AuthLayout,
  Field,
  FormAlert,
  FormNotice,
  SubmitButton,
} from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

export function ForgotPasswordPage(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Someone with a live session has no business here; they can change a password
  // from their account, and the reset flow is for people who cannot get in.
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      // The only error the server raises here is a 400 for a malformed address.
      // It will not say whether the account exists, so neither can this page.
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title={t('auth.forgot.sentTitle')}
        subtitle={t('auth.forgot.sentSubtitle')}
        footer={<AuthFooterLink to="/login">{t('auth.forgot.backToLogin')}</AuthFooterLink>}
      >
        <div className="space-y-5">
          <FormNotice>{t('auth.forgot.sentNotice', { email })}</FormNotice>

          <p className="text-sm text-slate-500">
            {t('auth.forgot.spamHint')}{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
            >
              {t('auth.forgot.tryAnother')}
            </button>
            {t('auth.forgot.retires')}
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={
        <>
          {t('auth.forgot.remembered')}{' '}
          <AuthFooterLink to="/login">{t('auth.forgot.logIn')}</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        {error && <FormAlert message={error} />}

        <Field
          id="email"
          label={t('auth.emailLabel')}
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={setEmail}
          autoFocus
        />

        <SubmitButton isSubmitting={isSubmitting} pendingLabel={t('auth.forgot.submitting')}>
          {t('auth.forgot.submit')}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
