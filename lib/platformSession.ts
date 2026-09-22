import {createHmac, timingSafeEqual} from 'node:crypto';
import {canonicalEmail} from '@/lib/platformIdentity';

export type PlatformActor = {
  email: string;
  name: string;
  role: 'therapist' | 'operator' | 'platform';
  source: string;
};

type SessionPayload = PlatformActor & {v: 1; exp: number};

export const PLATFORM_SESSION_PREFIX = 'stsess.';

function platformSecret() {
  return process.env.SKINTWIN_PLATFORM_KEY || '';
}

function signBody(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issuePlatformSession(
  actor: PlatformActor,
  ttlMs = 12 * 60 * 60 * 1000
) {
  const secret = platformSecret();
  if (!secret) {
    throw new Error('SKINTWIN_PLATFORM_KEY is not configured');
  }
  const payload: SessionPayload = {
    v: 1,
    email: canonicalEmail(actor.email),
    name: actor.name,
    role: actor.role,
    source: actor.source,
    exp: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${PLATFORM_SESSION_PREFIX}${body}.${signBody(body, secret)}`;
}

export function verifyPlatformSession(
  token: string | null | undefined
): PlatformActor | null {
  const secret = platformSecret();
  if (!secret || !token) {
    return null;
  }
  const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
  if (safeEqual(raw, secret)) {
    return {
      email: 'platform@skintwin.ai',
      name: 'SkinTwin Platform',
      role: 'platform',
      source: 'platform-key',
    };
  }
  if (!raw.startsWith(PLATFORM_SESSION_PREFIX)) {
    return null;
  }
  const rest = raw.slice(PLATFORM_SESSION_PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 1) {
    return null;
  }
  const body = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  if (!safeEqual(sig, signBody(body, secret))) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      payload.v !== 1 ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return {
      email: canonicalEmail(payload.email),
      name: payload.name,
      role: payload.role,
      source: payload.source,
    };
  } catch {
    return null;
  }
}

export function operatorFromPlatformActor(actor: PlatformActor) {
  return {
    id: `platform:${actor.email}`,
    email: actor.email,
    stripeAccountId: '',
    primaryColor: null,
    companyName: actor.name,
    companyLogoUrl: null,
    setup: false,
  };
}
