import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("urlRedirects Edge TTL cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("caches active redirect map for 5 minutes before refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { fromPath: "/old-helmet", toPath: "/new-helmet", statusCode: 301 },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getCachedUrlRedirectMap } = await import("../urlRedirects");

    const first = await getCachedUrlRedirectMap();
    expect(first.get("/old-helmet")?.toPath).toBe("/new-helmet");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Within 5-minute TTL (e.g. 4 minutes later): served from cache without network call
    vi.advanceTimersByTime(240_000);
    const second = await getCachedUrlRedirectMap();
    expect(second.get("/old-helmet")?.toPath).toBe("/new-helmet");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past 5-minute TTL (300,000ms): triggers fresh fetch
    vi.advanceTimersByTime(60_001);
    await getCachedUrlRedirectMap();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gracefully returns stale cache if refresh fetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { fromPath: "/legacy-jacket", toPath: "/riding-jacket", statusCode: 301 },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error("Backend timeout"));
    vi.stubGlobal("fetch", fetchMock);

    const { getCachedUrlRedirectMap } = await import("../urlRedirects");

    const initial = await getCachedUrlRedirectMap();
    expect(initial.get("/legacy-jacket")?.toPath).toBe("/riding-jacket");

    vi.advanceTimersByTime(300_001);
    const fallback = await getCachedUrlRedirectMap();
    expect(fallback.get("/legacy-jacket")?.toPath).toBe("/riding-jacket");
  });

  it("redirects discontinued description link /rynox-expedition-trail-bag-v2 to Tail Bags when no DB override exists", async () => {
    const permanentRedirectMock = vi.fn(() => {
      throw new Error("NEXT_REDIRECT:/motorcycle-bags-bike-luggage/motorcycle-tail-bags");
    });
    vi.doMock("next/navigation", () => ({
      permanentRedirect: permanentRedirectMock,
      redirect: vi.fn(),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { matched: false } }),
      })
    );

    const { redirectIfMatchedOrNotFound } = await import("../urlRedirects");

    await expect(
      redirectIfMatchedOrNotFound("/rynox-expedition-trail-bag-v2.html")
    ).rejects.toThrow("NEXT_REDIRECT:/motorcycle-bags-bike-luggage/motorcycle-tail-bags");
    expect(permanentRedirectMock).toHaveBeenCalledWith(
      "/motorcycle-bags-bike-luggage/motorcycle-tail-bags"
    );
  });

  it("prefers admin DB redirect rule over legacy discontinued fallback when configured", async () => {
    const permanentRedirectMock = vi.fn(() => {
      throw new Error("NEXT_REDIRECT:/custom-admin-tail-bag");
    });
    vi.doMock("next/navigation", () => ({
      permanentRedirect: permanentRedirectMock,
      redirect: vi.fn(),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            matched: true,
            toPath: "/custom-admin-tail-bag",
            statusCode: 301,
          },
        }),
      })
    );

    const { redirectIfMatchedOrNotFound } = await import("../urlRedirects");

    await expect(
      redirectIfMatchedOrNotFound("/rynox-expedition-trail-bag-v2")
    ).rejects.toThrow("NEXT_REDIRECT:/custom-admin-tail-bag");
    expect(permanentRedirectMock).toHaveBeenCalledWith("/custom-admin-tail-bag");
  });
});
