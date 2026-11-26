import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/core/utils/urlRedirects", async () => {
  const actual = await vi.importActual<typeof import("@/core/utils/urlRedirects")>(
    "@/core/utils/urlRedirects"
  );
  return {
    ...actual,
    getCachedUrlRedirectMap: vi.fn().mockResolvedValue(new Map()),
  };
});

import { middleware } from "../middleware";

function createRequest(path: string, userAgent: string, host = "store4riders.com"): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: {
      host,
      "user-agent": userAgent,
    },
  });
}

describe("Storefront Edge middleware bot shield and redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks bandwidth-hogging scraper bots with 403", async () => {
    const blockedAgents = [
      "Mozilla/5.0 (compatible; Bytespider)",
      "CCBot/2.0 (https://commoncrawl.org/faq/)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
      "Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)",
      "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)",
    ];

    for (const ua of blockedAgents) {
      const res = await middleware(createRequest("/motorcycle-helmets", ua));
      expect(res.status).toBe(403);
    }
  });

  it("allows Googlebot, Bingbot, AI search crawlers, and normal browsers", async () => {
    const allowedAgents = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
      "Mozilla/5.0 (compatible; Claude-Web/1.0)",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    ];

    for (const ua of allowedAgents) {
      const res = await middleware(createRequest("/motorcycle-helmets", ua));
      expect(res.status).toBe(200);
    }
  });

  it("preserves query params when redirecting legacy .html URLs", async () => {
    const res = await middleware(
      createRequest(
        "/agv-k1-s-helmet.html?color=Black",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0"
      )
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://store4riders.com/agv-k1-s-helmet?color=Black");
  });
});
