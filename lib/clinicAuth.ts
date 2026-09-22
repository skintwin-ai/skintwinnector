import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';

export async function requireOperatorAccount() {
  const session = await getServerSession(authOptions);
  const stripeAccountId = session?.user?.stripeAccountId;
  if (!stripeAccountId) {
    return null;
  }
  return stripeAccountId;
}

export function authorizePlatformKey(header: string | null) {
  const expected = process.env.SKINTWIN_PLATFORM_KEY;
  if (!expected || !header) {
    return false;
  }
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === expected;
}
