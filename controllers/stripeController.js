const { User, Plan } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('express-async-handler');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Checkout Session
exports.createCheckoutSession = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) throw new ApiError(404, 'User not found');

  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) throw new ApiError(400, 'Invalid plan selected');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1
      }
    ],
    customer_email: user.email,
    metadata: {
      userId: user._id.toString(),
      planSlug: plan.slug
    },
    success_url: `${process.env.CLIENT_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/subscribe`
  });

  res.status(200).json(
    new ApiResponse(200, { url: session.url }, 'Checkout session created')
  );
});

// Create Customer Portal
exports.createCustomerPortal = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('subscription');

  if (!user?.subscription?.stripeCustomerId) {
    throw new ApiError(404, 'Stripe customer not found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.subscription.stripeCustomerId,
    return_url: `${process.env.CLIENT_URL}/dashboard`,
  });

  res.status(200).json(
    new ApiResponse(200, { url: session.url }, 'Billing portal created')
  );
});

// Get subscription details
exports.getSubscription = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('subscription');

  if (!user?.subscription) {
    throw new ApiError(404, 'No subscription found');
  }

  res.status(200).json(
    new ApiResponse(200, user.subscription, 'Subscription details retrieved')
  );
});

// Cancel subscription
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('subscription');

  if (!user?.subscription?.stripeSubscriptionId) {
    throw new ApiError(404, 'No active subscription found');
  }

  const subscription = await stripe.subscriptions.update(
    user.subscription.stripeSubscriptionId,
    { cancel_at_period_end: true }
  );

  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: user.subscription.stripeSubscriptionId },
    {
      cancelAtPeriodEnd: true,
      canceledAt: new Date()
    }
  );

  res.status(200).json(
    new ApiResponse(200, { subscription }, 'Subscription will be canceled at period end')
  );
});

// Get billing history
exports.getBillingHistory = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('subscription');

  if (!user?.subscription?.stripeCustomerId) {
    throw new ApiError(404, 'No subscription found');
  }

  const invoices = await stripe.invoices.list({
    customer: user.subscription.stripeCustomerId,
    limit: 10
  });

  res.status(200).json(
    new ApiResponse(200, { invoices: invoices.data }, 'Billing history retrieved')
  );
});
