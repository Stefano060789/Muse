// Public catalogue: environment variable names and price IDs are not credentials.
export const STRIPE_SANDBOX_ACCOUNT_ID = 'acct_1UQsxxC5ufGRzg9R'

export const STRIPE_TEST_CATALOGUE = {
  monthly: { currency: 'eur', unitAmount: 899, productId: 'prod_VZzEGTdZZFjCf5', priceId: 'price_1UYpG5C5ufGRzg9R3hgrKDlg', priceIdEnv: 'STRIPE_MONTHLY_PRICE_ID', fulfillment: 'monthly-sandbox' },
  annual: { currency: 'eur', unitAmount: 8999, productId: 'prod_VZzEGTdZZFjCf5', priceId: 'price_1UYpNIC5ufGRzg9RuzXzBfyA', priceIdEnv: 'STRIPE_ANNUAL_PRICE_ID', fulfillment: 'catalogue-only' },
  gift: { currency: 'eur', unitAmount: 599, productId: 'prod_VZzFm5j2PxwPOy', priceId: 'price_1UYpHDC5ufGRzg9RPfI5iEXo', priceIdEnv: 'STRIPE_GIFT_PRICE_ID', fulfillment: 'catalogue-only' }
} as const
