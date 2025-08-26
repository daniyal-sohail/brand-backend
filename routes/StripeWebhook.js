const express = require('express');
const Stripe = require('stripe');
const { Subscription, User } = require('../models');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Helper function to safely cast timestamp
const toDateOrUndefined = (timestamp) =>
  timestamp ? new Date(timestamp * 1000) : undefined;

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const userId = session.metadata.userId;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          const sub = await stripe.subscriptions.retrieve(subscriptionId);

          const newSub = await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: subscriptionId },
            {
              userId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              status: sub.status,
              planName: sub.items.data[0].price.nickname || 'monthly_basic',
              startDate: toDateOrUndefined(sub.start_date),
              currentPeriodEnd: toDateOrUndefined(sub.current_period_end),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
            { upsert: true, new: true }
          );

          await User.findByIdAndUpdate(userId, { subscription: newSub._id });
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;

          await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: sub.id },
            {
              status: sub.status,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              currentPeriodEnd: toDateOrUndefined(sub.current_period_end),
              canceledAt: toDateOrUndefined(sub.canceled_at),
              endDate: toDateOrUndefined(sub.ended_at),
            }
          );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;

          await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: sub.id },
            {
              status: 'canceled',
              canceledAt: new Date(),
              endDate: new Date(),
            }
          );
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;

          if (subscriptionId) {
            await Subscription.findOneAndUpdate(
              { stripeSubscriptionId: subscriptionId },
              {
                status: 'past_due',
                lastPaymentFailure: new Date(),
                paymentFailureReason: invoice.last_payment_error?.message || 'Payment failed'
              }
            );
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;

          if (subscriptionId) {
            await Subscription.findOneAndUpdate(
              { stripeSubscriptionId: subscriptionId },
              {
                status: 'active',
                lastPaymentSuccess: new Date(),
                $unset: { lastPaymentFailure: 1, paymentFailureReason: 1 }
              }
            );
          }
          break;
        }
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook processing error:', err);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

module.exports = router;