/**
 * The listing form, shared by "Sell an item" (create) and "Edit listing".
 *
 * It owns every field, the category dropdown, client-side validation, and the
 * submit/cancel buttons. What it does NOT own is what happens on success — the
 * caller passes `onSubmit`, which does the actual API call and navigates. That
 * is the one thing that differs between creating and editing; everything else
 * is identical, so it lives here once.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ImageUploader } from './ImageUploader';
import { useCategoryLabel } from '../lib/categoryLabel';
import { CONDITION_LABELS } from '../types';
import type { Category, CreateListingInput, ListingCondition } from '../types';

/** Matches the server's rule exactly, so the user hears about it without a round-trip. */
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const MAX_IMAGES = 8;

/** The validated, normalized payload — the shape both create and update accept. */
export type ListingFormPayload = Omit<CreateListingInput, never>;

export interface ListingFormInitial {
  title: string;
  price: string;
  condition: ListingCondition;
  /** '' for no category, or the category id as a string (matches the <select>). */
  categoryId: string;
  description: string;
  imageUrls: string[];
}

const EMPTY: ListingFormInitial = {
  title: '',
  price: '',
  condition: 'good',
  categoryId: '',
  description: '',
  imageUrls: [],
};

interface ListingFormProps {
  /** Prefill, for editing. Omitted for a blank create form. */
  initial?: ListingFormInitial;
  submitLabel: string;
  submittingLabel: string;
  /** Does the create/update call and navigates. Throwing surfaces as an error. */
  onSubmit: (payload: ListingFormPayload) => Promise<void>;
}

/**
 * Flattens the category tree into indented options. The API returns a flat list
 * with parent_id, so we walk it depth-first to render Electronics > Phones >
 * iPhone as nested labels in a plain <select>.
 */
function flattenCategories(
  categories: Category[],
  parentId: number | null = null,
  depth = 0,
): Array<{ category: Category; depth: number }> {
  return categories
    .filter((category) => category.parent_id === parentId)
    .flatMap((category) => [
      { category, depth },
      ...flattenCategories(categories, category.id, depth + 1),
    ]);
}

export function ListingForm({
  initial = EMPTY,
  submitLabel,
  submittingLabel,
  onSubmit,
}: ListingFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(initial.title);
  const [price, setPrice] = useState(initial.price);
  const [condition, setCondition] = useState<ListingCondition>(initial.condition);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [description, setDescription] = useState(initial.description);
  // Cloudinary delivery URLs of photos already uploaded. On an edit these start
  // as the listing's current gallery; ImageUploader appends as uploads finish.
  const [imageUrls, setImageUrls] = useState<string[]>(initial.imageUrls);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    void api
      .listCategories()
      .then(setCategories)
      .catch(() => {
        // Category is optional; the form still works without the dropdown.
      });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (title.trim().length === 0) {
      setError(t('listingForm.titleRequired'));
      return;
    }
    if (!PRICE_PATTERN.test(price)) {
      setError(t('listingForm.priceInvalid'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        price,
        condition,
        category_id: categoryId === '' ? null : Number(categoryId),
        image_urls: imageUrls,
      });
      // On success onSubmit navigates away; nothing more to do here.
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500';

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5" noValidate>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          {t('listingForm.title')}
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          placeholder={t('listingForm.titlePlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-slate-700">
            {t('listingForm.price')}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 pt-0.5 text-sm text-slate-500">
              $
            </span>
            <input
              id="price"
              // A text input, not type="number". Number inputs hand you a
              // float and let the user paste "1e5"; price must stay a string.
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={t('listingForm.pricePlaceholder')}
              className={`${inputClass} pl-7`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="condition" className="block text-sm font-medium text-slate-700">
            {t('listingForm.condition')}
          </label>
          <select
            id="condition"
            value={condition}
            onChange={(event) => setCondition(event.target.value as ListingCondition)}
            className={inputClass}
          >
            {(Object.keys(CONDITION_LABELS) as ListingCondition[]).map((value) => (
              <option key={value} value={value}>
                {t(`condition.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          {t('listingForm.category')}{' '}
          <span className="font-normal text-slate-400">{t('listingForm.optional')}</span>
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={inputClass}
        >
          <option value="">{t('listingForm.noCategory')}</option>
          {flattenCategories(categories).map(({ category, depth }) => (
            <option key={category.id} value={category.id}>
              {/* U+00A0, not a plain space: browsers collapse ordinary
                  leading whitespace inside <option> and the nesting vanishes. */}
              {' '.repeat(depth * 4)}
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          {t('listingForm.description')}{' '}
          <span className="font-normal text-slate-400">{t('listingForm.optional')}</span>
        </label>
        <textarea
          id="description"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('listingForm.descriptionPlaceholder')}
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">
          {t('listingForm.photos')}{' '}
          <span className="font-normal text-slate-400">{t('listingForm.photosHint')}</span>
        </legend>
        <div className="mt-2">
          <ImageUploader
            value={imageUrls}
            onChange={setImageUrls}
            folder="listings"
            maxImages={MAX_IMAGES}
            onUploadingChange={setIsUploading}
          />
        </div>
      </fieldset>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          // Blocked while photos are still uploading. Submitting now would save
          // the listing without them — they aren't in `imageUrls` yet.
          disabled={isSubmitting || isUploading}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {isUploading
            ? t('listingForm.uploadingPhotos')
            : isSubmitting
              ? submittingLabel
              : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          {t('listingForm.cancel')}
        </button>
      </div>
    </form>
  );
}
