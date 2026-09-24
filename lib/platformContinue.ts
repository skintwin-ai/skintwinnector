const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5000',
];

export function platformContinueOrigins(origin: string) {
  return new Set(
    [
      origin,
      process.env.NEXTAUTH_URL,
      process.env.REGIMA_LMS_URL,
      process.env.REGIMA_SUITE_URL,
      process.env.SKINTWINNECTOR_URL,
      ...DEFAULT_ORIGINS,
    ]
      .filter(Boolean)
      .map((value) => {
        try {
          return new URL(value as string).origin;
        } catch {
          return '';
        }
      })
      .filter(Boolean)
  );
}

export function resolvePlatformContinue(
  raw: string | null | undefined,
  origin: string,
  fallbackPath = '/home'
) {
  const fallback = fallbackPath.startsWith('http')
    ? fallbackPath
    : `${origin}${fallbackPath}`;
  if (!raw) {
    return fallback;
  }
  try {
    const url = new URL(raw, origin);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      platformContinueOrigins(origin).has(url.origin)
    ) {
      return url.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function isSameOriginContinue(target: string, origin: string) {
  try {
    return new URL(target).origin === origin;
  } catch {
    return false;
  }
}

export function sameOriginPath(target: string) {
  const url = new URL(target);
  return `${url.pathname}${url.search}${url.hash}`;
}
