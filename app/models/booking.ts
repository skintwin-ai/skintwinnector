import mongoose from 'mongoose';

const clinicBookingSchemaName = 'ClinicBooking';

const ClinicBookingSchema = new mongoose.Schema(
  {
    id: String,
    operatorAccountId: {type: String, required: true, index: true},
    draftId: {type: String, required: true},
    checkoutSessionId: {type: String, required: true, unique: true},
    paymentIntentId: String,
    paymentStatus: {type: String, default: 'unpaid'},
    amountTotal: Number,
    currency: String,
    displayTotal: Number,
    source: {type: String, default: 'skintwinnector'},
    services: [
      {
        serviceId: String,
        quantity: Number,
        addOns: [String],
      },
    ],
    appointment: {
      date: String,
      startTime: String,
      endTime: String,
      providerId: String,
      roomId: String,
      totalDurationMinutes: Number,
    },
    client: {
      id: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      consentAccepted: Boolean,
      intakeCompleted: Boolean,
    },
    createdAt: String,
    updatedAt: String,
  },
  {collection: 'clinic_bookings'}
);

ClinicBookingSchema.index({operatorAccountId: 1, draftId: 1});
ClinicBookingSchema.index({operatorAccountId: 1, 'appointment.date': 1});

const ClinicBooking =
  mongoose.models[clinicBookingSchemaName] ||
  mongoose.model(clinicBookingSchemaName, ClinicBookingSchema);

export default ClinicBooking;
