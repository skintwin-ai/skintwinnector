import mongoose from 'mongoose';

const provisionedServiceSchemaName = 'ProvisionedService';

const ProvisionedServiceSchema = new mongoose.Schema(
  {
    operatorAccountId: {type: String, required: true},
    id: {type: String, required: true},
    name: String,
    category: String,
    description: String,
    durationMinutes: Number,
    bufferMinutes: Number,
    price: Number,
    usdChargeCents: Number,
    currency: String,
    providerTypes: [String],
    requiresConsultation: Boolean,
    addOns: [String],
    image: String,
    published: Boolean,
    createdAt: String,
    updatedAt: String,
  },
  {collection: 'provisioned_services'}
);

ProvisionedServiceSchema.index(
  {operatorAccountId: 1, id: 1},
  {unique: true}
);

const ProvisionedService =
  mongoose.models[provisionedServiceSchemaName] ||
  mongoose.model(provisionedServiceSchemaName, ProvisionedServiceSchema);

export default ProvisionedService;
