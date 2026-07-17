/**
 * Uploading an image straight from the browser to Cloudinary.
 *
 * The flow, and why it has three steps instead of one:
 *
 *   1. Ask our server for a signature. It hashes the upload parameters with the
 *      Cloudinary API secret, which never leaves that server.
 *   2. POST the file to Cloudinary with that signature attached. The bytes go
 *      direct — they never touch our Express process, so a 12MB photo costs us
 *      no memory and no request timeout.
 *   3. Hand the returned URL back to the caller, who stores it on a listing or
 *      a profile through our own API.
 *
 * The obvious shortcut — an unsigned "upload preset" — would let anyone who
 * read the page source upload anything to the account, forever.
 */
import { api, ApiError } from '../api/client';
import type { UploadFolder } from '../types';

/**
 * 10MB. Cloudinary's own free-tier limit for an unsigned image is 10MB, and a
 * phone camera JPEG lands well under it. Checked here so a user who picks a
 * 60MB RAW file is told immediately, rather than after a two-minute upload.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The formats every browser can display. Notably absent: SVG, which is a
 * document that can carry script, not a picture.
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** The `accept` attribute for a file input, derived from the same list. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',');

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Rejects a file the browser should never have offered.
 *
 * This is convenience, not security. A determined client can POST whatever it
 * likes straight to Cloudinary with a valid signature — which is why the server
 * re-derives what it stores from the URL it gets back, and why the signature is
 * scoped to one folder and expires.
 */
export function validateImageFile(file: File): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new UploadError(`${file.name} is not a JPEG, PNG, WebP or GIF.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `${file.name} is ${megabytes(file.size)}. The limit is ${megabytes(MAX_UPLOAD_BYTES)}.`,
    );
  }
}

interface CloudinaryUploadResponse {
  secure_url: string;
}

/**
 * Uploads one file and resolves with its https delivery URL.
 *
 * We return only `secure_url` and drop the `public_id` Cloudinary also sends.
 * That is deliberate: the server re-derives the public_id from the URL rather
 * than trusting one from the browser. A client that could name the id could
 * name *somebody else's*, and have our cleanup code delete their image.
 */
export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  validateImageFile(file);

  let signature;
  try {
    signature = await api.uploadSignature(folder);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 503) {
      throw new UploadError('Image uploads are not configured on this server.');
    }
    throw new UploadError('Could not authorise the upload. Please try again.');
  }

  // Multipart, because that is what Cloudinary's upload endpoint speaks. The
  // field names are theirs, not ours — `api_key`, not `apiKey`.
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.api_key);
  form.append('timestamp', String(signature.timestamp));
  form.append('folder', signature.folder);
  form.append('signature', signature.signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`;

  let response: Response;
  try {
    // No Content-Type header: the browser must set it, because only it knows
    // the multipart boundary it generated.
    response = await fetch(endpoint, { method: 'POST', body: form });
  } catch {
    throw new UploadError('Could not reach Cloudinary. Check your connection.');
  }

  if (!response.ok) {
    // Cloudinary's error shape is { error: { message } }.
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body && body.error
        ? String((body.error as { message?: unknown }).message ?? response.statusText)
        : response.statusText;
    throw new UploadError(`Upload failed: ${message}`);
  }

  const result = (await response.json()) as CloudinaryUploadResponse;
  if (typeof result.secure_url !== 'string') {
    throw new UploadError('Cloudinary returned no image URL.');
  }
  return result.secure_url;
}

/**
 * Uploads several files, and reports the first failure rather than a partial
 * success. The successful uploads before it are orphaned in Cloudinary — a few
 * stray bytes, versus the alternative of silently dropping a photo the user
 * chose and believes they published.
 */
export async function uploadImages(files: readonly File[], folder: UploadFolder): Promise<string[]> {
  return Promise.all(files.map((file) => uploadImage(file, folder)));
}
