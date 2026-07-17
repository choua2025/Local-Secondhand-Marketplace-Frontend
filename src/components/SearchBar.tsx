import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategoryLabel } from '../lib/categoryLabel';
import type { BrowseFilters, Category } from '../types';

interface SearchBarProps {
  filters: BrowseFilters;
  categories: Category[];
  cities: string[];
  onChange: (filters: BrowseFilters) => void;
}

/**
 * Owns only the text input's keystroke-by-keystroke state. Everything else is
 * lifted to BrowsePage, which is what actually fetches.
 *
 * The text is debounced: typing "iphone" would otherwise fire six requests, and
 * they could resolve out of order. 300ms after the last keystroke, one request.
 */
export function SearchBar({
  filters,
  categories,
  cities,
  onChange,
}: SearchBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const [text, setText] = useState(filters.q);

  /**
   * The last `q` this component pushed upward. It lets us tell our own echo
   * ("the parent now has the value I just sent") apart from an external reset
   * ("the parent cleared the filters behind my back").
   */
  const lastEmitted = useRef(filters.q);

  // External reset. Without this, clicking "Clear filters" would blank the
  // parent's q, the effect below would notice text !== filters.q, and it would
  // dutifully re-apply the search the user just cleared.
  useEffect(() => {
    if (filters.q !== lastEmitted.current) {
      lastEmitted.current = filters.q;
      setText(filters.q);
    }
  }, [filters.q]);

  useEffect(() => {
    // Skip the timer when the text already matches — otherwise every parent
    // re-render would schedule a redundant onChange.
    if (text === filters.q) return;

    const timer = setTimeout(() => {
      lastEmitted.current = text;
      onChange({ ...filters, q: text });
    }, 300);
    return () => clearTimeout(timer);
  }, [text, filters, onChange]);

  // Top-level categories only. Nesting is real in the data (Electronics ->
  // Phones -> iPhone), but the API expands a slug to its whole subtree, so
  // clicking "Electronics" already returns the iPhones underneath it.
  const topLevel = categories.filter((category) => category.parent_id === null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('browse.searchPlaceholder')}
            aria-label={t('browse.searchLabel')}
            className="w-full rounded-lg border-0 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={filters.city ?? ''}
          onChange={(event) => onChange({ ...filters, city: event.target.value || null })}
          aria-label={t('browse.filterByCity')}
          className="rounded-lg border-0 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{t('browse.allCities')}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label={t('browse.categoryAll')}
          active={filters.category === null}
          onClick={() => onChange({ ...filters, category: null })}
        />
        {topLevel.map((category) => (
          <CategoryChip
            key={category.id}
            label={categoryLabel(category)}
            active={filters.category === category.slug}
            onClick={() => onChange({ ...filters, category: category.slug })}
          />
        ))}
      </div>
    </div>
  );
}

interface CategoryChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function CategoryChip({ label, active, onClick }: CategoryChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
