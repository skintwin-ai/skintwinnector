import {NextResponse} from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'skintwinnector',
    integrations: {
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      mongo: Boolean(process.env.MONGO_URI),
      salon: Boolean(process.env.SKINTWIN_SALON_URL),
      suite: Boolean(process.env.REGIMA_SUITE_URL),
      lms: Boolean(process.env.REGIMA_LMS_URL),
    },
  });
}
