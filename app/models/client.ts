import mongoose from 'mongoose';

const clinicClientSchemaName = 'ClinicClient';

const ClinicClientSchema = new mongoose.Schema(
  {
    id: String,
    operatorAccountId: {type: String, required: true, index: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    email: {type: String, required: true},
    phone: String,
    consentAccepted: {type: Boolean, default: false},
    intakeCompleted: {type: Boolean, default: false},
    createdAt: String,
    updatedAt: String,
  },
  {collection: 'clinic_clients'}
);

ClinicClientSchema.index({operatorAccountId: 1, email: 1}, {unique: true});

const ClinicClient =
  mongoose.models[clinicClientSchemaName] ||
  mongoose.model(clinicClientSchemaName, ClinicClientSchema);

export default ClinicClient;
