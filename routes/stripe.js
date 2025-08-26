const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  createCustomerPortal,
  getSubscription,
  cancelSubscription,
  getBillingHistory
} = require('../controllers/stripeController');
const { protect } = require('../middleware/authMiddleware');
// Create Checkout Session
router.post('/checkout-session', protect, createCheckoutSession);
// Create Customer Portal Session
router.post('/customer-portal', protect, createCustomerPortal);
// Get subscription details
router.get('/subscription', protect, getSubscription);
// Cancel subscription
router.post('/cancel-subscription', protect, cancelSubscription);
// Get billing history
router.get('/billing-history', protect, getBillingHistory);

module.exports = router;