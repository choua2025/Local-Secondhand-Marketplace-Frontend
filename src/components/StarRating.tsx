interface StarsProps {
  /** 1–5. Fractional values (an average) render partial stars. */
  rating: number;
  className?: string;
}

/**
 * Read-only stars. A fractional average like 4.3 renders as four full stars and
 * one 30%-filled — clipping the overlay by percentage rather than rounding to
 * the nearest half, which would quietly misreport the number beside it.
 */
export function Stars({ rating, className = 'h-4 w-4' }: StarsProps): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} className={`relative inline-block ${className}`}>
            <Star className={`${className} absolute inset-0 text-slate-300`} filled />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
              aria-hidden="true"
            >
              <Star className={`${className} text-amber-400`} filled />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Star({ className, filled }: { className: string; filled: boolean }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
    </svg>
  );
}

interface StarPickerProps {
  value: number;
  onChange: (rating: number) => void;
}

/** The interactive version, for writing a review. Radio semantics, not buttons. */
export function StarPicker({ value, onChange }: StarPickerProps): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          onClick={() => onChange(rating)}
          className="rounded p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Star
            className={`h-7 w-7 ${rating <= value ? 'text-amber-400' : 'text-slate-300'}`}
            filled
          />
        </button>
      ))}
    </div>
  );
}
