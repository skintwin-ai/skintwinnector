export const PROVIDER_TYPES = ['esthetician', 'specialist'] as const;

export const PROVIDER_TYPE_LABELS: Record<
  (typeof PROVIDER_TYPES)[number],
  string
> = {
  esthetician: 'Esthetician',
  specialist: 'Specialist',
};

export function isProviderTypeList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        (PROVIDER_TYPES as readonly string[]).includes(item)
    )
  );
}
