/**
 * "👁 42 views" — an eye and a count, shared by the listing page and the
 * seller's dashboard so the glyph and the singular/plural rule live in one place.
 */
export function ViewCount({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-3.5 w-3.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {/* toLocaleString for the thousands separator once a listing gets popular. */}
      {count.toLocaleString()} {count === 1 ? 'view' : 'views'}
    </span>
  );
}
