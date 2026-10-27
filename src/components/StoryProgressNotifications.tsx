import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { accountFetch, supabase } from '../lib/accountClient'
import { parseSharedStoryProgress } from '../lib/sharedStoryProgress'
import {
  loadStoryProgressNotificationsEnabled, loadStoryProgressSnapshots, saveStoryProgressSnapshots,
  storyProgressEvents, STORY_PROGRESS_NOTIFICATION_CHANGE_EVENT, type StoryProgressNotification,
  type StoryProgressSnapshot
} from '../lib/storyProgressNotifications'

type ActivityStory = { id: string; title: string; progress: unknown }

function isActivityStory(value: unknown): value is ActivityStory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const story = value as Record<string, unknown>
  return typeof story.id === 'string' && typeof story.title === 'string' && 'progress' in story
}

function snapshot(value: unknown): StoryProgressSnapshot {
  const progress = parseSharedStoryProgress(value)
  return {
    opened: progress.opened,
    finished: progress.solved + progress.skipped,
    furthestScene: progress.furthestScene,
    sceneCount: progress.sceneCount ?? null
  }
}

export default function StoryProgressNotifications() {
  const [notifications, setNotifications] = useState<StoryProgressNotification[]>([])
  const [error, setError] = useState('')
  const polling = useRef(false)
  const baselineNext = useRef(true)
  const currentUserId = useRef('')
  const sequence = useRef(0)

  const poll = useCallback(async () => {
    if (!supabase || polling.current || document.visibilityState === 'hidden') return
    polling.current = true
    try {
      if (!loadStoryProgressNotificationsEnabled()) {
        baselineNext.current = true
        setNotifications([])
        setError('')
        return
      }
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw new Error('Could not check your account for story progress.')
      const user = data.session?.user
      if (!user) {
        currentUserId.current = ''
        baselineNext.current = true
        setNotifications([])
        setError('')
        return
      }
      if (currentUserId.current !== user.id) {
        currentUserId.current = user.id
        baselineNext.current = true
        setNotifications([])
      }

      const stories: ActivityStory[] = []
      const cursors = new Set<string>()
      let after: string | null = null
      do {
        const response = await accountFetch('/api/shared-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'activity', after })
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not check shared-story progress.')
        if (!Array.isArray(result.stories) || (result.next !== null && typeof result.next !== 'string')) {
          throw new Error('Muse returned an invalid shared-story activity list.')
        }
        for (const story of result.stories) {
          if (!isActivityStory(story)) throw new Error('Muse returned an invalid shared-story activity item.')
          stories.push(story)
        }
        after = result.next
        if (after) {
          if (cursors.has(after)) throw new Error('Could not finish checking shared-story progress.')
          cursors.add(after)
        }
      } while (after)

      const previous = loadStoryProgressSnapshots(user.id)
      const next: Record<string, StoryProgressSnapshot> = {}
      const newNotifications: StoryProgressNotification[] = []
      for (const story of stories) {
        const current = snapshot(story.progress)
        next[story.id] = current
        if (baselineNext.current) continue
        const prior = previous[story.id] ?? {
          opened: 0, finished: 0, furthestScene: null, sceneCount: current.sceneCount
        }
        for (const event of storyProgressEvents(prior, current)) {
          sequence.current += 1
          newNotifications.push({
            id: `${story.id}:${event.kind}:${event.milestone}:${sequence.current}`,
            storyId: story.id,
            title: story.title,
            message: event.message
          })
        }
      }
      saveStoryProgressSnapshots(user.id, next)
      if (!loadStoryProgressNotificationsEnabled()) {
        baselineNext.current = true
        setNotifications([])
        setError('')
        return
      }
      baselineNext.current = false
      if (newNotifications.length) {
        setNotifications(current => [...newNotifications, ...current].slice(0, 5))
      }
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check shared-story progress.')
    } finally {
      polling.current = false
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const timer = window.setInterval(() => { void poll() }, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void poll() }
    const onPreferencesChanged = () => {
      baselineNext.current = true
      void poll()
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (currentUserId.current !== (session?.user.id ?? '')) {
        currentUserId.current = ''
        baselineNext.current = true
        setNotifications([])
      }
      void poll()
    })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(STORY_PROGRESS_NOTIFICATION_CHANGE_EVENT, onPreferencesChanged)
    void poll()
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(STORY_PROGRESS_NOTIFICATION_CHANGE_EVENT, onPreferencesChanged)
      data.subscription.unsubscribe()
    }
  }, [poll])

  if (!notifications.length && !error) return null
  return <aside aria-label="Shared-story notifications" style={{ maxWidth: 850, margin: '0 auto', padding: '0.5rem 1.5rem' }}>
    {error ? <p role="alert" style={{ margin: 0, padding: '0.75rem', background: '#fffaf6', color: '#a14329' }}>{error}</p> : null}
    {notifications.map(notification => <p key={notification.id} role="status" style={{ margin: '0.5rem 0', padding: '0.85rem 1rem', background: '#f5eee7', borderRadius: 12 }}>
      <strong>{notification.title}</strong>: {notification.message}{' '}
      <Link href="/library">View your gift stories</Link>{' '}
      <button type="button" onClick={() => setNotifications(current => current.filter(item => item.id !== notification.id))} aria-label={`Dismiss notification for ${notification.title}`}>Dismiss</button>
    </p>)}
  </aside>
}
