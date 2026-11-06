import type { NextApiRequest, NextApiResponse } from 'next'
import type Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { applyStripeSubscription, stripeClient } from '../../lib/billing'
import { requireStripeSandbox, isMuseSandboxSubscription, requireSandboxSubscription, requireSandboxAccount } from '../../lib/stripeSandbox'
import { STRIPE_SANDBOX_ACCOUNT_ID } from '../../lib/stripeCatalogue'

export const config = { api: { bodyParser: false } }

const MAX_WEBHOOK_BYTES = 1_000_000

class WebhookTooLargeError extends Error {}

async function rawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.length
    if (total > MAX_WEBHOOK_BYTES) throw new WebhookTooLargeError()
    chunks.push(bytes)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try { requireStripeSandbox() } catch {
    return res.status(503).json({ error: 'Stripe sandbox webhook is disabled.' })
  }
  const signature = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (typeof signature !== 'string' || !secret || !url || !serviceKey) {
    return res.status(503).json({ error: 'Stripe webhook is not configured.' })
  }
  let event: Stripe.Event
  let body: Buffer
  try {
    body = await rawBody(req)
  } catch (error) {
    if (error instanceof WebhookTooLargeError) {
      return res.status(413).json({ error: 'Stripe webhook exceeds the permitted size.' })
    }
    return res.status(400).json({ error: 'Could not read the Stripe webhook body.' })
  }
  try {
    event = stripeClient().webhooks.constructEvent(body, signature, secret)
  } catch {
    return res.status(400).json({ error: 'Invalid Stripe webhook signature.' })
  }
  if (event.livemode !== false) {
    return res.status(400).json({ error: 'Live Stripe events are not permitted.' })
  }
  if (event.account && event.account !== STRIPE_SANDBOX_ACCOUNT_ID) {
    return res.status(400).json({ error: 'Stripe event is from an unapproved account.' })
  }
  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    return res.status(200).json({ received: true, ignored: true })
  }
  const subscription = event.data.object as Stripe.Subscription
  if (subscription.livemode !== false) {
    return res.status(400).json({ error: 'Live Stripe subscriptions are not permitted.' })
  }
  if (!isMuseSandboxSubscription(subscription)) {
    return res.status(200).json({ received: true, ignored: true })
  }
  try { requireSandboxSubscription(subscription) } catch {
    return res.status(400).json({ error: 'Unsupported Muse sandbox subscription.' })
  }
  try { await requireSandboxAccount(stripeClient()) } catch {
    return res.status(503).json({ error: 'Could not verify the approved Stripe sandbox account.' })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: claimError } = await admin.from('muse_stripe_events').insert({ event_id: event.id })
  if (claimError?.code === '23505') return res.status(200).json({ received: true, duplicate: true })
  if (claimError) return res.status(503).json({ error: 'Could not record Stripe event.' })
  try {
    if (event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      await applyStripeSubscription(subscription)
    }
    return res.status(200).json({ received: true })
  } catch (error) {
    await admin.from('muse_stripe_events').delete().eq('event_id', event.id)
    console.error('Stripe webhook processing failed', error instanceof Error ? error.name : 'Unknown error')
    return res.status(503).json({ error: 'Could not process Stripe event. Stripe may retry this delivery.' })
  }
}
