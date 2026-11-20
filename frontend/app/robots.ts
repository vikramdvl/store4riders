import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isIndexingAllowed = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

  // Development / Staging: Disallow all search engine crawlers
  if (!isIndexingAllowed) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: ["/"],
        },
      ],
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://store4riders.com";
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/account",
          "/account/*",
          "/cart",
          "/checkout",
          "/checkout/*",
          "/api/*",
          "/search",
          "/forgot-password",
          "/reset-password",
        ],
      },
      {
        userAgent: [
          "Bytespider",
          "GPTBot",
          "CCBot",
          "Claude-Web",
          "anthropic-ai",
          "SemrushBot",
          "AhrefsBot",
          "DotBot",
          "MJ12bot",
        ],
        disallow: ["/"],
      },
    ],
    sitemap: `${normalizedBase}/sitemap.xml`,
  };
}
