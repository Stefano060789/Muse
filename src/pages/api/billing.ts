import type { NextApiRequest, NextApiResponse } from 'next'
import { getBillingStatus, stripeClient } from '../../lib/billing'
import { requireAccount } from '../../lib/accountAuth'
import { SharedStoryError } from '../../lib/sharedStory'
import { apiSafety } from '../../lib/operations'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!await apiSafety(req, res)) return
  if (req.headers.origin) {
    try {
      if (new URL(String(req.headers.origin)).host !== req.headers.host) {
        return res.status(403).json({ error: 'Cross-origin billing requests are not allowed.' })
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' })
    }
  }
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (req.method === 'GET') return res.status(200).json({ billing: await getBillingStatus(account.id) })
    if (req.body?.action !== 'subscribe') return res.status(400).json({ error: 'Unsupported billing action.' })
    const price = process.env.STRIPE_MONTHLY_PRICE_ID
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!price || !siteUrl) throw new SharedStoryError('Muse Plus checkout is not configured yet.', 503)
    let origin: URL
    try { origin = new URL(siteUrl) } catch { throw new SharedStoryError('The public app URL is not configured correctly.', 503) }
    if (origin.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new SharedStoryError('The public app URL must use HTTPS.', 503)
    }
    const current = await getBillingStatus(account.id)
    if (current.status === 'active') throw new SharedStoryError('Muse Plus is already active on this account.', 409)
    const stripe = stripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: account.id,
      customer_email: account.email,
      subscription_data: { metadata: { muse_owner_id: account.id } },
      success_url: new URL('/billing?checkout=success', origin).toString(),
      cancel_url: new URL('/billing?checkout=cancelled', origin).toString()
    })
    if (!session.url) throw new SharedStoryError('Stripe did not return a checkout link.', 503)
    return res.status(200).json({ url: session.url })
  } catch (error) {
    return res.status(error instanceof SharedStoryError ? error.status : 503)
      .json({ error: error instanceof Error ? error.message : 'Billing is temporarily unavailable.' })
  }
}
