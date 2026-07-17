/**
 * The single place the browser talks to the network. React components call
 * these functions; they never call `fetch` directly. That keeps the base URL,
 * the auth header, and error translation in one file instead of scattered
 * across pages.
 */
import { getStoredToken } from '../lib/authStorage';
import type {
  AuthResponse,
  BrowseResult,
  Category,
  CreateListingInput,
  Listing,
  ListingDetail,
  Message,
  Order,
  OrderStatus,
  OrderSummary,
  OwnListing,
  Presence,
  Review,
  ThreadSummary,
  UpdateListingInput,
  UpdateProfileInput,
  UploadFolder,
  UploadSignature,
  User,
  UserReviews,
} from '../types';

const BASE_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:4000/api';

/**
 * An error carrying the HTTP status, so a caller can distinguish "not found"
 * from "the server is on fire" without string-matching the message.
 */
export class ApiError extends Error {
  // Declared as a field and assigned in the body. A constructor parameter
  // property (`constructor(readonly status: number)`) is TypeScript-only syntax
  // that has to be *compiled away* rather than merely erased, which the
  // template's `erasableSyntaxOnly` forbids.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Kept in a module variable so `request` can reach it without every call site
 * threading a token through. AuthContext keeps it in sync.
 *
 * Seeded from storage at module load, not left null: after a page reload the
 * very first request (AuthContext asking `/auth/me` who we are) happens before
 * any component has had a chance to call setAuthToken.
 */
let authToken: string | null = getStoredToken();

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // Only when there is a body. Setting Content-Type on a GET turns it from a
  // "simple" cross-origin request into one the browser must preflight with an
  // OPTIONS round-trip first — a wasted request per read.
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    // fetch only rejects on a network-level failure — the server being down,
    // DNS, CORS. An HTTP 500 is a *resolved* promise, handled below.
    throw new ApiError(0, 'Cannot reach the server. Is the API running?');
  }

  if (!response.ok) {
    // The API's error shape is { error: string }. Fall back to the status text
    // if we got something else (an HTML error page from a proxy, say).
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : response.statusText;
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Drops null/empty filters so we send `?q=x` and never `?q=&city=null`. */
function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  register(input: {
    email: string;
    password: string;
    display_name: string;
    city: string;
  }): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** Exchanges a stored token for the user it belongs to. 401 if it's stale. */
  me(): Promise<User> {
    return request<User>('/auth/me');
  },

  /**
   * Asks for a reset link. Resolves with the same 202 whether or not the address
   * has an account — the server will not say, and neither can the UI. Only a
   * malformed address throws (a 400).
   */
  forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Redeems the token from the emailed link. A 400 means the link is dead —
   * unknown, expired, or already used — and the server does not distinguish.
   * Returns nothing: the user logs in afterwards with the password they chose.
   */
  resetPassword(token: string, password: string): Promise<void> {
    return request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  browseListings(params: {
    q?: string;
    category?: string | null;
    city?: string | null;
    page?: number;
  }): Promise<BrowseResult> {
    return request<BrowseResult>(`/listings${buildQuery({ ...params })}`);
  },

  getListing(id: number): Promise<ListingDetail> {
    return request<ListingDetail>(`/listings/${id}`);
  },

  /**
   * Records that the caller opened this listing, and returns the new total. The
   * server ignores the owner's own opens. No token is required — a logged-out
   * view counts — but the client sends one when it has it so the owner is known.
   */
  registerListingView(id: number): Promise<{ view_count: number }> {
    return request<{ view_count: number }>(`/listings/${id}/view`, { method: 'POST' });
  },

  listCategories(): Promise<Category[]> {
    return request<Category[]>('/categories');
  },

  listCities(): Promise<string[]> {
    return request<string[]>('/listings/cities');
  },

  /** The caller's own listings, including sold and pending ones. */
  listMyListings(): Promise<OwnListing[]> {
    return request<OwnListing[]>('/listings/mine');
  },

  createListing(input: CreateListingInput): Promise<ListingDetail> {
    return request<ListingDetail>('/listings', { method: 'POST', body: JSON.stringify(input) });
  },

  /**
   * PATCH: only the keys you pass are changed. Passing `image_urls` replaces the
   * whole gallery in order (first is the cover) and deletes any Cloudinary photo
   * dropped from the list; omitting it leaves the photos alone.
   */
  updateListing(id: number, input: UpdateListingInput): Promise<ListingDetail> {
    return request<ListingDetail>(`/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteListing(id: number): Promise<void> {
    return request<void>(`/listings/${id}`, { method: 'DELETE' });
  },

  listFavorites(): Promise<Listing[]> {
    return request<Listing[]>('/favorites');
  },

  /** Idempotent server-side: saving twice is a no-op success, never a 409. */
  addFavorite(listingId: number): Promise<void> {
    return request<void>(`/favorites/${listingId}`, { method: 'POST' });
  },

  removeFavorite(listingId: number): Promise<void> {
    return request<void>(`/favorites/${listingId}`, { method: 'DELETE' });
  },

  placeOrder(listingId: number): Promise<Order> {
    return request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({ listing_id: listingId }),
    });
  },

  /** Orders where you are either the buyer or the seller. */
  listOrders(): Promise<OrderSummary[]> {
    return request<OrderSummary[]>('/orders');
  },

  updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
    return request<Order>(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  listThreads(): Promise<ThreadSummary[]> {
    return request<ThreadSummary[]>('/messages/threads');
  },

  getThread(listingId: number, otherUserId: number): Promise<Message[]> {
    return request<Message[]>(`/messages?listingId=${listingId}&otherUserId=${otherUserId}`);
  },

  sendMessage(input: { recipient_id: number; listing_id: number; body: string }): Promise<Message> {
    return request<Message>('/messages', { method: 'POST', body: JSON.stringify(input) });
  },

  /** Marks the *other* person's messages in this thread as read. */
  markThreadRead(listingId: number, otherUserId: number): Promise<{ marked_read: number }> {
    return request<{ marked_read: number }>('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ listing_id: listingId, other_user_id: otherUserId }),
    });
  },

  unreadCount(): Promise<{ count: number }> {
    return request<{ count: number }>('/messages/unread-count');
  },

  /**
   * Note there is no reviewee here. The server derives who is being reviewed
   * from the order, so a client cannot review someone it never traded with.
   */
  createReview(input: { order_id: number; rating: number; body: string | null }): Promise<Review> {
    return request<Review>('/reviews', { method: 'POST', body: JSON.stringify(input) });
  },

  /** Public — a buyer can read a seller's reputation before logging in. */
  getUserReviews(userId: number): Promise<UserReviews> {
    return request<UserReviews>(`/users/${userId}/reviews`);
  },

  /** Whether a user is online now and when they were last seen. Powers the chat presence line. */
  getPresence(userId: number): Promise<Presence> {
    return request<Presence>(`/users/${userId}/presence`);
  },

  /**
   * The caller's own profile. There is no `/users/:id` edit route: the server
   * always acts on whoever the token names, so no id can be tampered with.
   */
  getProfile(): Promise<User> {
    return request<User>('/users/me');
  },

  /**
   * PATCH semantics. An omitted key is left alone; an explicit `null` clears
   * that field. `display_name` cannot be cleared — the server rejects it.
   */
  updateProfile(input: UpdateProfileInput): Promise<User> {
    return request<User>('/users/me', { method: 'PATCH', body: JSON.stringify(input) });
  },

  /**
   * A short-lived signature authorising one direct-to-Cloudinary upload into one
   * folder. The API secret stays on the server; this is what stands in for it.
   * See lib/upload.ts, which is the only caller.
   */
  uploadSignature(folder: UploadFolder): Promise<UploadSignature> {
    return request<UploadSignature>(`/uploads/signature?folder=${folder}`);
  },
};
