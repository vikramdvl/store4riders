import type { Metadata } from "next";
import ContactStore4RidersPage from "../contact-store4riders/page";

export const metadata: Metadata = {
  title: "Contact Us | Store4Riders",
  description: "Contact Store4Riders customer care for questions on orders, riding gear, helmet fitment, and exchange requests.",
  alternates: {
    canonical: "/contact-store4riders",
  },
};

export default function ContactPage() {
  return <ContactStore4RidersPage />;
}
