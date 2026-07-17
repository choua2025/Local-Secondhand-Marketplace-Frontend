/**
 * A gallery editor: pick files, watch them upload, reorder, remove.
 *
 * It is a controlled component over `string[]` — the delivery URLs of images
 * that are already in Cloudinary. Nothing here knows about listings or
 * profiles; the parent decides where the URLs are stored.
 *
 * Uploads happen the moment a file is chosen, not on form submit. That means a
 * seller sees their photo before committing, and it means a slow upload does
 * not sit between them and a published listing. The cost is an orphaned asset
 * if they upload and then abandon the form — a few kilobytes, and the price of
 * not making people wait twice.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACCEPT_ATTRIBUTE, uploadImages, UploadError } from '../lib/upload';
import type { UploadFolder } from '../types';

interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder: UploadFolder;
  maxImages: number;
  /** Reported upward so the parent can disable submit while bytes are in flight. */
  onUploadingChange?: (isUploading: boolean) => void;
}

export function ImageUploader({
  value,
  onChange,
  folder,
  maxImages,
  onUploadingChange,
}: ImageUploaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = maxImages - value.length;

  function setUploading(next: boolean): void {
    setIsUploading(next);
    onUploadingChange?.(next);
  }

  async function handleFiles(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList);
    if (files.length > remaining) {
      setError(t('uploader.addMore', { count: remaining }));
      return;
    }

    setUploading(true);
    try {
      const urls = await uploadImages(files, folder);
      onChange([...value, ...urls]);
    } catch (err: unknown) {
      // UploadError already carries a sentence meant for a person. Anything else
      // is a bug, and saying so beats showing a stack trace's first line.
      setError(err instanceof UploadError ? err.message : t('uploader.uploadFailed'));
    } finally {
      setUploading(false);
      // Clear the input, or picking the same file twice in a row fires no
      // change event and the second attempt silently does nothing.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function move(from: number, to: number): void {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as string);
    onChange(next);
  }

  function remove(index: number): void {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((url, index) => (
            <li
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />

              {/* position 0 is the cover, and it is the only image browse ever
                  shows. Saying so beats leaving people to infer it. */}
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t('uploader.cover')}
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-slate-900/70 to-transparent p-1.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <div className="flex gap-1">
                  <IconButton
                    label={t('uploader.movePhotoEarlier', { index: index + 1 })}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    ←
                  </IconButton>
                  <IconButton
                    label={t('uploader.movePhotoLater', { index: index + 1 })}
                    disabled={index === value.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    →
                  </IconButton>
                </div>
                <IconButton
                  label={t('uploader.removePhoto', { index: index + 1 })}
                  onClick={() => remove(index)}
                >
                  ✕
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <div
          // The drop target is a plain div; the real control is the <input> it
          // wraps. That keeps the keyboard and screen-reader path working —
          // drag and drop is an enhancement, never the only way in.
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <label className="cursor-pointer">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              multiple={remaining > 1}
              disabled={isUploading}
              onChange={(event) => void handleFiles(event.target.files)}
              className="sr-only"
            />
            <span className="text-sm font-medium text-slate-700">
              {isUploading ? t('uploader.uploading') : t('uploader.choosePhotos')}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {isUploading
                ? t('uploader.uploadingHint')
                : t('uploader.dragHint', { count: remaining })}
            </span>
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-xs text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
