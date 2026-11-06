# Stripe sandbox only

Approved shared account: `acct_1UQsxxC5ufGRzg9R`. No account operations, live
charging, tax activation or database migrations are performed by this change.
All checkout/webhook entry points are disabled unless the server-only
`MUSE_STRIPE_SANDBOX_ENABLED=true` and
`MUSE_STRIPE_ISOLATED_BILLING_STORAGE_ACK=isolated-test-database` are explicitly
provisioned. Leave either absent
to disable Stripe. Live keys, live Checkout sessions and live webhook events
are rejected, even when opted in. Do not enable this against a production
entitlement database: test subscription events update existing billing records.
Use a separate test Supabase deployment with the existing billing schema;
schema provisioning is a separate operator-approved step.
The acknowledgment must only be set after verifying that the deployment's
Supabase URL and service-role credential target a dedicated test database, not
production entitlement storage. It is an explicit operator assertion, not an
automatic database classification or isolation mechanism. Both checkout and
webhook/direct subscription application fail closed without the exact value.
Never set this acknowledgment on a production-database deployment.

## Public test catalogue

`src/lib/stripeCatalogue.ts` maps these environment names (not secrets):

| Plan | EUR | Default test price ID | Price-ID override | Fulfillment |
| --- | ---: | --- | --- | --- |
| Monthly | 8.99 | `price_1UYpG5C5ufGRzg9R3hgrKDlg` | `STRIPE_MONTHLY_PRICE_ID` | Authenticated monthly sandbox only |
| Annual | 89.99 | `price_1UYpNIC5ufGRzg9RuzXzBfyA` | `STRIPE_ANNUAL_PRICE_ID` | Catalogue-only |
| Gift | 5.99 | `price_1UYpHDC5ufGRzg9RPfI5iEXo` | `STRIPE_GIFT_PRICE_ID` | Catalogue-only |

The operator browser-verified these public test IDs. Plus monthly/annual use
product `prod_VZzEGTdZZFjCf5`; Gift uses `prod_VZzFm5j2PxwPOy`.
Public defaults do not enable checkout: opt-in and test secrets are still required.
Monthly price overrides are optional; an explicitly blank/invalid override fails
closed rather than selecting a default. Any monthly override must still match
the approved Plus product. Annual/gift mappings are descriptive only.
Monthly is verified against Stripe for test mode, product identity, EUR 899 cents,
licensed recurring monthly billing, one unit and one-month intervals.
Annual requires correct monthly entitlement refresh within a yearly term;
gift requires one-off purchase/redemption entitlement handling. Neither is
implemented or purchasable through this integration.

## Secure manual configuration

An authorized operator must manually provision a test API key as
`STRIPE_SECRET_KEY` and this app's endpoint signing secret as
`STRIPE_WEBHOOK_SECRET` using the deployment's secret manager. Never paste
credentials into chat, source, public environment variables or logs. No secret
values were inspected or written during this implementation.
Optionally override the public test price IDs and configure `NEXT_PUBLIC_SITE_URL`
(HTTPS in production hosting), plus the isolated test Supabase credentials
already required by Muse billing. The account ID documents the approved account;
it is not a Connect account header or a credential. At runtime, checkout verifies
the credential's own account with `accounts.retrieve()` before creating a session.
Routed webhook processing repeats that check before database writes, and direct
subscription application also verifies it. Missing account-read permissions,
lookup failures or account mismatches fail closed. Restricted test keys therefore
need permission for account retrieval in addition to checkout/price access.
Connect events with a different `event.account` are rejected. No Stripe API call
was made while implementing or validating this change; account API calls happen
only at runtime after opt-in and test-key validation.

Create a separate **test** webhook endpoint for each app sharing the account,
each with its own signing secret and deployment destination. Muse's endpoint
is `/api/stripe-webhook`; subscribe only to `customer.subscription.created`,
`customer.subscription.updated` and `customer.subscription.deleted`.
Do not reuse another app's signing secret. Stripe may deliver account-wide
events to multiple endpoints: Muse routes subscriptions using
`muse_app=muse`, `muse_environment=sandbox`, `muse_owner_id` and the configured
monthly price. Foreign-app and unrelated event types are acknowledged without
claiming events or changing entitlement records; live/malformed Muse events are
rejected before database access. Direct subscription application repeats checks.
Do not tag other apps' subscriptions as Muse. Existing untagged subscriptions
are intentionally ignored rather than granted access.

Checkout requires an authenticated Muse account. Successful browser redirects
never grant entitlement; only verified, routed subscription events do.
`automatic_tax.enabled` is explicitly false. No tax registration, rates,
Stripe Tax activation, live payment enablement or fulfillment for annual/gift
is included. Legal/commercial readiness remains a separate release gate.
