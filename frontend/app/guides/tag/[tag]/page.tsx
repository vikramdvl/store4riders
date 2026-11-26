import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ tag: string }>;
}

/**
 * Legacy Magento/CMS guide tag route (`/guides/tag/:tag`) -> canonical `/guides?tag=...`.
 */
export default async function GuidesTagRedirectPage({ params }: Props) {
  const { tag } = await params;
  let decodedTag = (tag || "").trim();
  try {
    decodedTag = decodeURIComponent(decodedTag).trim();
  } catch {
    // Keep raw segment if URL contains malformed percent-encoding
  }

  if (!decodedTag) {
    redirect("/guides");
  }

  redirect(`/guides?tag=${encodeURIComponent(decodedTag)}`);
}
