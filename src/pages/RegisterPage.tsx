import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  AuthFooterLink,
  AuthLayout,
  Field,
  FormAlert,
  PasswordField,
  SubmitButton,
} from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage(): React.JSX.Element {
  const { user, register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    // Mirror the server's rule so the user hears about it without a round-trip.
    // The server still enforces it — this check is a courtesy, not a guard.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.register.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email, password, display_name: displayName, city });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.haveAccount')}{' '}
          <AuthFooterLink to="/login">{t('auth.register.logIn')}</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        {error && <FormAlert message={error} />}

        <Field
          id="display_name"
          label={t('auth.register.displayName')}
          type="text"
          autoComplete="name"
          placeholder={t('auth.register.displayNamePlaceholder')}
          value={displayName}
          onChange={setDisplayName}
          autoFocus
        />

        <Field
          id="email"
          label={t('auth.emailLabel')}
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={setEmail}
        />

        <Field
          id="city"
          label={t('auth.register.city')}
          type="text"
          autoComplete="address-level2"
          placeholder={t('auth.register.cityPlaceholder')}
          value={city}
          onChange={setCity}
          hint={t('auth.register.cityHint')}
        />

        <PasswordField
          id="password"
          label={t('auth.passwordLabel')}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          hint={t('auth.register.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        />

        <SubmitButton isSubmitting={isSubmitting} pendingLabel={t('auth.register.submitting')}>
          {t('auth.register.submit')}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
