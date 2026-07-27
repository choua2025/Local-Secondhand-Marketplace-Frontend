/**
 * The site footer.
 *
 * Every link here points at a route that exists in App.tsx. The usual footer
 * furniture — About, Careers, Privacy, Terms — is deliberately absent: this app
 * has a catch-all `*` route, so a link to a page nobody has built lands the
 * reader on "Page not found", which is worse than not offering it.
 *
 * Add them back as the pages appear, not before.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Footer(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Rendered fresh each time rather than pinned to a build-time constant, so a
  // long-running tab does not sit there claiming it is still last year.
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link to="/" className="text-base font-bold tracking-tight text-slate-900">
              {t('nav.brand')}
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
              {t('footer.tagline')}

              This is a demo project for educational purposes. It is not a real marketplace, and no transactions should be attempted.
              
            </p>
          </div>

          <FooterColumn title={t('footer.marketplace')}>
            <FooterLink to="/">{t('footer.browse')}</FooterLink>
            <FooterLink to="/sell">{t('footer.sell')}</FooterLink>
          </FooterColumn>

          {/*
           * The account column changes with the session, because a footer that
           * offers "Log in" to someone already logged in is noise, and one that
           * offers "Your dashboard" to a stranger sends them to /login.
           */}
          <FooterColumn title={t('footer.account')}>
            {user ? (
              <>
                <FooterLink to="/dashboard">{t('footer.dashboard')}</FooterLink>
                <FooterLink to="/messages">{t('footer.messages')}</FooterLink>
                <FooterLink to="/profile">{t('footer.profile')}</FooterLink>
              </>
            ) : (
              <>
                <FooterLink to="/login">{t('footer.logIn')}</FooterLink>
                <FooterLink to="/register">{t('footer.createAccount')}</FooterLink>
                <FooterLink to="/forgot-password">{t('footer.forgotPassword')}</FooterLink>
              </>
            )}
          </FooterColumn>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">{t('footer.copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      {/* A real heading, not a styled <p>: a screen reader user navigating by
          landmark and heading should be able to find "Account" in the footer. */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">{title}</h2>
      <ul className="mt-3 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <li>
      <Link to={to} className="text-sm text-slate-500 transition hover:text-slate-900">
        {children}
      </Link>
    </li>
  );
}
