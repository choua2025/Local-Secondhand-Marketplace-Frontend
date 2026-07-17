import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useUnread } from '../context/UnreadContext';

export function Navbar(): React.JSX.Element {
  const { user, isLoading, logout } = useAuth();
  const { count } = useFavorites();
  const { unreadCount } = useUnread();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [confirmingLogout, setConfirmingLogout] = useState(false);

  function handleLogout(): void {
    setConfirmingLogout(false);
    logout();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="text-base font-bold tracking-tight text-slate-900">
          {t('nav.brand')}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {isLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <>
              <Link
                to="/messages"
                aria-label={t('nav.messagesUnread', { count: unreadCount })}
                className="relative flex items-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/dashboard"
                aria-label={t('nav.favorites', { count })}
                className="relative flex items-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
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
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </Link>
              <Link
                to="/sell"
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {t('nav.sell')}
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-7 w-7 rounded-full bg-slate-200 object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-slate-700">
                    {user.display_name.charAt(0)}
                  </span>
                )}
                <span className="hidden font-medium sm:inline">{user.display_name}</span>
              </Link>
              <button
                type="button"
                onClick={() => setConfirmingLogout(true)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {t('nav.logOut')}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {t('nav.logIn')}
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {t('nav.signUp')}
              </Link>
            </>
          )}
        </div>
      </nav>

      <ConfirmDialog
        open={confirmingLogout}
        title={t('logout.title')}
        message={t('logout.message')}
        confirmLabel={t('logout.confirm')}
        cancelLabel={t('logout.cancel')}
        tone="danger"
        onConfirm={handleLogout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </header>
  );
}
