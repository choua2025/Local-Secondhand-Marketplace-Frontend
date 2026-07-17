/**
 * A small modal that asks "are you sure?" before an action goes through.
 *
 * Rendered through a portal to document.body, not inline where it is used. The
 * navbar has `backdrop-blur`, and any CSS filter on an ancestor makes
 * `position: fixed` descendants position against that ancestor instead of the
 * viewport — so an overlay rendered inside the header would be clipped to the
 * header's height. The portal sidesteps that entirely.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' tints the confirm button red for destructive actions. */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape cancels, and the confirm button takes focus on open so the whole
  // flow is keyboard-drivable — open, Enter to confirm or Esc to back out.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-500'
      : 'bg-slate-900 hover:bg-slate-700 focus-visible:ring-slate-500';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop. A click anywhere off the card cancels, like every other modal. */}
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5">
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        {message && <div className="mt-2 text-sm text-slate-500">{message}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
