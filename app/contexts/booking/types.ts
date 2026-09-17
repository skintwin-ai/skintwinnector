export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  price: number;
  currency: string;
  providerTypes: string[];
  requiresConsultation: boolean;
  addOns: string[];
  image: string;
}

export interface Provider {
  id: string;
  name: string;
  title: string;
  type: string;
  bio: string;
  specializations: string[];
  certifications: string[];
  availability: Record<string, {start: string; end: string} | null>;
  image: string;
}

export interface ServiceSelection {
  serviceId: string;
  quantity: number;
  addOns: string[];
}

export interface Appointment {
  date: string;
  startTime: string;
  endTime: string;
  providerId: string;
  roomId?: string;
  totalDurationMinutes: number;
}

export interface Client {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consentAccepted: boolean;
  intakeCompleted: boolean;
}

export interface CheckoutState {
  invoiceId: string;
  offlineReference: string;
  status: 'idle' | 'creating' | 'pending' | 'paid' | 'failed';
  error?: string;
}

export interface BookingState {
  services: ServiceSelection[];
  appointment: Appointment | null;
  client: Client | null;
  checkout: CheckoutState;
}

export interface BookingContextValue extends BookingState {
  addService: (serviceId: string, addOns?: string[]) => void;
  removeService: (serviceId: string) => void;
  updateServiceQuantity: (serviceId: string, quantity: number) => void;
  clearServices: () => void;
  setAppointment: (appointment: Appointment) => void;
  clearAppointment: () => void;
  setClient: (client: Client) => void;
  updateClientConsent: (accepted: boolean) => void;
  updateIntakeStatus: (completed: boolean) => void;
  clearClient: () => void;
  setCheckoutStatus: (status: CheckoutState['status']) => void;
  setInvoiceDetails: (invoiceId: string, offlineReference: string) => void;
  setCheckoutError: (error: string) => void;
  clearCheckout: () => void;
  resetBooking: () => void;
  getTotalPrice: (servicesList: Service[]) => number;
  getTotalDuration: (servicesList: Service[]) => number;
}
