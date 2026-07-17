import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import {
  AuthFooterLink,
  AuthLayout,
  FormAlert,
  FormNotice,
  PasswordField,
  SubmitButton,
} from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (user) return <Navigate to="/" replace />;

  // No token in the URL at all — someone typed the path, or a mail client
  // mangled the link. Say so before they type a password into nothing.
  if (token === '') {
    return (
      <AuthLayout
        title={t('auth.reset.incompleteTitle')}
        subtitle={t('auth.reset.incompleteSubtitle')}
        footer={<AuthFooterLink to="/login">{t('auth.forgot.backToLogin')}</AuthFooterLink>}
      >
        <div className="space-y-5">
          <FormAlert message={t('auth.reset.noToken')} />
          <p className="text-sm text-slate-500">
            {t('auth.reset.copyWholeLink')}{' '}
            <Link
              to="/forgot-password"
              className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
            >
              {t('auth.reset.requestNew')}
            </Link>
            .
          </p>
        </div>
      </AuthLayout>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    // Both checks mirror rules the server also enforces. Catching them here
    // saves a round-trip — and, more importantly, saves the token: a rejected
    // submit must not be the thing that burns a single-use link.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.reset.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirmation) {
      setError(t('auth.reset.mismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      // A 400 means the link is dead: unknown, expired, or already used. The
      // server does not distinguish between them, on purpose.
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title={t('auth.reset.doneTitle')} subtitle={t('auth.reset.doneSubtitle')}>
        <div className="space-y-5">
          <FormNotice>{t('auth.reset.doneNotice')}</FormNotice>

          <Link
            to="/login"
            className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            {t('auth.reset.logIn')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      footer={
        <>
          {t('auth.reset.changedMind')}{' '}
          <AuthFooterLink to="/login">{t('auth.reset.logIn')}</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        {error && <FormAlert message={error} />}

        <PasswordField
          id="password"
          label={t('auth.reset.newPassword')}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          hint={t('auth.reset.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        />

        <PasswordField
          id="confirm_password"
          label={t('auth.reset.confirmPassword')}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
        />

        <SubmitButton isSubmitting={isSubmitting} pendingLabel={t('auth.reset.submitting')}>
          {t('auth.reset.submit')}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
