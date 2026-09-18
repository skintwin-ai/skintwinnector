import type {Service} from '@/app/contexts/booking/types';

export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  facials: 'Facials',
  treatments: 'Treatments',
  consultations: 'Consultations',
  packages: 'Packages',
  'add-ons': 'Add-Ons',
};

export const SERVICE_CATEGORIES = [
  'all',
  'facials',
  'treatments',
  'consultations',
  'packages',
  'add-ons',
] as const;

export function formatCurrency(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAppointmentDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getCategoryLabel(category: string) {
  return SERVICE_CATEGORY_LABELS[category] || category;
}

export function serviceById(services: Service[], id: string) {
  return services.find((service) => service.id === id);
}
