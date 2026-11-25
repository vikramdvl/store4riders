/**
 * Updates query parameters in the browser URL without triggering a Next.js App Router
 * Server Component (RSC) round-trip. Next.js patches window.history.pushState and
 * replaceState so useSearchParams() and browser Back/Forward stay synchronized instantly.
 */
export function updateQueryUrlShallow(url: string, options?: { replace?: boolean }): void {
  if (typeof window === "undefined") return;
  if (options?.replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
}
