import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { SharedStoryError } from './sharedStory'
import { sandboxApiKey, requireSandboxSubscription, requireSandboxAccount } from './stripeSandbox'

export type BillingStatus = {
  tier: 'free' | 'plus'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  trialStartedAt: string
  trialEndsAt: string
  periodStartedAt: string
  periodEndsAt: string
  storiesUsed: number
  storyLimit: 10
  interactionsUsed: number
  interactionLimit: 120
  creatorUnlimited: boolean
  canGenerate: boolean
}

function billingDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new SharedStoryError('Subscription and trial storage is not configured. Apply supabase/billing.sql and configure Supabase.', 503)
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function creatorEmailAllowlist(): Set<string> {
  const configured = process.env.MUSE_CREATOR_EMAILS
  if (!configured?.trim()) return new Set()
  const emails = configured.split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
  if (emails.some(email => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    throw new SharedStoryError('MUSE_CREATOR_EMAILS contains an invalid email address.', 503)
  }
  return new Set(emails)
}

async function isCreatorAccount(ownerId: string, database: ReturnType<typeof billingDatabase>): Promise<boolean> {
  const allowedEmails = creatorEmailAllowlist()
  if (!allowedEmails.size) return false
  const { data, error } = await database.auth.admin.getUserById(ownerId)
  if (error) throw new SharedStoryError('Could not verify the creator account. Please try again later.', 503)
  const user = data.user
  return Boolean(user?.email_confirmed_at && user.email && allowedEmails.has(user.email.trim().toLowerCase()))
}

export function stripeClient() {
  const key = sandboxApiKey()
  return new Stripe(key, { apiVersion: '2022-11-15' })
}

export function billingTrialMode() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL &&
    (process.env.NODE_ENV === 'test' || process.env.STORY_STORAGE === 'sqlite')
}

export async function getBillingStatus(ownerId: string): Promise<BillingStatus> {
  if (billingTrialMode()) {
    const now = new Date()
    const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return {
      tier: 'plus', status: 'trialing', trialStartedAt: now.toISOString(), trialEndsAt: ends.toISOString(),
      periodStartedAt: now.toISOString(), periodEndsAt: ends.toISOString(),
      storiesUsed: 0, storyLimit: 10, interactionsUsed: 0, interactionLimit: 120,
      creatorUnlimited: false, canGenerate: true
    }
  }
  const database = billingDatabase()
  const { data, error } = await database.rpc('muse_billing_status', { p_owner_id: ownerId })
  if (error || !data || typeof data !== 'object') {
    throw new SharedStoryError('Could not load your plan and usage. Please try again later.', 503)
  }
  const billing = data as BillingStatus
  const creatorUnlimited = await isCreatorAccount(ownerId, database)
  return { ...billing, creatorUnlimited, canGenerate: billing.canGenerate || creatorUnlimited }
}

export async function reserveBillingUsage(ownerId: string, requestId: string, kind: 'story' | 'interaction') {
  if (billingTrialMode()) return
  const database = billingDatabase()
  const creator = await isCreatorAccount(ownerId, database)
  const { data, error } = await database.rpc('muse_reserve_billing_usage', {
    p_owner_id: ownerId, p_request_id: requestId, p_usage_kind: kind
  })
  if (error || !data || typeof data !== 'object') {
    throw new SharedStoryError('Could not verify your story allowance. Please try again later.', 503)
  }
  const result = data as { allowed?: unknown; reason?: unknown }
  if (result.allowed === true) return
  const planLimitReasons = ['story_limit', 'interaction_limit', 'trial_or_subscription_ended', 'subscription_period_unavailable']
  if (creator && typeof result.reason === 'string' && planLimitReasons.includes(result.reason)) return
  const benefit = 'Muse Plus includes 10 story creations and 120 AI interactions each month. Your saved stories remain available. Visit /billing to subscribe and keep creating.'
  const limit = result.reason === 'story_limit'
    ? 'You have used this period’s story creations. '
    : result.reason === 'interaction_limit'
      ? 'You have used this period’s AI interactions. '
      : 'Your free trial or subscription is no longer active. '
  throw new SharedStoryError(limit + benefit, 402)
}

export async function applyStripeSubscription(subscription: Stripe.Subscription) {
  requireSandboxSubscription(subscription)
  await requireSandboxAccount(stripeClient())
  const ownerId = subscription.metadata?.muse_owner_id
  if (!ownerId) throw new SharedStoryError('Stripe subscription is missing its Muse account reference.', 400)
  const status = subscription.status === 'active' ? 'active'
    : subscription.status === 'past_due' ? 'past_due'
      : 'canceled'
  const admin = billingDatabase()
  const { data: current, error: lookupError } = await admin.from('muse_billing_accounts')
    .select('period_started_at,period_ends_at').eq('owner_id', ownerId).maybeSingle()
  if (lookupError || !current) throw new SharedStoryError('Could not find the Muse account for this subscription.', 503)
  const periodStartedAt = new Date(subscription.current_period_start * 1000).toISOString()
  const periodEndsAt = new Date(subscription.current_period_end * 1000).toISOString()
  const periodChanged = current.period_started_at !== periodStartedAt || current.period_ends_at !== periodEndsAt
  const { error } = await admin.from('muse_billing_accounts').update({
    tier: status === 'active' || status === 'past_due' ? 'plus' : 'free',
    status,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    period_started_at: periodStartedAt,
    period_ends_at: periodEndsAt,
    ...(periodChanged ? { stories_used: 0, interactions_used: 0 } : {}),
    updated_at: new Date().toISOString()
  }).eq('owner_id', ownerId)
  if (error) throw new SharedStoryError('Could not update Muse subscription status.', 503)
}
