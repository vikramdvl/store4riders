"use client";

import { usePathname } from "next/navigation";
import GuidesLoading from "../loading";
import GuidePostLoading from "../post/[slug]/loading";
import { DEFAULT_NAV_ITEMS } from "@/modules/homepage/components/navbar/nav.constants";

const KNOWN_GUIDE_CATEGORY_SLUGS = new Set<string>(
  (DEFAULT_NAV_ITEMS.find((item) => item.id === "guides")?.megaMenuItems || [])
    .flatMap((group) => group.items || [])
    .map((item) => item.href.split("/").filter(Boolean).pop()?.toLowerCase() || "")
    .filter(Boolean)
);

export default function GuidesDynamicSlugLoading() {
  const pathname = usePathname() || "";
  const lastSegment = pathname.split("/").filter(Boolean).pop()?.toLowerCase() || "";

  if (KNOWN_GUIDE_CATEGORY_SLUGS.has(lastSegment)) {
    return <GuidesLoading />;
  }

  return <GuidePostLoading />;
}
