import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { interfaceText, type InterfaceCopyKey } from '../lib/interfaceLanguage'
import type { StoryLanguageCode } from '../lib/storyLanguage'

const destinations: { href: string; key: InterfaceCopyKey; routes: readonly string[] }[] = [
  { href: '/', key: 'navHome', routes: ['/'] },
  { href: '/myself', key: 'navMyself', routes: ['/myself'] },
  { href: '/stories', key: 'navStories', routes: ['/stories', '/my-stories', '/story', '/shared', '/couples'] },
  { href: '/library', key: 'navArchive', routes: ['/library'] },
  { href: '/billing', key: 'navPlans', routes: ['/billing'] },
  { href: '/account', key: 'navSettings', routes: ['/account'] }
]

export default function SiteNavigation({ pathname, recipient = false, interfaceLanguage = 'en-US' }: {
  pathname: string
  recipient?: boolean
  interfaceLanguage?: StoryLanguageCode
}) {
  const language = interfaceLanguage
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
            {destinations.map(({ href, key, routes }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                aria-current={routes.includes(pathname) ? 'page' : undefined}>{interfaceText(key, language)}</Link>
            ))}
          </nav>
        </> : null}
      </div>
    </header>
  )
}
