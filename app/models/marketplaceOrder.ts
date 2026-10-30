import mongoose from 'mongoose';

const marketplaceOrderSchemaName = 'MarketplaceOrder';

const MarketplaceOrderSchema = new mongoose.Schema(
  {
    id: {type: String, required: true, unique: true},
    sellerAccountId: {type: String, required: true},
    buyerAccountId: {type: String, required: true},
    checkoutSessionId: String,
    checkoutUrl: String,
    currency: String,
    merchandiseTotal: Number,
    amountTotal: Number,
    paymentStatus: {type: String, default: 'unpaid'},
    lines: [
      {
        serviceId: String,
        name: String,
        quantity: Number,
        unitAmount: Number,
      },
    ],
    mismatch: String,
    idempotencyKey: {type: String, index: true},
    createdAt: String,
    updatedAt: String,
  },
  {collection: 'marketplace_orders'}
);

MarketplaceOrderSchema.index({sellerAccountId: 1, checkoutSessionId: 1});

const MarketplaceOrder =
  mongoose.models[marketplaceOrderSchemaName] ||
  mongoose.model(marketplaceOrderSchemaName, MarketplaceOrderSchema);

export default MarketplaceOrder;
