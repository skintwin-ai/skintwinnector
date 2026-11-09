import {isUiPreview} from '@/lib/uiPreview';

/** Client-safe flag: embedded Stripe Connect is skipped when local rails are active. */
export const isLocalStripeRail =
  process.env.NEXT_PUBLIC_LOCAL_STRIPE_RAIL === '1' || isUiPreview();
