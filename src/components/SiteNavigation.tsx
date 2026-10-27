import Link from 'next/link'
import { interfaceText, type InterfaceCopyKey } from '../lib/interfaceLanguage'
import type { StoryLanguageCode } from '../lib/storyLanguage'

const destinations: { href: string; key: InterfaceCopyKey; routes: readonly string[] }[] = [
  { href: '/', key: 'navHome', routes: ['/'] },
  { href: '/myself', key: 'navMyself', routes: ['/myself'] },
  { href: '/my-stories', key: 'navMyStories', routes: ['/my-stories', '/story'] },
  { href: '/shared#new', key: 'navCreateGift', routes: ['/shared', '/couples'] },
  { href: '/library', key: 'navArchive', routes: ['/library'] },
  { href: '/account', key: 'navSettings', routes: ['/account'] }
]

export default function SiteNavigation({ pathname, recipient = false, onCreateGift, interfaceLanguage = 'en-US' }: {
  pathname: string
  recipient?: boolean
  onCreateGift?: () => void
  interfaceLanguage?: StoryLanguageCode
}) {
  const language = interfaceLanguage
  return (
    <header className="muse-site-header">
      <div className="atelier-header">
        <Link href="/" className="atelier-brand" aria-label={interfaceText('museHome', language)}>Muse</Link>
        {!recipient ? <nav aria-label="Main navigation">
          {destinations.map(({ href, key, routes }) => (
            <Link key={href} href={href} aria-current={routes.includes(pathname) ? 'page' : undefined}
              onClick={href === '/shared#new' && onCreateGift ? event => { event.preventDefault(); onCreateGift() } : undefined}>{interfaceText(key, language)}</Link>
          ))}
        </nav> : null}
      </div>
    </header>
  )
}
