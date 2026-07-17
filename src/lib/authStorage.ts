/**
 * The single owner of where the token lives. Both AuthContext and the api
 * client read through here, so the storage key exists in exactly one place.
 *
 * Which storage depends on "Remember me":
 *
 *   localStorage   — survives closing the browser. What most people want on
 *                    their own machine, so it is the default.
 *   sessionStorage — scoped to the tab and erased when it closes. What the
 *                    checkbox turns off, and the right answer on a shared or
 *                    public computer.
 *
 * Both are read on startup because only one of them holds a token, and nothing
 * outside this file should have to know which. Every write clears the other, so
 * "logged in on a shared machine" can never leave a copy behind in localStorage.
 *
 * The tradeoff both share: anything that can run JavaScript on this origin can
 * read them, so an XSS bug becomes a stolen session. The production-grade
 * alternative is an httpOnly, SameSite cookie, which JavaScript cannot read at
 * all — but that needs the API to set cookies and a CSRF defence, which is a
 * slice of its own.
 */
const TOKEN_KEY = 'marketplace.token';

/**
 * Every access is wrapped: Safari private mode and some embedded webviews throw
 * on the very act of touching storage, and a thrown exception here would take
 * the whole app down at boot.
 */
function read(storage: Storage): string | null {
  try {
    return storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function write(storage: Storage, token: string): void {
  try {
    storage.setItem(TOKEN_KEY, token);
  } catch {
    // Non-fatal: the session simply won't survive a reload.
  }
}

function clear(storage: Storage): void {
  try {
    storage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * localStorage wins when both hold a token. That state should not arise —
 * storeToken clears the loser — but if it ever does, honouring the durable one
 * matches what the user asked for by ticking the box.
 */
export function getStoredToken(): string | null {
  return read(localStorage) ?? read(sessionStorage);
}

/**
 * @param remember true to persist across browser restarts, false to end the
 *                 session with the tab.
 */
export function storeToken(token: string, remember: boolean): void {
  const [target, other] = remember
    ? ([localStorage, sessionStorage] as const)
    : ([sessionStorage, localStorage] as const);

  // Clear first. If the write below fails on a full quota, we would rather have
  // no token than a stale one in the storage the user just opted out of.
  clear(other);
  write(target, token);
}

/** Clears both, because logout must not depend on knowing which was used. */
export function clearStoredToken(): void {
  clear(localStorage);
  clear(sessionStorage);
}
