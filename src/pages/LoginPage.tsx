import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  AuthFooterLink,
  AuthLayout,
  Checkbox,
  Field,
  FormAlert,
  PasswordField,
  SubmitButton,
} from '../components/AuthCard';
import { useAuth } from '../context/AuthContext';

interface RedirectState {
  from?: string;
}

export function LoginPage(): React.JSX.Element {
  const { user, login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Ticked by default: most people log in from their own machine, and the box
  // is there for the exception. Unticking it keeps the token in sessionStorage.
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Where ProtectedRoute wanted to send them before the detour.
  const destination = (location.state as RedirectState | null)?.from ?? '/';

  // Already signed in? Don't show a login form.
  if (user) return <Navigate to={destination} replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password, remember);
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <AuthFooterLink to="/register">{t('auth.login.signUp')}</AuthFooterLink>
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

        <PasswordField
          id="password"
          label={t('auth.passwordLabel')}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />

        {/* gap-3 rather than a bare justify-between: on a narrow viewport the two
            wrap onto separate lines instead of colliding. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            id="remember"
            label={t('auth.login.remember')}
            checked={remember}
            onChange={setRemember}
          />
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
          >
            {t('auth.login.forgot')}
          </Link>
        </div>

        <SubmitButton isSubmitting={isSubmitting} pendingLabel={t('auth.login.submitting')}>
          {t('auth.login.submit')}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
