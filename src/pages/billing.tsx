import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { localizedBillingPlans } from '../lib/billingPlans'
import { billingCopy, formatBillingText, type BillingCopy } from '../lib/billingCopy'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { accountFetch } from '../lib/accountClient'
import type { BillingStatus } from '../lib/billing'

export default function BillingPage() {
  const language = useInterfaceLanguage()
  const copy = billingCopy(language)
  const plans = localizedBillingPlans(language)
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<keyof BillingCopy | null>(null)
  useEffect(() => {
    let active = true
    void accountFetch('/api/billing').then(async response => {
      const data = await response.json()
      if (!active) return
      if (response.status === 401) setSignedOut(true)
      else if (!response.ok) setError('loadError')
      else setBilling(data.billing as BillingStatus)
    }).catch(() => {
      if (active) setError('loadError')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const subscribe = async () => {
    setBusy(true); setError(null)
    try {
      const response = await accountFetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe' })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(response.status === 503 ? 'unavailable' : response.status === 409 ? 'alreadyActive' : 'checkoutError')
        setBusy(false)
        return
      }
      if (typeof data.url !== 'string' || !data.url.startsWith('https://checkout.stripe.com/')) {
        throw new Error('Stripe returned an invalid checkout address.')
      }
      window.location.assign(data.url)
    } catch {
      setError('checkoutError')
      setBusy(false)
    }
  }
  return <>
    <Head>
      <title>{`Muse — ${copy.title}`}</title>
      <meta name="description" content={copy.subtitle} />
    </Head>
    <main className="atelier-page">
      <div className="atelier-shell">
        <h1 className="atelier-title">{copy.title}</h1>
        <p style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>{copy.subtitle}</p>
        <aside aria-label={copy.trial} style={{ padding: '1rem 1.25rem', background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 14, lineHeight: 1.7 }}>
          <strong>{copy.trialIntro}</strong>
          <p style={{ marginBottom: 0 }}>{copy.trialHelp}</p>
        </aside>
        {loading ? <p role="status">{copy.loading}</p> : null}
        {signedOut ? <p>{copy.signInHelp} <Link href="/account">{copy.account}</Link></p> : null}
        {billing ? <section aria-label={copy.yourPlan} className="atelier-card" style={{ marginTop: '1rem' }}>
          <h2>{billing.status === 'trialing' ? copy.trialTitle : billing.status === 'active' ? copy.activeTitle : copy.inactiveTitle}</h2>
          {billing.status === 'trialing' ? <p>{formatBillingText(copy.trialEnds, { date: new Date(billing.trialEndsAt).toLocaleDateString(language) })}</p> : null}
          <p>{formatBillingText(copy.usage, { stories: billing.storiesUsed, storyLimit: billing.storyLimit, interactions: billing.interactionsUsed, interactionLimit: billing.interactionLimit })}</p>
          {billing.status === 'trialing' && (billing.storiesUsed >= billing.storyLimit || billing.interactionsUsed >= billing.interactionLimit)
            ? <p role="status">{copy.limit}</p> : null}
          {billing.status !== 'active' ? <button type="button" className="atelier-button" disabled={busy} onClick={() => void subscribe()}>{busy ? copy.opening : copy.subscribe}</button> : null}
        </section> : null}
        {error ? <p role="alert">{copy[error]}</p> : null}
        <section aria-label={copy.planList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, margin: '2rem 0' }}>
          {plans.map(plan => <article key={plan.id} aria-labelledby={`plan-${plan.id}`} style={{ padding: '1.5rem', border: '1px solid #d9cfc5', borderRadius: 20, background: '#fffaf6', minWidth: 0 }}>
            <p style={{ fontSize: '0.85rem', marginTop: 0 }}>{copy[plan.availability]}</p>
            <h2 id={`plan-${plan.id}`} style={{ fontSize: '1.4rem' }}>{plan.name}</h2>
            <p style={{ marginBottom: 4 }}><strong style={{ fontSize: '2rem' }}>{plan.price}</strong></p>
            <p style={{ marginTop: 0 }}>{plan.period}</p>
            <p style={{ lineHeight: 1.7 }}>{plan.description}</p>
            <ul style={{ paddingInlineStart: '1.2rem', lineHeight: 1.7 }}>
              {plan.features.map(feature => <li key={feature} style={{ marginBottom: '0.6rem' }}>{feature}</li>)}
            </ul>
            {plan.id === 'trial' ? <p style={{ fontWeight: 700 }}>{copy.noCard}</p> : null}
          </article>)}
        </section>
        <p style={{ lineHeight: 1.7 }}>{copy.checkoutHelp}</p>
        <p style={{ lineHeight: 1.7 }}>{copy.priceNotice}</p>
        <details style={{ borderTop: '1px solid #d9cfc5', paddingTop: '1rem', lineHeight: 1.75 }}>
          <summary>{copy.allowanceTitle}</summary>
          <p>{copy.allowanceDefinition}</p>
          <p>{copy.freeActions}</p>
          <p>{copy.limits}</p>
          <p>{copy.plannedHelp}</p>
          <p>{copy.storageHelp}</p>
        </details>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '1rem 0' }}>
          <Link href="/demo" style={{ display: 'inline-block', padding: '0.85rem 1.1rem', borderRadius: 28, background: '#2d2926', color: '#fffaf6', textDecoration: 'none' }}>{copy.sample}</Link>
          <Link href="/" style={{ color: 'inherit', padding: '0.85rem 0' }}>{copy.home}</Link>
        </div>
      </div>
    </main>
  </>
}
