import type { Metadata } from "next";
import AboutUsStore4RidersPage from "../about-us-store4riders/page";

export const metadata: Metadata = {
  title: "About Store4Riders | India's Premier Riding Gear Destination",
  description:
    "Learn about Store4Riders, operated by MotoHive Media in Pune. Discover our story, our passion for motorcycle safety, and our curated collection of certified riding gear.",
  alternates: {
    canonical: "/about-us-store4riders",
  },
};

export default function AboutUsPage() {
  return <AboutUsStore4RidersPage />;
}
