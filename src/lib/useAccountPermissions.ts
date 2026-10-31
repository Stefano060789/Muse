import { useEffect, useRef, useState } from 'react'
import { supabase } from './accountClient'
import { accountPermissions, accountPermissionsUpdate } from './accountPermissions'

export function useAccountPermissions() {
  const [permissions, setPermissions] = useState(() => accountPermissions(undefined))
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [accountId, setAccountId] = useState<string | undefined>()
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    if (!supabase) { setReady(true); return }
    const initial = generation.current
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || initial !== generation.current) return
      setPermissions(accountPermissions(sessionError ? undefined : data.session?.user.user_metadata))
      setAccountId(sessionError ? undefined : data.session?.user.id)
      if (sessionError) setError('Could not check account permissions.')
      setReady(true)
    }).catch(() => { if (active && initial === generation.current) { setError('Could not check account permissions.'); setReady(true) } })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      generation.current++
      if (active) { setPermissions(accountPermissions(session?.user.user_metadata)); setAccountId(session?.user.id); setError(''); setReady(true) }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  const save = async (services: boolean, romance: boolean) => {
    setSaving(true); setError('')
    try {
      if (!supabase) throw new Error('Account permission storage is unavailable.')
      const current = await supabase.auth.getSession()
      const id = current.data.session?.user.id
      if (current.error || !id) throw new Error('Sign in to update permissions.')
      const result = await supabase.auth.updateUser({ data: accountPermissionsUpdate(services, romance) })
      if (result.error || result.data.user?.id !== id) throw new Error('Could not save account permissions.')
      const after = await supabase.auth.getSession()
      if (after.error || after.data.session?.user.id !== id) throw new Error('Your account changed. Check permissions again.')
      setPermissions(accountPermissions(result.data.user.user_metadata))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save account permissions.')
      throw cause
    } finally { setSaving(false) }
  }
  return { ...permissions, accountId, ready, error, saving, save }
}
