import type { Metadata } from "next";
import ReturnsPage from "../returns/page";

export const metadata: Metadata = {
  title: "Exchange & Replacement Policy | Store4Riders",
  description:
    "Official Store4Riders exchange and replacement policy. Size & Gear Exchange on all eligible riding essentials.",
  alternates: {
    canonical: "/returns-replacements-store4riders",
  },
};

export default function ReturnsReplacementsPage() {
  return <ReturnsPage />;
}
