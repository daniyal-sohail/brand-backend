const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createOrGetStripePriceId = async (planName, amount) => {
  const product = await stripe.products.create({ name: 'Auto Post MD' });

  const price = await stripe.prices.create({
    unit_amount: amount,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: planName,
    product: product.id
  });

  return price.id;
};

module.exports = { createOrGetStripePriceId };
