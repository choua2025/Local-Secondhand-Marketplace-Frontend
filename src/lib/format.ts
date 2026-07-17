/**
 * `price` arrives as a decimal string like "299.00" and must stay one — see the
 * note in src/types. Intl.NumberFormat wants a number, and passing it through
 * `Number()` is exactly the float round-trip we are avoiding.
 *
 * So we format the string directly: split on the decimal point, group the
 * integer part with separators, and drop a trailing ".00" because "$299" reads
 * better on a card than "$299.00".
 */
export function formatPrice(price: string): string {
  const [whole = '0', fraction = '00'] = price.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === '00' ? `$${grouped}` : `$${grouped}.${fraction}`;
}

/**
 * "10 Jul 2026, 06:46" — the absolute time a thing happened.
 *
 * `created_at` crosses the wire as UTC ("2026-07-10T06:46:35.327Z"), and `new
 * Date` parses that into an instant. Rendering it with no explicit timeZone is
 * deliberate: Intl then uses the reader's own zone, which is the only clock they
 * can compare against their wall.
 *
 * The locale is left undefined for the same reason — the browser's, not ours,
 * so a reader in Berlin gets 06:46 and one in Chicago gets 1:46 AM.
 */
export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    // dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

/** "3 days ago", "just now" — a small relative-time formatter for created_at. */
export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';

  const units: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, secondsPerUnit] of units) {
    if (seconds >= secondsPerUnit) {
      return formatter.format(-Math.floor(seconds / secondsPerUnit), unit);
    }
  }
  return 'just now';
}
