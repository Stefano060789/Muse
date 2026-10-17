export const ILLUSTRATION_ASSETS = {
  passage: '/illustrations/moonlit-passage.svg',
  garden: '/illustrations/lantern-garden.svg',
  library: '/illustrations/celestial-library.svg'
} as const

export function pageIllustration(pathname: string) {
  if (['/shared', '/couples', '/demo'].includes(pathname)) return ILLUSTRATION_ASSETS.garden
  if (['/library', '/privacy', '/terms', '/support', '/billing', '/operations'].includes(pathname)) return ILLUSTRATION_ASSETS.library
  return ILLUSTRATION_ASSETS.passage
}
