export function getAnchorInternalNavigationHref(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href")

  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return null
  }

  const nextUrl = new URL(anchor.href, window.location.href)

  if (nextUrl.origin !== window.location.origin) {
    return null
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
}
