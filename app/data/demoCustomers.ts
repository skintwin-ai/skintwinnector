/**
 * Shared demo customer profiles used when generating test charges and
 * Checkout Sessions for connected accounts.
 */
export const DEMO_CUSTOMERS = [
  {
    email: 'hydrating_facial@stripe.com',
    name: 'Amara Okafor',
    description: 'Hydrating facial treatment',
  },
  {
    email: 'chemical_peel@stripe.com',
    name: 'Liam Chen',
    description: 'Chemical peel session',
  },
  {
    email: 'microdermabrasion@stripe.com',
    name: 'Sofia Reyes',
    description: 'Microdermabrasion and exfoliation treatment',
  },
  {
    email: 'acne_treatment@stripe.com',
    name: 'Noah Patel',
    description: 'Acne treatment and extraction',
  },
  {
    email: 'skin_analysis@stripe.com',
    name: 'Ava Nguyen',
    description: 'Full skin analysis and consultation',
  },
] as const;

export function pickDemoCustomer() {
  return DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)];
}
