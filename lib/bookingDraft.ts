import type {
  Appointment,
  Client,
  ServiceSelection,
} from '@/app/contexts/booking/types';

export const BOOKING_DRAFT_KEY_PREFIX = 'skintwin.bookingDraft.';

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

export function bookingDraftKey(sessionId: string): string {
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

export function deleteBookingDraft(sessionId: string): void {
  const store = storage();
  if (!store || !sessionId) {
    return;
  }
  store.removeItem(bookingDraftKey(sessionId));
}
