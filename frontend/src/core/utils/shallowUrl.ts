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

/**
 * Syncs the `page` query parameter in the browser URL (omits `?page=1`) without triggering an RSC reload.
 */
export function syncPageQueryParam(page: number): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }
  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  updateQueryUrlShallow(nextUrl);
}
