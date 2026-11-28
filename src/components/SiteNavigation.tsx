import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { interfaceText } from '../lib/interfaceLanguage'
import { storiesHubCopy } from '../lib/storiesHubCopy'
import type { StoryLanguageCode } from '../lib/storyLanguage'

export default function SiteNavigation({ pathname, recipient = false, interfaceLanguage = 'en-US' }: {
  pathname: string
  recipient?: boolean
  interfaceLanguage?: StoryLanguageCode
}) {
  const language = interfaceLanguage
  const stories = storiesHubCopy(language)
  const destinations = [
    { href: '/myself', label: interfaceText('navMyself', language), routes: ['/myself'] },
    { href: '/my-stories', label: stories.personalTitle, routes: ['/my-stories', '/story'] },
    { href: '/shared#new', label: stories.sharedTitle, routes: ['/shared', '/couples'] },
    { href: '/library', label: interfaceText('navArchive', language), routes: ['/library'] },
    { href: '/billing', label: interfaceText('navPlans', language), routes: ['/billing'] }
  ]
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { setMenuOpen(false) }, [pathname, recipient])
  return (
    <header className="muse-site-header" onKeyDown={event => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }}>
      <div className="atelier-header">
        <Link href="/" className="atelier-brand" aria-label={interfaceText('museHome', language)}>
          <svg aria-hidden="true" viewBox="0 0 32 40" fill="none"><path d="M16 35V14M16 24C5 23 3 14 5 5c9 2 14 9 11 19Zm0 7c10 0 15-8 12-17-8 2-13 9-12 17Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Muse
        </Link>
        {!recipient ? <>
          <button ref={menuButton} type="button" className="muse-nav-toggle"
            aria-label={interfaceText('navMenu', language)} aria-expanded={menuOpen}
            aria-controls="muse-primary-navigation" onClick={() => setMenuOpen(open => !open)}>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <nav id="muse-primary-navigation" aria-label="Main navigation" data-open={menuOpen}>
            {destinations.map(({ href, label, routes }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                aria-current={routes.includes(pathname) ? 'page' : undefined}>{label}</Link>
            ))}
          </nav>
          <Link href="/my-stories" className="muse-nav-begin">{stories.personalAction}</Link>
          <Link href="/account" className="muse-nav-account" aria-label={interfaceText('navSettings', language)}
            aria-current={pathname === '/account' ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c.5-4.3 3-6.5 7.5-6.5s7 2.2 7.5 6.5" />
            </svg>
          </Link>
        </> : null}
      </div>
    </header>
  )
}
