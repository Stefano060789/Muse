import type Stripe from 'stripe'
import { SharedStoryError } from './sharedStory'
import { STRIPE_TEST_CATALOGUE, STRIPE_SANDBOX_ACCOUNT_ID } from './stripeCatalogue'

export function requireStripeSandbox() {
  if (process.env.MUSE_STRIPE_SANDBOX_ENABLED !== 'true') {
    throw new SharedStoryError('Stripe sandbox checkout is disabled.', 503)
  }
  if (process.env.MUSE_STRIPE_ISOLATED_BILLING_STORAGE_ACK !== 'isolated-test-database') {
    throw new SharedStoryError('Stripe sandbox requires acknowledgment of isolated test billing storage.', 503)
  }
}

export function sandboxApiKey() {
  requireStripeSandbox()
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key)) {
    throw new SharedStoryError('Only Stripe test API keys are permitted.', 503)
  }
  return key
}

export function sandboxMonthlyPriceId() {
  requireStripeSandbox()
  const price = process.env[STRIPE_TEST_CATALOGUE.monthly.priceIdEnv] ?? STRIPE_TEST_CATALOGUE.monthly.priceId
  if (!price || !/^price_[A-Za-z0-9]+$/.test(price)) {
    throw new SharedStoryError('The Muse monthly sandbox price is not configured.', 503)
  }
  return price
}

export async function requireSandboxAccount(stripe: Stripe) {
  requireStripeSandbox()
  const account = await stripe.accounts.retrieve()
  if (account.id !== STRIPE_SANDBOX_ACCOUNT_ID) {
    throw new SharedStoryError('Stripe credentials do not belong to the approved sandbox account.', 503)
  }
}

export function requireSandboxMonthlyPrice(price: Stripe.Price) {
  const catalogue = STRIPE_TEST_CATALOGUE.monthly
  if (price.livemode !== false || price.id !== sandboxMonthlyPriceId() ||
      (typeof price.product === 'string' ? price.product : price.product?.id) !== catalogue.productId ||
      price.currency !== catalogue.currency || price.unit_amount !== catalogue.unitAmount ||
      price.type !== 'recurring' || price.recurring?.interval !== 'month' ||
      price.recurring.interval_count !== 1 || price.billing_scheme !== 'per_unit' ||
      price.recurring.usage_type !== 'licensed') {
    throw new SharedStoryError('Only the configured EUR 8.99 monthly sandbox price is supported.', 400)
  }
}

export function requireSandboxCheckout(session: Stripe.Checkout.Session) {
  requireStripeSandbox()
  if (session.livemode !== false || !session.id.startsWith('cs_test_') ||
      !session.url?.startsWith('https://checkout.stripe.com/c/pay/cs_test_')) {
    throw new SharedStoryError('Stripe did not return a sandbox checkout link.', 503)
  }
}

export function isMuseSandboxSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.muse_app === 'muse' &&
    subscription.metadata?.muse_environment === 'sandbox'
}

export function requireSandboxSubscription(subscription: Stripe.Subscription) {
  requireStripeSandbox()
  if (subscription.livemode !== false || !isMuseSandboxSubscription(subscription) ||
      subscription.items.data.length !== 1 || subscription.items.data[0].quantity !== 1) {
    throw new SharedStoryError('Only Muse monthly sandbox subscriptions are supported.', 400)
  }
  requireSandboxMonthlyPrice(subscription.items.data[0].price)
}
