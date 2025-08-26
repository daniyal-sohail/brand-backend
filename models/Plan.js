const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String },
  amount: { type: Number, required: true },
  stripePriceId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  features: [{ type: String }],
}, { timestamps: true });

PlanSchema.index({ isActive: 1 });

const Plan = mongoose.model('Plan', PlanSchema);

module.exports = { Plan };
