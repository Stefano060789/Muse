import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/accountClient'

type Account = { email?: string }

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const localDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL

  useEffect(() => {
    if (!supabase) {
      if (!localDevelopment) setError('Account sign-in is not configured for this deployment.')
      return
    }
    let active = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError('Could not check your sign-in. Refresh or try again.')
      setAccount(data.session?.user ? { email: data.session.user.email } : null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAccount(session?.user ? { email: session.user.email } : null)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [localDevelopment])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) { setError('Account sign-in is not configured for this deployment.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      if (registering) {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password })
        if (authError) throw authError
        if (data.session) {
          setAccount({ email: data.user?.email })
          setNotice('Your account is ready. Your stories will be saved to this account.')
        } else {
          setNotice('Check your email to confirm your account, then sign in.')
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        setAccount({ email: data.user.email })
        setNotice('You are signed in. Your stories are connected to this account.')
      }
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete account sign-in.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: authError } = await supabase.auth.signOut()
      if (authError) throw authError
      setAccount(null)
      setNotice('You are signed out.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Head><title>Muse — Account</title><meta name="description" content="Register or sign in to manage your stories." /></Head>
    <main className="atelier-page">
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">Your stories, yours</p>
        <h1 className="atelier-title">Account</h1>
        <p className="atelier-subtitle">Sign in to create and manage your stories. People opening a gift story only need the recipient link.</p>
        {!supabase && localDevelopment ? <section className="atelier-card">
          <p>Local development is using local story storage. No account sign-in is needed in this development environment.</p>
          <Link className="atelier-button" href="/story?new=1">Create a story</Link>
        </section> : !supabase ? <p role="alert">Account sign-in is not configured for this deployment.</p> : account ? (
          <section className="atelier-card">
            <h2>You&apos;re signed in</h2>
            <p>{account.email}</p>
            <p>Your newly created stories belong to this account. Sign in on another device to manage them there.</p>
            <div className="atelier-actions">
              <Link className="atelier-button" href="/library">Go to saved stories</Link>
              <button type="button" className="atelier-secondary" disabled={busy} onClick={() => void signOut()}>Sign out</button>
            </div>
          </section>
        ) : (
          <form className="atelier-card" onSubmit={event => void submit(event)}>
            <div role="group" aria-label="Account action" className="atelier-actions">
              <button type="button" className={!registering ? 'atelier-button' : 'atelier-secondary'} aria-pressed={!registering} onClick={() => { setRegistering(false); setError(''); setNotice('') }}>Sign in</button>
              <button type="button" className={registering ? 'atelier-button' : 'atelier-secondary'} aria-pressed={registering} onClick={() => { setRegistering(true); setError(''); setNotice('') }}>Create account</button>
            </div>
            <label className="atelier-field">Email
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label className="atelier-field">Password
              <input type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {registering ? <p className="atelier-note">Use at least 8 characters. You may need to confirm your email before signing in.</p> : null}
            <button type="submit" className="atelier-button" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
          </form>
        )}
        {notice ? <p role="status">{notice}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </main>
  </>
}
