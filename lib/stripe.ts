import Stripe from 'stripe';
import {createLocalStripe, isLocalStripeKey} from '@/lib/localStripeRail';

export const latestApiVersion = '2026-08-26.preview';

export const stripe = (
  isLocalStripeKey()
    ? createLocalStripe()
    : new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: latestApiVersion,
      })
) as Stripe;
