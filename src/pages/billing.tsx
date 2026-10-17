import Head from 'next/head'
import Link from 'next/link'
import { BILLING_PLANS } from '../lib/billingPlans'

export default function BillingPage() {
  return <>
    <Head>
      <title>Muse - Plans &amp; Billing</title>
      <meta name="description" content="Explore proposed Muse plans for personal stories and thoughtful gifts. Payments and subscriptions are not available yet." />
    </Head>
    <main className="atelier-page">
      <div className="atelier-shell">
        <p className="atelier-eyebrow">Room for more stories</p>
        <h1 className="atelier-title">Plans &amp; Billing</h1>
        <p style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>A moment for yourself. A thoughtful gift for someone.</p>
        <aside aria-label="Billing availability" style={{ padding: '1rem 1.25rem', background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 14, lineHeight: 1.7 }}>
          <strong>Coming soon - no payments or subscriptions yet.</strong>
          <p style={{ marginBottom: 0 }}>These are proposed plans, not active offers. You cannot buy or subscribe here, and no payment details are collected. Your current prototype access is unchanged; existing safety and usage limits still apply.</p>
        </aside>
        <section aria-label="Proposed plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, margin: '2rem 0' }}>
          {BILLING_PLANS.map(plan => <article key={plan.id} aria-labelledby={`plan-${plan.id}`} style={{ padding: '1.5rem', border: '1px solid #d9cfc5', borderRadius: 20, background: '#fffaf6', minWidth: 0 }}>
            <p style={{ fontSize: '0.85rem', marginTop: 0 }}>{plan.id === 'annual' ? 'Planned for later' : 'Proposed plan'}</p>
            <h2 id={`plan-${plan.id}`} style={{ fontSize: '1.4rem' }}>{plan.name}</h2>
            <p style={{ marginBottom: 4 }}><strong style={{ fontSize: '2rem' }}>{plan.price}</strong></p>
            <p style={{ marginTop: 0 }}>{plan.period}</p>
            <p style={{ lineHeight: 1.7 }}>{plan.description}</p>
            <ul style={{ paddingInlineStart: '1.2rem', lineHeight: 1.7 }}>
              {plan.features.map(feature => <li key={feature} style={{ marginBottom: '0.6rem' }}>{feature}</li>)}
            </ul>
            <p style={{ fontWeight: 700 }}>Not available to purchase</p>
          </article>)}
        </section>
        <p style={{ lineHeight: 1.7 }}>Prices are proposed in EUR. Final pricing, applicable tax presentation and checkout terms will be confirmed before payments launch. Premium cloud AI narration is not included; a separately priced option may be added later.</p>
        <section aria-labelledby="allowance-title" style={{ borderTop: '1px solid #d9cfc5', paddingTop: '1rem', lineHeight: 1.75 }}>
          <h2 id="allowance-title">Simple allowances</h2>
          <p><strong>One creation</strong> prepares a new story, including its opening. <strong>One AI interaction</strong> generates a continuation after your submitted response or selected action. Personal stories and gifts share the Plus allowance.</p>
          <p>Each personal journey supports 3, 6, 9 or 12 responses for its approximate 5-, 10-, 15- or 20-minute length. Shared live stories allow up to 12 actions per playthrough, within their shared story budget and the purchaser&apos;s remaining allowance. Opening the same gift in another browser does not grant a new paid budget.</p>
          <p>Browser listening, rereading, guesses, hints, sender-approved skips, replies and keepsakes do not consume AI interactions. A recorded voice message is your own recording, not premium AI narration. Failed live AI attempts can still consume the action budget; billing and refund terms will be confirmed before launch.</p>
          <p><strong>Receiving a gift never requires a paid plan.</strong> Managing or deleting an existing story will not require a subscription.</p>
        </section>
        <section aria-labelledby="access-title" style={{ lineHeight: 1.75 }}>
          <h2 id="access-title">Your stories and access</h2>
          <p>Current server story access lasts up to 30 days. A subscription is not permanent story storage. Planned cancellation stops future renewal, not access to already purchased gifts before their disclosed expiry.</p>
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
