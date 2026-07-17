/**
 * Localizes a category name.
 *
 * Category names come from the database ("Electronics", "Phones", …), but the
 * taxonomy is a small fixed set the app owns, so its names are translatable.
 * The translation is keyed by the category's `slug` — stable and
 * language-independent — under `category.<slug>` in the locale files.
 *
 * `defaultValue` is the database name, so a category with no translation yet
 * (a newly added one, say) shows its English DB name rather than a raw key.
 * That is what keeps this safe as the taxonomy grows.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface CategoryLike {
  slug: string;
  name: string;
}

export function useCategoryLabel(): (category: CategoryLike) => string {
  const { t } = useTranslation();
  return useCallback(
    (category: CategoryLike) => t(`category.${category.slug}`, { defaultValue: category.name }),
    [t],
  );
}
