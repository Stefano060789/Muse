import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BILLING_PLANS } from '../lib/billingPlans'
import { accountFetch } from '../lib/accountClient'
import type { BillingStatus } from '../lib/billing'

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void accountFetch('/api/billing').then(async response => {
      const data = await response.json()
      if (!active) return
      if (response.status === 401) setSignedOut(true)
      else if (!response.ok) setError(data.error || 'Could not load billing status.')
      else setBilling(data.billing as BillingStatus)
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load billing status.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const subscribe = async () => {
    setBusy(true); setError('')
    try {
      const response = await accountFetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start Muse Plus checkout.')
      if (typeof data.url !== 'string' || !data.url.startsWith('https://checkout.stripe.com/')) {
        throw new Error('Stripe returned an invalid checkout address.')
      }
      window.location.assign(data.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start Muse Plus checkout.')
      setBusy(false)
    }
  }
  return <>
    <Head>
      <title>Muse - Plans &amp; Billing</title>
      <meta name="description" content="Explore proposed Muse plans for personal stories and thoughtful gifts. Payments and subscriptions are not available yet." />
    </Head>
    <main className="atelier-page">
      <div className="atelier-shell">
        <p className="atelier-eyebrow">Room for more stories</p>
        <h1 className="atelier-title">Plans &amp; Billing</h1>
        <p style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>Turn the things that matter to you into stories you can keep building together.</p>
        <aside aria-label="Billing availability" style={{ padding: '1rem 1.25rem', background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 14, lineHeight: 1.7 }}>
          <strong>Try Muse Plus free for 30 days—no card and no automatic charge.</strong>
          <p style={{ marginBottom: 0 }}>The trial starts when you create your account. At the end, your saved stories remain available; subscribe only if you want to keep creating and using AI interactions. Checkout is available once the Stripe account and price are configured.</p>
        </aside>
        {loading ? <p role="status">Checking your plan…</p> : null}
        {signedOut ? <p>Sign in or create an account to start your 30-day free trial. <Link href="/account">Go to your account</Link>.</p> : null}
        {billing ? <section aria-label="Your plan and usage" className="atelier-card" style={{ marginTop: '1rem' }}>
          <h2>{billing.status === 'trialing' ? 'Your free Muse Plus trial' : billing.status === 'active' ? 'Your Muse Plus plan' : 'Your Muse Plus access is inactive'}</h2>
          {billing.status === 'trialing' ? <p>Trial ends {new Date(billing.trialEndsAt).toLocaleDateString()}. No automatic charge.</p> : null}
          <p>Stories: {billing.storiesUsed}/{billing.storyLimit} · AI interactions: {billing.interactionsUsed}/{billing.interactionLimit}</p>
          {billing.status === 'trialing' && (billing.storiesUsed >= billing.storyLimit || billing.interactionsUsed >= billing.interactionLimit)
            ? <p role="status">You have reached a trial allowance. Subscribe to Muse Plus to continue creating stories and AI-powered turns.</p> : null}
          {billing.status !== 'active' ? <button type="button" className="atelier-button" disabled={busy} onClick={() => void subscribe()}>{busy ? 'Opening secure checkout…' : 'Subscribe to Muse Plus'}</button> : null}
        </section> : null}
        {error ? <p role="alert">{error}</p> : null}
        <section aria-label="Proposed plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, margin: '2rem 0' }}>
          {BILLING_PLANS.map(plan => <article key={plan.id} aria-labelledby={`plan-${plan.id}`} style={{ padding: '1.5rem', border: '1px solid #d9cfc5', borderRadius: 20, background: '#fffaf6', minWidth: 0 }}>
            <p style={{ fontSize: '0.85rem', marginTop: 0 }}>{plan.id === 'annual' ? 'Planned for later' : plan.id === 'trial' ? 'Free trial' : 'Proposed plan'}</p>
            <h2 id={`plan-${plan.id}`} style={{ fontSize: '1.4rem' }}>{plan.name}</h2>
            <p style={{ marginBottom: 4 }}><strong style={{ fontSize: '2rem' }}>{plan.price}</strong></p>
            <p style={{ marginTop: 0 }}>{plan.period}</p>
            <p style={{ lineHeight: 1.7 }}>{plan.description}</p>
            <ul style={{ paddingInlineStart: '1.2rem', lineHeight: 1.7 }}>
              {plan.features.map(feature => <li key={feature} style={{ marginBottom: '0.6rem' }}>{feature}</li>)}
            </ul>
            {plan.id === 'trial' ? <p style={{ fontWeight: 700 }}>No card · no automatic renewal</p>
              : plan.id === 'free' ? <p style={{ fontWeight: 700 }}>Free</p>
                : plan.id === 'monthly' ? null : <p style={{ fontWeight: 700 }}>Not available to purchase</p>}
          </article>)}
        </section>
        <p style={{ lineHeight: 1.7 }}>Prices and allowances are proposals, not validated willingness-to-pay. Optional story puzzles are a future idea and are not implemented yet. The current prototype supports same-device turn-taking, not synchronized multiplayer across devices. Long Gift limits are planned package limits: the current prototype allows up to 12 actions per playthrough and lets the creator configure the total story budget; the proposed 60-action limit is not yet enforced.</p>
        <p style={{ lineHeight: 1.7 }}>Prices are proposed in EUR. Final pricing, applicable tax presentation and checkout terms will be confirmed before payments launch. Premium cloud AI narration is not included; a separately priced option may be considered after provider costs are validated.</p>
        <section aria-labelledby="allowance-title" style={{ borderTop: '1px solid #d9cfc5', paddingTop: '1rem', lineHeight: 1.75 }}>
          <h2 id="allowance-title">Simple allowances</h2>
          <p><strong>One creation</strong> prepares a new story, including its opening. <strong>One AI interaction</strong> generates a continuation after your submitted response or selected action. The no-card 30-day trial includes up to 10 creations and 120 interactions. A proposed One-off Long Gift includes a prepared 20-minute, 9-scene story and up to 60 live AI interactions in one playthrough. Muse Plus includes 120 interactions each billing month, shared across its stories, as well as 10 story creations. Annual Plus would refresh those same monthly allowances each month. Personal stories and gifts share the Plus interaction allowance.</p>
          <p>Each personal journey supports 3, 6, 9 or 12 responses for its approximate 5-, 10-, 15- or 20-minute length. The current shared live-story prototype allows up to 12 actions per playthrough, within its configured shared story budget. Opening the same gift in another browser does not grant a new paid budget. The Long Gift&apos;s proposed 60-action cap is not yet enforced.</p>
          <p>Browser listening, rereading, local immersive ambience, guesses, hints, sender-approved skips, replies and keepsakes do not consume AI interactions. All packages include the same local, scene-matched soundscapes; they run in the browser during listening and are not AI-generated audio. A recorded voice message is your own recording, not premium AI narration. Failed live AI attempts can still consume the action budget; billing and refund terms will be confirmed before launch.</p>
          <p><strong>Receiving a gift never requires a paid plan.</strong> Managing or deleting an existing story will not require a subscription.</p>
        </section>
        <section aria-labelledby="access-title" style={{ lineHeight: 1.75 }}>
          <h2 id="access-title">Your stories and access</h2>
          <p>Server stories have no automatic expiry and remain until deleted. Continued hosting and backups are not guaranteed forever. Planned subscription cancellation stops future renewal, not access to existing stories.</p>
          <p>Muse currently has no billing account or cross-device library sync. Paid checkout, secure customer sign-in and server-side allowances must be in place before these plans can launch.</p>
        </section>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '1rem 0' }}>
          <Link href="/demo" style={{ display: 'inline-block', padding: '0.85rem 1.1rem', borderRadius: 28, background: '#2d2926', color: '#fffaf6', textDecoration: 'none' }}>Try the free sample</Link>
          <Link href="/" style={{ color: 'inherit', padding: '0.85rem 0' }}>Back to Muse</Link>
        </div>
      </div>
    </main>
  </>
}
