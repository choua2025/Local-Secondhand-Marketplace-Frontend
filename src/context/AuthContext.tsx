import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, setAuthToken } from '../api/client';
import { clearStoredToken, getStoredToken, storeToken } from '../lib/authStorage';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True until we've decided whether a stored token is still good. */
  isLoading: boolean;
  /**
   * @param remember false keeps the session in sessionStorage, so it dies with
   *                 the tab. Defaults to true, matching the checkbox's default.
   */
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    display_name: string;
    city: string;
  }) => Promise<void>;
  logout: () => void;
  /**
   * Replaces the cached user after they edit their own profile, so the navbar
   * avatar and name update without a reload. Not a re-fetch: the PATCH response
   * already carries the fresh row.
   */
  applyUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(token !== null);

  /**
   * Rehydration, once at mount. A reload leaves us holding a token but no user,
   * and that token may have expired or been signed with a since-changed secret.
   * The only way to know is to ask the server. Until it answers, `isLoading` is
   * true — so ProtectedRoute waits instead of bouncing a logged-in user to /login.
   *
   * The dependency list is empty on purpose. Keying this on `token` would make
   * a fresh login re-fetch a user the login response already handed us.
   */
  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken === null) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setAuthToken(storedToken);

    api
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A 401 means the token is dead — drop it. Anything else (the API being
        // down) should not log the user out; they may still have a valid session.
        if (error instanceof ApiError && error.status === 401) {
          clearStoredToken();
          setAuthToken(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = useCallback((nextUser: User, nextToken: string, remember: boolean): void => {
    storeToken(nextToken, remember);
    setAuthToken(nextToken);
    setUser(nextUser);
    setToken(nextToken);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember = true): Promise<void> => {
      const result = await api.login({ email, password });
      applySession(result.user, result.token, remember);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      display_name: string;
      city: string;
    }): Promise<void> => {
      const result = await api.register(input);
      // Someone creating an account is by definition on a machine they intend to
      // come back to, so a fresh registration always persists.
      applySession(result.user, result.token, true);
    },
    [applySession],
  );

  const applyUser = useCallback((nextUser: User): void => {
    setUser(nextUser);
  }, []);

  const logout = useCallback((): void => {
    clearStoredToken();
    setAuthToken(null);
    setUser(null);
    setToken(null);
  }, []);

  // Memoized so consumers don't re-render on every provider render.
  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout, applyUser }),
    [user, token, isLoading, login, register, logout, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Throws rather than returning null when used outside the provider. A component
 * that forgets the provider gets a clear error at first render instead of a
 * confusing "user is always logged out".
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
