import { pageIllustration } from '../lib/pageIllustration'

export default function PageIllustration({ pathname }: { pathname: string }) {
  return <div className="muse-page-illustration" aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={pageIllustration(pathname)} alt="" width="1200" height="400" decoding="async" />
    <span className="muse-illustration-seal" />
  </div>
}
