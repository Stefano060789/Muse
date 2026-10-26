import type { AppProps } from 'next/app'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import SiteFooter from '../components/SiteFooter'
import AppInstallSupport from '../components/AppInstallSupport'
import PageIllustration from '../components/PageIllustration'
import SiteNavigation from '../components/SiteNavigation'
import '../styles/globals.css'

type ErrorBoundaryState = {
  failed: boolean
  reportStatus: 'not-sent' | 'sending' | 'sent' | 'failed'
}

class ClientErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, reportStatus: 'not-sent' }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    void this.reportFailure()
  }

  private async reportFailure() {
    this.setState({ reportStatus: 'sending' })
    try {
      const response = await fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'client-render-failure' })
      })
      if (!response.ok) throw new Error('Error report request failed.')
      this.setState({ reportStatus: 'sent' })
    } catch {
      this.setState({ reportStatus: 'failed' })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <main role="alert" aria-labelledby="client-error-title" style={{ minHeight: '60vh', padding: '2rem', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
          <h1 id="client-error-title">This page could not be displayed</h1>
          <p>Your saved browser data has not been intentionally cleared. Do not reload if you have unsaved writing you need to copy first.</p>
          <p role="status" aria-live="polite">
            {this.state.reportStatus === 'sending' ? 'Sending a minimal error report…'
              : this.state.reportStatus === 'sent' ? 'A minimal error report was sent.'
                : this.state.reportStatus === 'failed' ? 'The error report could not be sent.'
                  : 'Preparing a minimal error report…'}
          </p>
          {this.state.reportStatus === 'failed' ? (
            <button type="button" onClick={() => void this.reportFailure()}>Try sending the report again</button>
          ) : null}
          <p>When ready, use your browser&apos;s reload control to try the page again. Muse will not reload automatically.</p>
        </main>
      )
    }
    return this.props.children
  }
}

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <ClientErrorBoundary>
      <AppInstallSupport />
      <div className="muse-world">
        {!['/shared', '/couples'].includes(router.pathname) ? <>
          <SiteNavigation pathname={router.pathname} />
          {router.pathname !== '/' ? <PageIllustration pathname={router.pathname} /> : null}
        </> : null}
        <Component {...pageProps} />
      </div>
      {['/shared', '/couples'].includes(router.pathname) ? <details style={{ maxWidth: 850, margin: '1rem auto', padding: '0 1.5rem' }}>
        <summary>Help, privacy and about Muse</summary>
        <SiteFooter />
      </details> : <SiteFooter />}
    </ClientErrorBoundary>
  )
}
