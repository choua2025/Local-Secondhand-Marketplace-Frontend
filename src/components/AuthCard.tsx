/**
 * The shared furniture for the four auth screens: log in, register, forgot
 * password, reset password.
 *
 * These pages are the first thing a stranger sees, and they are the four places
 * where an inconsistent input or a differently-worded error is most noticeable.
 * So the card, the fields, the alert and the button live here once, and each
 * page contributes only its own copy and its own submit handler.
 *
 * `Field` used to live in LoginPage and be imported by RegisterPage. That worked
 * until a third page needed it.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The "No account? Sign up" line under the card. */
  footer?: ReactNode;
}

/**
 * Centres a card in the viewport. `min-h-[calc(100vh-4rem)]` rather than
 * `min-h-screen`: the navbar already occupies 4rem above us, and subtracting it
 * is what actually centres the card in the space that is left instead of
 * pushing it down and introducing a scrollbar on a short window.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps): React.JSX.Element {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <BackgroundGlow />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 sm:p-10">
          <header className="text-center">
            <BrandMark />
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          </header>

          <div className="mt-8">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Two blurred colour washes behind the card. `aria-hidden` and pointer-events-
 * none because this is decoration: a screen reader should never announce it and
 * a mouse should never catch on it.
 */
function BackgroundGlow(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
    </div>
  );
}

function BrandMark(): React.JSX.Element {
  return (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg shadow-slate-900/20">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-white"
      >
        <path d="M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9Z" />
        <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      </svg>
    </div>
  );
}

/**
 * A failed submit. `role="alert"` makes a screen reader announce it the moment
 * it appears, which is the whole reason the element is rendered conditionally
 * rather than kept in the DOM and hidden.
 */
export function FormAlert({ message }: { message: string }): React.JSX.Element {
  return (
    <div role="alert" className="flex gap-2.5 rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm-.75 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm font-medium text-red-800">{message}</p>
    </div>
  );
}

/** A successful, terminal outcome — "check your inbox", "password changed". */
export function FormNotice({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex gap-2.5 rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
      <div className="text-sm text-emerald-900">{children}</div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Rendered under the input, for the rules a user should know before typing. */
  hint?: string;
  /** The first field on a page, so the cursor lands somewhere useful. */
  autoFocus?: boolean;
}

export function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  placeholder,
  hint,
  autoFocus,
}: FieldProps): React.JSX.Element {
  // Generated rather than derived from `id`, so two Fields with the same id on
  // different pages never collide in the accessibility tree.
  const hintId = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        autoFocus={autoFocus}
        aria-describedby={hint ? hintId : undefined}
        className={INPUT_CLASS}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A password input with a reveal toggle.
 *
 * The button is `type="button"`. A bare <button> inside a <form> defaults to
 * type="submit", so without this, showing your password would submit the form.
 */
export function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  hint,
}: Omit<FieldProps, 'type' | 'placeholder' | 'autoFocus'>): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const hintId = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative mt-1">
        <input
          id={id}
          name={id}
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          aria-describedby={hint ? hintId : undefined}
          // pr-10 reserves the gutter the toggle sits in, so a long password
          // scrolls under the label rather than behind the icon.
          className={`${INPUT_CLASS} mt-0 pr-10`}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          // The label, not just the icon: "Show password" is what a screen
          // reader announces, and it flips to "Hide password" when toggled.
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <EyeIcon crossed={revealed} />
        </button>
      </div>

      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m4 4 16 16" />}
    </svg>
  );
}

/** The "Remember me" checkbox. Its meaning lives in lib/authStorage.ts. */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
      />
      <label htmlFor={id} className="select-none text-sm text-slate-600">
        {label}
      </label>
    </div>
  );
}

interface SubmitButtonProps {
  /** Shown while idle. */
  children: ReactNode;
  /** Shown while the request is in flight, alongside a spinner. */
  pendingLabel: string;
  isSubmitting: boolean;
}

export function SubmitButton({
  children,
  pendingLabel,
  isSubmitting,
}: SubmitButtonProps): React.JSX.Element {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      // aria-busy tells assistive tech the control is working rather than broken;
      // `disabled` alone reads as "unavailable".
      aria-busy={isSubmitting}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting && <Spinner />}
      {isSubmitting ? pendingLabel : children}
    </button>
  );
}

function Spinner(): React.JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" fill="none" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** The recurring "Log in" / "Sign up" link under a card. */
export function AuthFooterLink({ to, children }: { to: string; children: ReactNode }): React.JSX.Element {
  return (
    <Link to={to} className="font-medium text-slate-900 hover:underline">
      {children}
    </Link>
  );
}

/**
 * Every text input on these pages. Extracted so the focus ring, the border and
 * the padding cannot drift apart between Field and PasswordField.
 */
const INPUT_CLASS =
  'mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500';
