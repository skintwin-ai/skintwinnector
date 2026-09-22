import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {verifyPlatformSession} from '@/lib/platformSession';

export async function requireOperatorAccount() {
  const session = await getServerSession(authOptions);
  const stripeAccountId = session?.user?.stripeAccountId;
  if (!stripeAccountId) {
    return null;
  }
  return stripeAccountId;
}

export function authorizePlatformKey(header: string | null) {
  return Boolean(verifyPlatformSession(header));
}
