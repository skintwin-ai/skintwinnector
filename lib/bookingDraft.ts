import type {
  Appointment,
  Client,
  ServiceSelection,
} from '@/app/contexts/booking/types';

const BOOKING_DRAFT_KEY_PREFIX = 'skintwin.bookingDraft.';
const ACTIVE_DRAFT_ID_KEY = 'skintwin.bookingDraftId';

export type BookingDraft = {
  draftId: string;
  sessionId: string;
  retryAttempt: number;
  services: ServiceSelection[];
  appointment: Appointment;
  client: Client;
};

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function bookingDraftKey(sessionId: string): string {
  return `${BOOKING_DRAFT_KEY_PREFIX}${sessionId}`;
}

export function persistBookingDraft(
  sessionId: string,
  draft: BookingDraft
): void {
  const store = storage();
  if (!store || !sessionId) {
    return;
  }
  store.setItem(bookingDraftKey(sessionId), JSON.stringify(draft));
}

export function loadBookingDraft(sessionId: string): BookingDraft | null {
  const store = storage();
  if (!store || !sessionId) {
    return null;
  }
  try {
    const raw = store.getItem(bookingDraftKey(sessionId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function getOrCreateDraftId(): string {
  const store = storage();
  const existing = store?.getItem(ACTIVE_DRAFT_ID_KEY);
  if (existing) {
    return existing;
  }
  const draftId = crypto.randomUUID();
  store?.setItem(ACTIVE_DRAFT_ID_KEY, draftId);
  return draftId;
}

export function clearActiveDraftId(): void {
  storage()?.removeItem(ACTIVE_DRAFT_ID_KEY);
}

export function deleteBookingDraft(sessionId: string): void {
  const store = storage();
  if (!store || !sessionId) {
    return;
  }
  store.removeItem(bookingDraftKey(sessionId));
}
