// models/Subscription.js
const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stripeCustomerId: {
    type: String,
    required: true,
    index: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  planName: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: [
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    ],
    default: 'incomplete',
    index: true
  },
  startDate: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  canceledAt: { type: Date },
  endDate: { type: Date },
  latestInvoiceUrl: { type: String },
  lastPaymentSuccess: { type: Date },
  lastPaymentFailure: { type: Date },
  paymentFailureReason: { type: String },

  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Compound index for admin filters (e.g., list active subs by plan)
SubscriptionSchema.index({ planName: 1, status: 1 });
SubscriptionSchema.index({ createdAt: -1 }); // Latest subscriptions
SubscriptionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);