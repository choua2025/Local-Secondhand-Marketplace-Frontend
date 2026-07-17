import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ACCEPT_ATTRIBUTE, uploadImage, UploadError } from '../lib/upload';
import type { UpdateProfileInput } from '../types';

export function ProfilePage(): React.JSX.Element {
  const { user, isLoading, applyUser } = useAuth();
  const { t } = useTranslation();

  // The form is seeded from the cached user and never re-seeded. Re-seeding on
  // every `user` change would wipe whatever the person was mid-way through
  // typing the moment a save landed.
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ProtectedRoute already guards this route, but `user` is null for the moment
  // the stored token is being checked. Rendering the form against nulls would
  // seed every field empty and then save the blanks.
  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10" aria-busy="true" />;
  if (!user) return <Navigate to="/login" replace />;

  async function handleAvatarChange(file: File | undefined): Promise<void> {
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      // Uploaded immediately, so the preview is the real image. Not saved until
      // the form is submitted — an abandoned upload leaves an orphan in
      // Cloudinary, which is cheaper than making people wait to see it.
      setAvatarUrl(await uploadImage(file, 'avatars'));
      setSaved(false);
    } catch (err: unknown) {
      setError(err instanceof UploadError ? err.message : t('profile.uploadError'));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (displayName.trim().length === 0) {
      setError(t('profile.nameRequired'));
      return;
    }

    // Sent whole rather than diffed. The server treats "" as a clear for the
    // nullable columns, which is exactly what an emptied text box means.
    const input: UpdateProfileInput = {
      display_name: displayName.trim(),
      city: city.trim() || null,
      phone: phone.trim() || null,
      avatar_url: avatarUrl,
    };

    setIsSaving(true);
    try {
      // The response is the fresh row. Hand it to the context so the navbar
      // avatar and name update without a refetch.
      applyUser(await api.updateProfile(input));
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('profile.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('profile.subtitle')}</p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-6" noValidate>
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}
        {saved && (
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
            <p className="text-sm font-medium text-emerald-900">{t('profile.saved')}</p>
          </div>
        )}

        <div className="flex items-center gap-5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={t('profile.avatarAlt')}
              className="h-20 w-20 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-600">
              {displayName.charAt(0) || '?'}
            </span>
          )}

          <div className="space-y-1">
            <label className="inline-block cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50">
              <input
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                disabled={isUploading}
                onChange={(event) => void handleAvatarChange(event.target.files?.[0])}
                className="sr-only"
              />
              {isUploading
                ? t('profile.uploading')
                : avatarUrl
                  ? t('profile.changePhoto')
                  : t('profile.uploadPhoto')}
            </label>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  setAvatarUrl(null);
                  setSaved(false);
                }}
                className="ml-2 text-sm font-medium text-slate-500 transition hover:text-red-700"
              >
                {t('profile.remove')}
              </button>
            )}

            <p className="text-xs text-slate-500">{t('profile.photoHint')}</p>
          </div>
        </div>

        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-slate-700">
            {t('profile.displayName')}
          </label>
          <input
            id="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-slate-700">
            {t('profile.city')}
          </label>
          <input
            id="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            maxLength={80}
            placeholder={t('profile.cityPlaceholder')}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">{t('profile.cityHint')}</p>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
            {t('profile.phone')} <span className="font-normal text-slate-400">{t('profile.optional')}</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={32}
            placeholder="+1 (503) 555-0100"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">{t('profile.email')}</label>
          {/* Read-only. Changing an email is an identity change: it needs
              confirmation at the new address before the old one stops working,
              and the server has no route for it. */}
          <input
            value={user.email}
            readOnly
            disabled
            className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
          />
          <p className="mt-1 text-xs text-slate-500">{t('profile.emailHint')}</p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {isUploading
              ? t('profile.uploadingPhoto')
              : isSaving
                ? t('profile.saving')
                : t('profile.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
