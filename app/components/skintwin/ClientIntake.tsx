'use client';

import {useEffect, useRef, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import Container from '@/app/components/Container';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import {persistBookingDraft} from '@/lib/bookingDraft';

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone: string) => /^\+?[\d\s-]{10,}$/.test(phone);

const ClientIntake = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const booking = useBooking();
  const {clearAppointment} = booking;
  const isStandaloneIntake = searchParams.get('standalone') === '1';
  const hasConfirmableBooking = Boolean(
    !isStandaloneIntake && booking.appointment && booking.services.length > 0
  );
  const [formData, setFormData] = useState({
    firstName: booking.client?.firstName || '',
    lastName: booking.client?.lastName || '',
    email: booking.client?.email || '',
    phone: booking.client?.phone || '',
    consentAccepted: booking.client?.consentAccepted || false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [clientFound, setClientFound] = useState(false);
  const checkoutInFlight = useRef(false);
  const isCreatingCheckout = booking.checkout.status === 'creating';

  useEffect(() => {
    if (!isStandaloneIntake || !booking.appointment) {
      return;
    }
    clearAppointment();
  }, [booking.appointment, clearAppointment, isStandaloneIntake]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {name, value, type, checked} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({...prev, [name]: ''}));
    }
  };

  const handleLookup = async () => {
    if (!lookupEmail || !validateEmail(lookupEmail)) {
      setErrors({lookupEmail: 'Please enter a valid email address'});
      return;
    }

    setIsLookingUp(true);
    setErrors({});

    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (lookupEmail === 'adaeze.obi@example.com') {
        setFormData({
          firstName: 'Adaeze',
          lastName: 'Obi',
          email: 'adaeze.obi@example.com',
          phone: '+2348012345678',
          consentAccepted: true,
        });
        setClientFound(true);
      } else {
        setClientFound(false);
        setErrors({lookupEmail: 'No client found with this email'});
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.firstName.trim())
      nextErrors.firstName = 'First name is required';
    if (!formData.lastName.trim())
      nextErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) nextErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) {
      nextErrors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required';
    else if (!validatePhone(formData.phone)) {
      nextErrors.phone = 'Please enter a valid phone number';
    }
    if (!formData.consentAccepted) {
      nextErrors.consent = 'You must accept the consent to continue';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const client = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      consentAccepted: formData.consentAccepted,
      intakeCompleted: true,
    };
    booking.setClient(client);
    if (hasConfirmableBooking) {
      if (checkoutInFlight.current || isCreatingCheckout) {
        return;
      }
      checkoutInFlight.current = true;
      booking.setCheckoutStatus('creating');
      const draftId = crypto.randomUUID();
      try {
        const response = await fetch('/api/bookings/create_checkout_session', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            draftId,
            services: booking.services,
            appointment: booking.appointment,
            client,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.checkoutUrl || !payload.sessionId) {
          throw new Error(payload.error || 'Unable to start checkout');
        }
        persistBookingDraft(payload.sessionId, {
          draftId,
          sessionId: payload.sessionId,
          retryAttempt: 1,
          services: booking.services,
          appointment: booking.appointment!,
          client,
        });
        booking.setCheckoutSessionId(payload.sessionId);
        booking.setCheckoutStatus('pending');
        window.location.assign(payload.checkoutUrl);
      } catch (error: any) {
        checkoutInFlight.current = false;
        booking.setCheckoutError(error.message || 'Unable to start checkout');
      }
      return;
    }
    if (booking.appointment) {
      booking.clearAppointment();
    }
    router.push('/clients');
  };

  return (
    <div className="space-y-4">
      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Returning client?</h2>
        <p className="text-sm text-subdued">
          Enter an email to prefill client information. Try
          adaeze.obi@example.com.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="Enter client email"
            data-testid="lookup-email"
          />
          <Button
            type="button"
            onClick={handleLookup}
            disabled={isLookingUp}
            data-testid="lookup-client"
          >
            {isLookingUp ? 'Looking up...' : 'Look up'}
          </Button>
        </div>
        {errors.lookupEmail && (
          <p className="text-sm text-red-400" data-testid="error-lookupEmail">
            {errors.lookupEmail}
          </p>
        )}
        {clientFound && (
          <p
            className="text-sm text-success-foreground"
            data-testid="client-found"
          >
            Welcome back. Client details have been prefilled.
          </p>
        )}
      </Container>

      <Container className="panel-accent-top border-[color:var(--hairline)]">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="client-form"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                data-testid="first-name"
              />
              {errors.firstName && (
                <p
                  className="text-sm text-red-400"
                  data-testid="error-firstName"
                >
                  {errors.firstName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                data-testid="last-name"
              />
              {errors.lastName && (
                <p
                  className="text-sm text-red-400"
                  data-testid="error-lastName"
                >
                  {errors.lastName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                data-testid="email"
              />
              {errors.email && (
                <p className="text-sm text-red-400" data-testid="error-email">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+234..."
                data-testid="phone"
              />
              {errors.phone && (
                <p className="text-sm text-red-400" data-testid="error-phone">
                  {errors.phone}
                </p>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-subdued">
            <input
              type="checkbox"
              name="consentAccepted"
              checked={formData.consentAccepted}
              onChange={handleInputChange}
              className="mt-1"
              data-testid="consent-checkbox"
            />
            <span>
              I consent to receive treatment and confirm the information
              provided is accurate.
            </span>
          </label>
          {errors.consent && (
            <p className="text-sm text-red-400" data-testid="error-consent">
              {errors.consent}
            </p>
          )}
          {booking.checkout.status === 'failed' && booking.checkout.error && (
            <p
              className="text-sm text-red-400"
              role="alert"
              aria-live="assertive"
              data-testid="error-checkout"
            >
              {booking.checkout.error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                router.push(hasConfirmableBooking ? '/bookings' : '/clients')
              }
              data-testid="back-to-booking"
            >
              {hasConfirmableBooking ? 'Back to scheduling' : 'Back to clients'}
            </Button>
            <Button
              type="submit"
              className="btn-cobalt"
              data-testid="continue-to-checkout"
              disabled={isCreatingCheckout}
              aria-busy={isCreatingCheckout}
            >
              {isCreatingCheckout
                ? 'Redirecting to payment'
                : hasConfirmableBooking
                  ? 'Continue to payment'
                  : 'Save intake'}
            </Button>
          </div>
        </form>
      </Container>
    </div>
  );
};

export default ClientIntake;
