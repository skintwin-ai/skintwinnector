export function canonicalEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailFromUsername(username: string | undefined | null) {
  const raw = (username || 'therapist').trim();
  if (raw.includes('@')) {
    return canonicalEmail(raw);
  }
  return `${canonicalEmail(raw)}@skintwin.ai`;
}
