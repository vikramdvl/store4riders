import type { Metadata } from "next";
import PrivacyPolicyCookieRestrictionModePage from "../privacy-policy-cookie-restriction-mode/page";

export const metadata: Metadata = {
  title: "Privacy and Cookie Policy | Store4Riders",
  description:
    "Learn how Store4Riders collects, secures, manages, and safeguards your personal data, order records, and privacy.",
  alternates: {
    canonical: "/privacy-policy-cookie-restriction-mode",
  },
};

export default function PrivacyPage() {
  return <PrivacyPolicyCookieRestrictionModePage />;
}
