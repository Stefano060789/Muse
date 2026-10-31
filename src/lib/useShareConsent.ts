import { useEffect, useRef, useState } from 'react'
import { supabase } from './accountClient'
import { hasShareConsent, shareConsentUpdate } from './shareConsent'

export function useShareConsent() {
  const [accepted, setAccepted] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const mounted = useRef(false)
  const revision = useRef(0)

  useEffect(() => {
    mounted.current = true
    if (!supabase) {
      setReady(true)
      return () => { mounted.current = false }
    }
    const initialRevision = revision.current
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted.current || revision.current !== initialRevision) return
      setAccepted(!error && hasShareConsent(data.session?.user.user_metadata))
      setFailed(Boolean(error))
      setReady(true)
    }).catch(() => {
      if (!mounted.current || revision.current !== initialRevision) return
      setFailed(true)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      revision.current++
      if (!mounted.current) return
      setAccepted(hasShareConsent(session?.user.user_metadata))
      setReady(true)
      setFailed(false)
    })
    return () => { mounted.current = false; data.subscription.unsubscribe() }
  }, [])

  const save = async (enabled: boolean): Promise<void> => {
    setSaving(true)
    setFailed(false)
    try {
      if (!supabase) throw new Error('Account consent storage is unavailable')
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Sign in to save your permission')
      const userId = sessionData.session.user.id
      const { data, error } = await supabase.auth.updateUser({ data: shareConsentUpdate(enabled) })
      if (error || !data.user || data.user.id !== userId) throw new Error('Could not save your permission')
      const current = await supabase.auth.getSession()
      if (current.error || current.data.session?.user.id !== userId) throw new Error('Your account changed')
      if (mounted.current) setAccepted(hasShareConsent(data.user.user_metadata))
    } catch (error) {
      if (mounted.current) setFailed(true)
      throw error
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  const verify = async (): Promise<boolean> => {
    if (!supabase) return false
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return hasShareConsent(data.session?.user.user_metadata)
  }

  return { accepted, ready, saving, failed, save, verify }
}
