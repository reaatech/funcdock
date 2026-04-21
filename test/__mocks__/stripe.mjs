export const mockState = {
  constructEvent: () => ({}),
};

class Stripe {
  constructor() {}
  webhooks = {
    constructEvent: (...args) => mockState.constructEvent(...args),
  };
}

export default Stripe;
