/**
 * Example Stripe Webhook Handler
 *
 * This handler validates the Stripe signature and logs the event type.
 * Replace the secret and event handling logic as needed.
 */

export default async function handler(req, res) {
  const { logger } = req;
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
  let event;

  try {
    // Stripe sends the raw body as a string
    const signature = req.headers['stripe-signature'];
    const body = req.bodyRaw || req.body; // bodyRaw if available, else body

    // Dynamically import Stripe
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe('sk_test_placeholder'); // Not used for verification

    // Validate the event signature
    event = stripe.webhooks.constructEvent(
      typeof body === 'string' ? body : JSON.stringify(body),
      signature,
      stripeSecret
    );

    logger.info('Stripe webhook received', {
      eventType: event.type,
      eventId: event.id
    });

    // Example: handle a payment_intent.succeeded event
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
