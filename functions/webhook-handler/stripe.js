/**
 * Example Stripe Webhook Handler
 *
 * This handler validates the Stripe signature and logs the event type.
 * Replace the secret and event handling logic as needed.
 */

export default async function handler(req, res) {
  const { logger } = req;
  const stripeSecret = req.env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret) {
    return res.status(400).json({
      error: 'Stripe webhook secret not configured',
      timestamp: new Date().toISOString(),
    });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(401).json({
      error: 'Missing Stripe signature',
      timestamp: new Date().toISOString(),
    });
  }

  let event;
  try {
    const body = req.bodyRaw || req.body;
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(
      req.env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    );

    event = stripe.webhooks.constructEvent(
      typeof body === 'string' ? body : JSON.stringify(body),
      signature,
      stripeSecret
    );

    logger.info('Stripe webhook received', {
      eventType: event.type,
      eventId: event.id,
    });

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
    }

    res.status(200).json({ received: true, eventType: event.type });
  } catch (err) {
    logger.error('Stripe webhook error', { error: err.message });
    res.status(400).json({ error: 'Webhook Error', message: err.message });
  }
}
