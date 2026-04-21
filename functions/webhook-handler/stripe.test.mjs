import { jest } from '@jest/globals';
import { mockState } from '../../test/__mocks__/stripe.mjs';
import handler from './stripe.js';

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), log: jest.fn() };

function createMockReqRes(headers = {}, body = {}, env = {}) {
  const req = {
    headers,
    body,
    bodyRaw: typeof body === 'string' ? body : JSON.stringify(body),
    logger,
    env,
  };
  let statusCode = 200;
  let sentData;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      sentData = data;
      return res;
    },
    header() {
      return res;
    },
    end() {
      return res;
    },
    getStatus: () => statusCode,
    getData: () => sentData,
  };
  return { req, res };
}

describe('webhook-handler/stripe.js', () => {
  const originalStripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeSecret;
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
  });

  it('should return 400 when webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { req, res } = createMockReqRes({}, {});
    await handler(req, res);
    expect(res.getStatus()).toBe(400);
    expect(res.getData().error).toBe('Stripe webhook secret not configured');
  });

  it('should return 401 when signature is missing', async () => {
    const { req, res } = createMockReqRes({}, {});
    await handler(req, res);
    expect(res.getStatus()).toBe(401);
    expect(res.getData().error).toBe('Missing Stripe signature');
  });

  it('should return 200 for valid webhook event', async () => {
    const event = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      livemode: false,
      data: {
        object: {
          id: 'pi_123',
          amount: 2000,
          currency: 'usd',
        },
      },
    };
    mockState.constructEvent = jest.fn().mockReturnValue(event);

    const body = { id: 'evt_123' };
    const { req, res } = createMockReqRes({ 'stripe-signature': 'sig_valid' }, body);
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getData().received).toBe(true);
    expect(res.getData().eventType).toBe('payment_intent.succeeded');
    expect(logger.info).toHaveBeenCalledWith('Payment succeeded', { paymentIntentId: 'pi_123' });
  });

  it('should return 200 for non-payment event', async () => {
    const event = {
      id: 'evt_456',
      type: 'invoice.payment_failed',
      livemode: false,
      data: { object: { id: 'inv_1' } },
    };
    mockState.constructEvent = jest.fn().mockReturnValue(event);

    const body = { id: 'evt_456' };
    const { req, res } = createMockReqRes({ 'stripe-signature': 'sig_valid' }, body);
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getData().eventType).toBe('invoice.payment_failed');
    expect(logger.info).not.toHaveBeenCalledWith('Payment succeeded', expect.any(Object));
  });

  it('should return 400 for invalid signature', async () => {
    mockState.constructEvent = jest.fn().mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const body = { id: 'evt_bad' };
    const { req, res } = createMockReqRes({ 'stripe-signature': 'sig_bad' }, body);
    await handler(req, res);

    expect(res.getStatus()).toBe(400);
    expect(res.getData().error).toBe('Webhook Error');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should use env vars from req.env when available', async () => {
    const event = {
      id: 'evt_env',
      type: 'payment_intent.succeeded',
      livemode: false,
      data: { object: { id: 'pi_env', amount: 100, currency: 'usd' } },
    };
    mockState.constructEvent = jest.fn().mockReturnValue(event);

    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;

    const body = { id: 'evt_env' };
    const { req, res } = createMockReqRes({ 'stripe-signature': 'sig_env' }, body, {
      STRIPE_WEBHOOK_SECRET: 'whsec_env',
      STRIPE_SECRET_KEY: 'sk_env',
    });
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getData().received).toBe(true);
  });

  it('should fallback to sk_test_placeholder when no secret key is set', async () => {
    const event = {
      id: 'evt_fallback',
      type: 'payment_intent.succeeded',
      livemode: false,
      data: { object: { id: 'pi_fallback', amount: 100, currency: 'usd' } },
    };
    mockState.constructEvent = jest.fn().mockReturnValue(event);

    delete process.env.STRIPE_SECRET_KEY;

    const body = { id: 'evt_fallback' };
    const { req, res } = createMockReqRes({ 'stripe-signature': 'sig_fallback' }, body);
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
  });

  it('should use req.body when bodyRaw is not available', async () => {
    const event = {
      id: 'evt_noraw',
      type: 'charge.succeeded',
      livemode: false,
      data: { object: { id: 'ch_1' } },
    };
    mockState.constructEvent = jest.fn().mockReturnValue(event);

    const body = { id: 'evt_noraw' };
    const req = {
      headers: { 'stripe-signature': 'sig_noraw' },
      body,
      logger,
      env: {},
    };
    let statusCode = 200;
    let sentData;
    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        sentData = data;
        return res;
      },
      header() {
        return res;
      },
      end() {
        return res;
      },
      getStatus: () => statusCode,
      getData: () => sentData,
    };
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getData().eventType).toBe('charge.succeeded');
  });
});
