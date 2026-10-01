// Server-only clinic email roster. Do not import from client components —
// app/data/providers.json is the public client catalog and must stay email-free.

const PROVIDER_CLINIC_EMAILS: Record<string, string> = {
  'prv-001': 'amara.johnson@clinic.skintwin.ai',
  'prv-002': 'temi.okonkwo@clinic.skintwin.ai',
  'prv-003': 'chioma.adeyemi@clinic.skintwin.ai',
  'prv-004': 'ngozi.eze@clinic.skintwin.ai',
};

export function providerClinicEmail(providerId: string | undefined | null) {
  if (!providerId) {
    return undefined;
  }
  return PROVIDER_CLINIC_EMAILS[providerId];
}
