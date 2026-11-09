import {NextResponse} from 'next/server';

const DEFAULT_PEERS = {
  salon: 'http://127.0.0.1:8000',
  suite: 'http://127.0.0.1:3001',
  lms: 'http://127.0.0.1:5000',
} as const;

function isLiveStripeKey(key: string | undefined): boolean {
  if (!key) return false;
  return !/placeholder|changeme|your.?key|sk_test_\*+/i.test(key);
}

async function isReachable(baseUrl: string): Promise<boolean> {
  const url = baseUrl.replace(/\/$/, '');
  const probes = [`${url}/api/health`, `${url}/health`, `${url}/`];
  for (const probe of probes) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(probe, {signal: controller.signal, method: 'GET'});
      clearTimeout(timeout);
      if (res.status > 0 && res.status < 500) return true;
    } catch {
      // try next probe path
    }
  }
  return false;
}

export async function GET() {
  const salonUrl = process.env.SKINTWIN_SALON_URL || DEFAULT_PEERS.salon;
  const suiteUrl = process.env.REGIMA_SUITE_URL || DEFAULT_PEERS.suite;
  const lmsUrl = process.env.REGIMA_LMS_URL || DEFAULT_PEERS.lms;

  const [salonUp, suiteUp, lmsUp] = await Promise.all([
    isReachable(salonUrl),
    isReachable(suiteUrl),
    isReachable(lmsUrl),
  ]);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const liveStripe = isLiveStripeKey(stripeKey);

  return NextResponse.json({
    ok: true,
    service: 'skintwinnector',
    integrations: {
      stripe: liveStripe,
      stripeMode: liveStripe ? 'live' : 'local',
      mongo: Boolean(process.env.MONGO_URI),
      salon: salonUp,
      suite: suiteUp,
      lms: lmsUp,
    },
    peers: {
      salon: {url: salonUrl, configured: Boolean(process.env.SKINTWIN_SALON_URL), reachable: salonUp},
      suite: {url: suiteUrl, configured: Boolean(process.env.REGIMA_SUITE_URL), reachable: suiteUp},
      lms: {url: lmsUrl, configured: Boolean(process.env.REGIMA_LMS_URL), reachable: lmsUp},
    },
    meshReady: salonUp && suiteUp && lmsUp,
  });
}
