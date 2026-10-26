import Link from 'next/link'

const destinations = [
  { href: '/', label: 'Home', routes: ['/'] },
  { href: '/myself', label: 'Myself', routes: ['/myself'] },
  { href: '/story?new=1', label: 'Create a story', routes: ['/story'] },
  { href: '/shared#new', label: 'Create a gift story', routes: ['/shared', '/couples'] },
  { href: '/library', label: 'Saved stories', routes: ['/library'] },
  { href: '/account', label: 'Account', routes: ['/account'] }
]

export default function SiteNavigation({ pathname, recipient = false, onCreateGift }: {
  pathname: string
  recipient?: boolean
  onCreateGift?: () => void
}) {
  return (
    <header className="muse-site-header">
      <div className="atelier-header">
        <Link href="/" className="atelier-brand" aria-label="Muse home">Muse</Link>
        {!recipient ? <nav aria-label="Main navigation">
          {destinations.map(({ href, label, routes }) => (
            <Link key={href} href={href} aria-current={routes.includes(pathname) ? 'page' : undefined}
              onClick={href === '/story?new=1' ? event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                event.preventDefault(); window.location.assign(href)
              }
                : href === '/shared#new' && onCreateGift ? event => { event.preventDefault(); onCreateGift() } : undefined}>{label}</Link>
          ))}
        </nav> : null}
      </div>
    </header>
  )
}
