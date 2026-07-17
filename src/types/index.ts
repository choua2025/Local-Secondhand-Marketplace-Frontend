/**
 * Mirrors of the server's DTOs. The two apps deliberately keep separate copies
 * — nothing imports across the client/server boundary.
 *
 * One systematic difference: the server types timestamps as `Date`, but JSON
 * has no date type, so everything arrives here as an ISO-8601 `string`.
 *
 * `price` is a string on both sides. That is not an oversight — see the note in
 * server/src/db.ts. Money lives in NUMERIC(10,2) and is never parsed into a
 * float. Format it for display; do not do arithmetic on it.
 */

export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';
export type ListingStatus = 'active' | 'pending' | 'sold' | 'removed';

/** Human-readable labels for the condition enum, for use in the UI. */
export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  for_parts: 'For parts',
};

/** The authenticated user. Mirrors the server's PublicUser — never a hash. */
export interface User {
  id: number;
  email: string;
  display_name: string;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  is_active: boolean;
  /** When they last had a socket open. null if never. */
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SellerSummary {
  id: number;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  rating_average: number | null;
  rating_count: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

export interface Listing {
  id: number;
  title: string;
  price: string;
  condition: ListingCondition;
  city: string | null;
  created_at: string;
  cover_image_url: string | null;
  seller: SellerSummary;
}

export interface ListingImage {
  id: number;
  url: string;
  position: number;
}

export interface ListingDetail {
  id: number;
  title: string;
  description: string | null;
  price: string;
  condition: ListingCondition;
  status: ListingStatus;
  city: string | null;
  created_at: string;
  updated_at: string;
  /** Times the page has been opened. Owner's own opens are not counted. */
  view_count: number;
  images: ListingImage[];
  seller: SellerSummary;
  category: Category | null;
}

/** A listing as its own seller sees it — carries `status`, which browse never returns. */
export interface OwnListing {
  id: number;
  title: string;
  price: string;
  condition: ListingCondition;
  status: ListingStatus;
  city: string | null;
  created_at: string;
  view_count: number;
  cover_image_url: string | null;
}

export interface CreateListingInput {
  title: string;
  description: string | null;
  /** A decimal string like "34.50". Never a number — see the note at the top. */
  price: string;
  condition: ListingCondition;
  category_id: number | null;
  image_urls: string[];
}

/**
 * PATCH: every field optional, and an omitted key is left alone.
 *
 * `image_urls` is all-or-nothing. Send it and the gallery becomes exactly that
 * list, in that order, with the first as the cover; any Cloudinary photo it
 * drops is deleted from storage. Omit it and the photos are untouched.
 */
export interface UpdateListingInput {
  title?: string;
  description?: string | null;
  price?: string;
  condition?: ListingCondition;
  category_id?: number | null;
  image_urls?: string[];
}

/**
 * Editing your own profile. `email` is deliberately absent — changing it is an
 * identity change needing confirmation at the new address.
 *
 * `null` clears a field. `display_name` is NOT NULL on the server and cannot be
 * cleared, only changed.
 */
export interface UpdateProfileInput {
  display_name?: string;
  city?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

/** The folders the server will sign an upload into. */
export type UploadFolder = 'listings' | 'avatars';

/**
 * What the server hands back to authorise one upload. `signature` covers
 * `folder` and `timestamp`; changing either after signing invalidates it.
 *
 * `api_key` and `cloud_name` are public — they appear in every delivery URL.
 * The API *secret* never leaves the server, which is the whole point.
 */
export interface UploadSignature {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: UploadFolder;
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  pending: 'Sale pending',
  sold: 'Sold',
  removed: 'Removed',
};

export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded';
export type OrderRole = 'buyer' | 'seller';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export interface OrderSummary {
  id: number;
  listing_id: number;
  listing_title: string;
  listing_cover_url: string | null;
  /** The price when the order was placed. Not the listing's price today. */
  amount: string;
  status: OrderStatus;
  created_at: string;
  completed_at: string | null;
  role: OrderRole;
  counterparty_name: string;
  reviewed_by_me: boolean;
}

export interface Review {
  id: number;
  order_id: number;
  reviewer_id: number;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
  rating: number;
  body: string | null;
  created_at: string;
}

export interface UserReviews {
  reviews: Review[];
  /** null when never reviewed — not 0, which would render as one star. */
  average: number | null;
  count: number;
}

/** An order is reviewable once it has actually concluded, refunds included. */
export function isReviewable(status: OrderStatus): boolean {
  return status === 'completed' || status === 'refunded';
}

export interface Order {
  id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  amount: string;
  status: OrderStatus;
  created_at: string;
  completed_at: string | null;
}

export interface Message {
  id: number;
  listing_id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
}

/** One conversation, keyed by (listing_id, other_user_id). */
export interface ThreadSummary {
  listing_id: number;
  listing_title: string;
  listing_cover_url: string | null;
  other_user_id: number;
  other_user_name: string;
  other_user_avatar_url: string | null;
  last_message_body: string;
  last_message_at: string;
  last_message_mine: boolean;
  unread_count: number;
}

export interface BrowseResult {
  items: Listing[];
  page: number;
  hasMore: boolean;
}

/** The filters BrowsePage owns and passes to the API. */
export interface BrowseFilters {
  q: string;
  category: string | null;
  city: string | null;
}

/** Whether a user is connected right now, and when they last were. */
export interface Presence {
  online: boolean;
  /** ISO string, or null if they have never connected a socket. */
  last_seen_at: string | null;
}

/**
 * An event pushed down the WebSocket. Mirrors the server's RealtimeEvent union
 * (see server realtime/hub) — `type` is the tag a listener switches on. Adding a
 * member here and there keeps the two ends honest through the compiler.
 *
 *   message:new  — a new message in a conversation you are part of.
 *   message:read — the person you wrote to has read your messages (read receipt).
 *   presence     — someone you have a thread with came online or went offline.
 */
export type RealtimeEvent =
  | { type: 'message:new'; payload: Message }
  | { type: 'message:read'; payload: { listing_id: number; reader_id: number } }
  | { type: 'presence'; payload: { user_id: number; online: boolean; last_seen_at: string | null } };
