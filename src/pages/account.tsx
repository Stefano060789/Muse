import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/accountClient'
import { STORY_LANGUAGES, type StoryLanguageCode } from '../lib/storyLanguage'
import { loadStoryPreferences, saveStoryPreferences } from '../lib/storyPreferences'
import {
  loadStoryProgressNotificationsEnabled, saveStoryProgressNotificationsEnabled
} from '../lib/storyProgressNotifications'
import { loadProfileDisplayName, saveProfileDisplayName } from '../lib/profilePreferences'
import {
  interfaceText, loadInterfaceLanguage, saveInterfaceLanguage, useInterfaceLanguage
} from '../lib/interfaceLanguage'
import { interfaceFlowText } from '../lib/interfaceFlow'
import { useShareConsent } from '../lib/useShareConsent'
import { shareConsentCopy } from '../lib/shareConsentCopy'
import { personalStoryShareText } from '../lib/personalStoryShareCopy'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { accountPermissionsUpdate } from '../lib/accountPermissions'
import { registrationCopy } from '../lib/registrationCopy'

type Account = { email?: string; displayName?: string }

export default function AccountPage() {
  const interfaceLanguage = useInterfaceLanguage()
  const permissions = useAccountPermissions()
  const registrationText = registrationCopy(interfaceLanguage)
  const [registrationConsent, setRegistrationConsent] = useState(false)
  const [registrationRomance, setRegistrationRomance] = useState(false)
  const shareConsent = useShareConsent()
  const permissionCopy = shareConsentCopy(interfaceLanguage)
  const savedText = interfaceFlowText('saved', interfaceLanguage)
  const [account, setAccount] = useState<Account | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [storyLanguage, setStoryLanguage] = useState<StoryLanguageCode>('en-US')
  const [interfaceLocale, setInterfaceLocale] = useState<StoryLanguageCode>('en-US')
  const [profileName, setProfileName] = useState('')
  const [settingsNotice, setSettingsNotice] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [storyNotificationsEnabled, setStoryNotificationsEnabled] = useState(true)
  const localDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL

  useEffect(() => {
    try {
      setStoryLanguage(loadStoryPreferences().language)
      setInterfaceLocale(loadInterfaceLanguage())
      setProfileName(loadProfileDisplayName())
      setStoryNotificationsEnabled(loadStoryProgressNotificationsEnabled())
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'Could not load your settings.')
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      if (!localDevelopment) setError('Account sign-in is not configured for this deployment.')
      return
    }
    let active = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError('Could not check your sign-in. Refresh or try again.')
      setAccount(data.session?.user ? {
        email: data.session.user.email,
        displayName: typeof data.session.user.user_metadata?.display_name === 'string' ? data.session.user.user_metadata.display_name : undefined
      } : null)
      if (typeof data.session?.user.user_metadata?.display_name === 'string') setProfileName(data.session.user.user_metadata.display_name)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAccount(session?.user ? {
        email: session.user.email,
        displayName: typeof session.user.user_metadata?.display_name === 'string' ? session.user.user_metadata.display_name : undefined
      } : null)
      if (active && typeof session?.user.user_metadata?.display_name === 'string') setProfileName(session.user.user_metadata.display_name)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [localDevelopment])

  const changeLanguage = (value: string) => {
    const selected = STORY_LANGUAGES.find(option => option.code === value)
    if (!selected) {
      setSettingsError('Choose a supported story language.')
      return
    }
    setSettingsError('')
    setSettingsNotice('')
    try {
      const current = loadStoryPreferences()
      saveStoryPreferences({ ...current, language: selected.code })
      setStoryLanguage(selected.code)
      setSettingsNotice(interfaceText('languageSaved', interfaceLanguage))
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'Could not save your Muse language.')
    }
  }

  const changeInterfaceLanguage = (value: string) => {
    setSettingsError('')
    setSettingsNotice('')
    try {
      const selected = saveInterfaceLanguage(value)
      setInterfaceLocale(selected)
      setSettingsNotice(interfaceText('languageSaved', selected))
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'Could not save your interface language.')
    }
  }

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsNotice('')
    const normalizedName = profileName.trim()
    if (!normalizedName || normalizedName.length > 40) {
      setSettingsError('Enter a name of 1 to 40 characters.')
      return
    }
    try {
      if (supabase && account) {
        const { error: authError } = await supabase.auth.updateUser({ data: { display_name: normalizedName } })
        if (authError) throw authError
        setAccount(current => current ? { ...current, displayName: normalizedName } : current)
      }
      saveProfileDisplayName(normalizedName)
      setProfileName(normalizedName)
      setSettingsNotice(interfaceText('profileSaved', interfaceLanguage))
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'Could not save your name.')
    }
  }

  const changeStoryNotifications = (enabled: boolean) => {
    setSettingsError('')
    setSettingsNotice('')
    try {
      saveStoryProgressNotificationsEnabled(enabled)
      setStoryNotificationsEnabled(enabled)
      setSettingsNotice(savedText)
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'Could not save your notification setting.')
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) { setError('Account sign-in is not configured for this deployment.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      if (registering) {
        if (!registrationConsent) throw new Error(registrationText.required)
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: accountPermissionsUpdate(registrationConsent, registrationRomance) }
        })
        if (authError) throw authError
        if (data.session) {
          setAccount({ email: data.user?.email, displayName: typeof data.user?.user_metadata?.display_name === 'string' ? data.user.user_metadata.display_name : undefined })
          setNotice('Your account is ready. Your stories will be saved to this account.')
        } else {
          setNotice('Check your email to confirm your account, then sign in.')
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        setAccount({ email: data.user.email, displayName: typeof data.user.user_metadata?.display_name === 'string' ? data.user.user_metadata.display_name : undefined })
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
    <Head><title>{`Muse — ${interfaceText('settingsTitle', interfaceLanguage)}`}</title><meta name="description" content={interfaceText('settingsSubtitle', interfaceLanguage)} /></Head>
    <main className="atelier-page" lang={interfaceLanguage} dir={STORY_LANGUAGES.find(option => option.code === interfaceLanguage)?.dir}>
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">{interfaceText('settingsEyebrow', interfaceLanguage)}</p>
        <h1 className="atelier-title">{interfaceText('settingsTitle', interfaceLanguage)}</h1>
        <section className="atelier-card" aria-labelledby="profile-heading">
          <h2 id="profile-heading">{interfaceText('profileHeading', interfaceLanguage)}</h2>
          <form onSubmit={event => void saveProfile(event)}>
            <label className="atelier-field" htmlFor="profile-name">{interfaceText('profileNameLabel', interfaceLanguage)}
              <input id="profile-name" type="text" maxLength={40} required value={profileName} onChange={event => setProfileName(event.target.value)} />
            </label>
            <button type="submit" className="atelier-button">{interfaceText('saveProfile', interfaceLanguage)}</button>
          </form>
        </section>
        <section className="atelier-card" aria-labelledby="muse-language-heading">
          <h2 id="muse-language-heading">{interfaceText('languageHeading', interfaceLanguage)}</h2>
          <label className="atelier-field" htmlFor="interface-language">{interfaceText('interfaceLanguageLabel', interfaceLanguage)}
            <select id="interface-language" value={interfaceLocale} onChange={event => changeInterfaceLanguage(event.target.value)}>
              {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
          <label className="atelier-field" htmlFor="muse-language">{interfaceText('storyLanguageLabel', interfaceLanguage)}
            <select id="muse-language" value={storyLanguage} onChange={event => changeLanguage(event.target.value)}>
              {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
          {settingsNotice ? <p role="status">{settingsNotice}</p> : null}
          {settingsError ? <p role="alert">{settingsError}</p> : null}
        </section>
        <section className="atelier-card" aria-labelledby="story-notifications-heading">
          <h2 id="story-notifications-heading">{interfaceText('notificationsHeading', interfaceLanguage)}</h2>
          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
            <input
              type="checkbox"
              checked={storyNotificationsEnabled}
              onChange={event => changeStoryNotifications(event.target.checked)}
            />
            {interfaceText('notificationsEnabled', interfaceLanguage)}
          </label>
        </section>
        {account && permissions.managed ? <section className="atelier-card" aria-labelledby="registration-permissions-heading">
          <h2 id="registration-permissions-heading">{registrationText.title}</h2>
          <label><input type="checkbox" checked={permissions.services} disabled={!permissions.ready || permissions.saving}
            onChange={event => { void permissions.save(event.target.checked, permissions.romance).catch(error => setSettingsError(error instanceof Error ? error.message : registrationText.required)) }} /> {registrationText.services}</label>
          <details><summary>{registrationText.title}</summary><p>{registrationText.details}</p></details>
          <label><input type="checkbox" checked={permissions.romance} disabled={!permissions.ready || permissions.saving}
            onChange={event => { void permissions.save(permissions.services, event.target.checked).catch(error => setSettingsError(error instanceof Error ? error.message : registrationText.required)) }} /> {registrationText.romance}</label>
          {permissions.error ? <p role="alert">{permissions.error}</p> : null}
        </section> : account ? <section className="atelier-card" aria-labelledby="share-consent-heading">
          <h2 id="share-consent-heading">{permissionCopy.title}</h2>
          <p>{personalStoryShareText('teaserConsent', interfaceLanguage)}</p>
          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
            <input type="checkbox" checked={shareConsent.accepted} disabled={!shareConsent.ready || shareConsent.saving}
              onChange={event => { void shareConsent.save(event.target.checked).catch(() => setSettingsError(permissionCopy.error)) }} />
            {permissionCopy.allow}
          </label>
          {shareConsent.failed ? <p role="alert">{permissionCopy.error}</p> : null}
        </section> : null}
        <section aria-labelledby="account-settings-heading">
        <h2 id="account-settings-heading">{interfaceText('accountHeading', interfaceLanguage)}</h2>
        {!supabase && localDevelopment ? <section className="atelier-card">
          <p>{interfaceText('localAccount', interfaceLanguage)}</p>
          <Link className="atelier-button" href="/story?new=1">Create a story</Link>
        </section> : !supabase ? <p role="alert">Account sign-in is not configured for this deployment.</p> : account ? (
          <section className="atelier-card">
            <h2>{interfaceText('signedIn', interfaceLanguage)}</h2>
            <p>{account.email}</p>
            {account.displayName ? <p>{account.displayName}</p> : null}
            <div className="atelier-actions">
              <Link className="atelier-button" href="/library">{interfaceText('savedStories', interfaceLanguage)}</Link>
              <button type="button" className="atelier-secondary" disabled={busy} onClick={() => void signOut()}>{interfaceText('signOut', interfaceLanguage)}</button>
            </div>
          </section>
        ) : (
          <form className="atelier-card" onSubmit={event => void submit(event)}>
            <div role="group" aria-label="Account action" className="atelier-actions">
              <button type="button" className={!registering ? 'atelier-button' : 'atelier-secondary'} aria-pressed={!registering} onClick={() => { setRegistering(false); setError(''); setNotice('') }}>{interfaceText('signIn', interfaceLanguage)}</button>
              <button type="button" className={registering ? 'atelier-button' : 'atelier-secondary'} aria-pressed={registering} onClick={() => { setRegistering(true); setError(''); setNotice('') }}>{interfaceText('createAccount', interfaceLanguage)}</button>
            </div>
            <label className="atelier-field">{interfaceText('email', interfaceLanguage)}
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label className="atelier-field">{interfaceText('password', interfaceLanguage)}
              <input type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {registering ? <>
              <label><input type="checkbox" checked={registrationConsent} disabled={busy} onChange={event => setRegistrationConsent(event.target.checked)} /> {registrationText.services}</label>
              <details><summary>{registrationText.title}</summary><p>{registrationText.details}</p><Link href="/privacy">{interfaceFlowText('privacy', interfaceLanguage)}</Link></details>
              <label><input type="checkbox" checked={registrationRomance} disabled={busy} onChange={event => setRegistrationRomance(event.target.checked)} /> {registrationText.romance}</label>
            </> : null}
            <button type="submit" className="atelier-button" disabled={busy || (registering && !registrationConsent)}>{busy ? interfaceFlowText('accountBusy', interfaceLanguage) : registering ? interfaceText('createAccount', interfaceLanguage) : interfaceText('signIn', interfaceLanguage)}</button>
          </form>
        )}
        </section>
        {notice ? <p role="status">{notice}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </main>
  </>
}
