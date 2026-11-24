import type { Metadata } from "next";
import LegalStuffPage from "../legal-stuff/page";

export const metadata: Metadata = {
  title: "Legal Information & Corporate Disclosures | Store4Riders",
  description:
    "Statutory corporate entity disclosures, regulatory compliance, GST registration, and legal terms for Store4Riders.",
  alternates: {
    canonical: "/legal-stuff",
  },
};

export default function LegalPage() {
  return <LegalStuffPage />;
}
